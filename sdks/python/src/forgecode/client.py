"""
@module client

Core implementation for the ForgeCode Python SDK.

Spawns the `forge` binary via `asyncio.create_subprocess_exec`, reads stdout,
and yields :class:`ForgeMessage` objects through an async generator.

The forge CLI outputs plain text with ANSI-prefixed status lines:
  ● [HH:MM:SS] Initialize <uuid>
  <assistant text (multi-line)>
  ● [HH:MM:SS] Execute [/bin/zsh] <command>     (verbose mode only)
  <tool output (verbose mode only)>
  ● [HH:MM:SS] Finished <uuid>

On error:
  ● [HH:MM:SS] ERROR: <message>
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import uuid
from typing import Any, AsyncGenerator, Callable

from pydantic import BaseModel, ValidationError

from .types import (
    AssistantMessage,
    ErrorMessage,
    ForgeBinaryNotFoundError,
    ForgeConfig,
    ForgeMessage,
    OutputFormatJsonSchema,
    QueryOptions,
    ResultMessage,
    SystemMessage,
    ToolUseMessage,
    UsageInfo,
)

# ---------------------------------------------------------------------------
# ANSI stripping
# ---------------------------------------------------------------------------

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07|\x1b[()][0-9a-zA-Z]")


def _strip_ansi(text: str) -> str:
    """Strip ANSI escape codes from a string."""
    return _ANSI_RE.sub("", text)


def strip_ansi(text: str) -> str:
    """Strip ANSI escape codes from a string (public alias for ``_strip_ansi``)."""
    return _ANSI_RE.sub("", text)


# ---------------------------------------------------------------------------
# Status line patterns
# ---------------------------------------------------------------------------

_STATUS_LINE_RE = re.compile(r"^●\s+\[\d{2}:\d{2}:\d{2}]\s+(.+)$")
_INIT_LINE_RE = re.compile(r"^Initialize\s+([0-9a-f-]{36})$")
_ERROR_LINE_RE = re.compile(r"^ERROR:\s*(.+)$")
_EXECUTE_LINE_RE = re.compile(r"^Execute\s+\[([^\]]+)\]\s+(.+)$")

# ---------------------------------------------------------------------------
# Binary resolution
# ---------------------------------------------------------------------------

_DEFAULT_SEARCH_PATHS = [
    "~/.local/bin/forge",
    "/usr/local/bin/forge",
    "/usr/bin/forge",
]


def resolve_forge_path(config: ForgeConfig | None = None) -> str:
    """Resolve the path to the forge binary.

    Search order:
      1. FORGE_PATH environment variable
      2. config.forge_path if provided
      3. ~/.local/bin/forge
      4. forge on PATH (via shutil.which)

    Raises:
        ForgeBinaryNotFoundError: if no binary is found
    """
    # 1. FORGE_PATH env var
    env_path = os.environ.get("FORGE_PATH")
    if env_path:
        return env_path

    # 2. Config path
    if config is not None and config.forge_path:
        return config.forge_path

    # 3. ~/.local/bin/forge
    local_bin = f"{os.environ.get('HOME', '/root')}/.local/bin/forge"
    if os.path.isfile(local_bin) and os.access(local_bin, os.X_OK):
        return local_bin

    # 4. which forge
    resolved = shutil.which("forge")
    if resolved:
        return resolved

    raise ForgeBinaryNotFoundError(_DEFAULT_SEARCH_PATHS)


# ---------------------------------------------------------------------------
# JSON extraction from text
# ---------------------------------------------------------------------------


def extract_json_from_text(text: str) -> Any:
    """Extract a JSON object from text that may contain markdown fences.

    Strategies (tried in order):
      1. Find ```json ... ``` fenced block
      2. Find ``` ... ``` fenced block and parse as JSON
      3. Find first `{` ... last `}` and parse (brace-matching)
      4. Parse entire text as JSON

    Raises:
        ValueError: if no valid JSON is found
    """
    trimmed = text.strip()

    # Strategy 1: ```json ... ```
    match = re.search(r"```json\s*\n([\s\S]*?)\n```", trimmed)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Strategy 2: ``` ... ``` (generic fence)
    match = re.search(r"```\s*\n([\s\S]*?)\n```", trimmed)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Strategy 3: brace-matching from last `{` to matching `}`
    brace_positions = [i for i, ch in enumerate(trimmed) if ch == "{"]
    for bi in range(len(brace_positions) - 1, -1, -1):
        start = brace_positions[bi]
        depth = 0
        for i in range(start, len(trimmed)):
            if trimmed[i] == "{":
                depth += 1
            elif trimmed[i] == "}":
                depth -= 1
                if depth == 0:
                    candidate = trimmed[start : i + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        break

    # Strategy 4: parse entire text as JSON
    try:
        return json.loads(trimmed)
    except json.JSONDecodeError as e:
        raise ValueError(f"No valid JSON found in output: {e}") from e


def _generate_session_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# MCP server import
# ---------------------------------------------------------------------------


async def _import_mcp_servers(
    forge_path: str,
    mcp_servers: dict[str, Any],
    env: dict[str, str],
) -> None:
    """Import MCP servers before running a query."""
    for name, config in mcp_servers.items():
        import_payload = json.dumps({"name": name, **config})
        proc = await asyncio.create_subprocess_exec(
            forge_path, "mcp", "import", import_payload, "--scope", "local",
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            stdin=asyncio.subprocess.DEVNULL,
        )
        await proc.wait()


async def _read_stderr(
    stderr_reader: asyncio.StreamReader,
    callback: Callable[[str], None] | None,
    lines_out: list[str],
) -> None:
    """Read stderr, call optional callback and collect lines."""
    while True:
        chunk = await stderr_reader.readline()
        if not chunk:
            break
        text = chunk.decode("utf-8", errors="replace")
        if callback:
            callback(text)
        lines_out.append(text)


async def _set_reasoning_effort(
    forge_path: str,
    effort: str,
    env: dict[str, str],
) -> None:
    """Set the reasoning effort level via `forge config set`."""
    proc = await asyncio.create_subprocess_exec(
        forge_path, "config", "set", "reasoning-effort", effort,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        stdin=asyncio.subprocess.DEVNULL,
    )
    await proc.wait()


# ---------------------------------------------------------------------------
# Main query async generator
# ---------------------------------------------------------------------------


async def query(
    prompt: str,
    options: QueryOptions | None = None,
    config: ForgeConfig | None = None,
) -> AsyncGenerator[ForgeMessage, None]:
    """Execute a ForgeCode query and yield messages as they arrive.

    This is the primary SDK function, mirroring the Claude Agent SDK's
    ``query()`` pattern. It spawns the ``forge`` binary in one-shot mode,
    collects its plain-text output, and yields typed messages.

    Args:
        prompt: The prompt text to send to the agent.
        options: Optional query configuration (snake_case TypedDict).
        config: Optional global SDK configuration.

    Yields:
        ForgeMessage objects as the agent processes the prompt.

    Example::

        import asyncio
        from forgecode import query

        async def main():
            async for message in query("What is 2 + 2?"):
                print(message)

        asyncio.run(main())
    """
    opts = options or {}

    # 20a: Resolve binary path (options.forge_path takes priority)
    try:
        forge_path: str = opts.get("forge_path") or resolve_forge_path(config)  # type: ignore[assignment]
    except ForgeBinaryNotFoundError as e:
        yield ErrorMessage(type="error", error=str(e))
        return

    # 20b: Build environment
    base_env: dict[str, str] = {k: v for k, v in os.environ.items() if v is not None}
    if opts.get("env"):
        extra_env = {k: v for k, v in opts["env"].items() if v is not None}
        base_env.update(extra_env)

    # Config-level overrides
    if config is not None:
        if config.openai_url:
            base_env["OPENAI_URL"] = config.openai_url
        if config.openai_api_key:
            base_env["OPENAI_API_KEY"] = config.openai_api_key
        if config.model:
            base_env["FORGE_MODEL"] = config.model

    # Option-level model (takes precedence)
    if opts.get("model"):
        base_env["FORGE_MODEL"] = opts["model"]

    # Filter None values (can't pass None to subprocess env)
    clean_env: dict[str, str] = {k: v for k, v in base_env.items() if v is not None}

    # 20c: Set reasoning effort
    effort = opts.get("reasoning_effort")
    if effort is None and config is not None:
        effort = config.reasoning_effort
    if effort:
        await _set_reasoning_effort(forge_path, effort, clean_env)

    # 20d: Import MCP servers
    mcp_servers = opts.get("mcp_servers")
    if mcp_servers and len(mcp_servers) > 0:
        await _import_mcp_servers(forge_path, mcp_servers, clean_env)

    # 20e: Build args
    effective_prompt = opts.get("system_prompt", "")
    if effective_prompt:
        effective_prompt = f"{effective_prompt}\n\n{prompt}"
    else:
        effective_prompt = prompt

    args = ["-p", effective_prompt]

    if opts.get("agent"):
        args.extend(["--agent", opts["agent"]])
    if opts.get("conversation_id"):
        args.extend(["--conversation-id", opts["conversation_id"]])
    if opts.get("sandbox"):
        args.extend(["--sandbox", opts["sandbox"]])
    if opts.get("cwd"):
        args.extend(["--directory", opts["cwd"]])

    # Accepted but silently ignored: max_turns, allowed_tools, disallowed_tools, tools, title
    _unwired = ["max_turns", "allowed_tools", "disallowed_tools", "tools", "title"]

    # 20f: Abort pre-check
    abort_event = opts.get("abort_event")
    if abort_event is not None and abort_event.is_set():
        yield ErrorMessage(type="error", error="Query was aborted before process started")
        return

    # 20g: Spawn subprocess
    proc = await asyncio.create_subprocess_exec(
        forge_path, *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        stdin=asyncio.subprocess.DEVNULL,
        env=clean_env,
        cwd=opts.get("cwd") or None,
    )

    # 20h: Abort watcher task
    abort_task: asyncio.Task[None] | None = None
    if abort_event is not None:
        async def _abort_watcher() -> None:
            await abort_event.wait()
            try:
                proc.kill()
            except ProcessLookupError:
                pass  # already exited

        abort_task = asyncio.create_task(_abort_watcher())

    # 20i: Stderr reader
    stderr_lines: list[str] = []
    stderr_callback = opts.get("stderr")
    stderr_reader: asyncio.StreamReader = proc.stderr  # type: ignore[assignment]
    stderr_task = asyncio.create_task(_read_stderr(stderr_reader, stderr_callback, stderr_lines))

    # 20j: stdout reading loop
    buffer = ""
    session_id = ""
    assistant_text = ""
    has_error = False
    error_message = ""
    system_yielded = False
    result_yielded_early = False  # True when a result message was yielded during stdout loop

    try:
        stdout_reader: asyncio.StreamReader = proc.stdout  # type: ignore[assignment]
        async for chunk in stdout_reader:
            buffer += chunk.decode("utf-8", errors="replace")
            *complete_lines, buffer = buffer.split("\n")
            for raw in complete_lines:
                stripped = _strip_ansi(raw.rstrip())
                if not stripped:
                    continue

                # Attempt direct JSON detection (no status line prefix).
                # Handles forge output written as JSON objects on separate lines.
                json_match: dict[str, Any] | None = None
                lstripped = stripped.lstrip()
                if lstripped.startswith("{"):
                    try:
                        json_match = json.loads(lstripped)
                    except json.JSONDecodeError:
                        pass

                if json_match is not None:
                    msg_type = json_match.get("type", "")
                    if msg_type == "system":
                        session_id = json_match.get("session_id", session_id)
                        system_yielded = True
                        yield SystemMessage(
                            type="system",
                            subtype=json_match.get("subtype", "init"),
                            session_id=session_id,
                        )
                    elif msg_type == "assistant":
                        yield AssistantMessage(
                            type="assistant",
                            content=json_match.get("content", ""),
                        )
                    elif msg_type == "tool_use":
                        yield ToolUseMessage(
                            type="tool_use",
                            name=json_match.get("name", ""),
                            arguments=json_match.get("arguments", {}),
                        )
                    elif msg_type == "result":
                        yield ResultMessage(
                            type="result",
                            result=json_match.get("result", ""),
                            session_id=session_id,
                            usage=None,
                        )
                        result_yielded_early = True
                    elif msg_type == "error":
                        has_error = True
                        error_message = json_match.get("error", "")
                        yield ErrorMessage(type="error", error=error_message)
                    else:
                        # Unknown JSON type — treat as plain assistant text
                        assistant_text += ("\n" if assistant_text else "") + stripped
                        yield AssistantMessage(type="assistant", content=stripped)
                    continue

                status_match = _STATUS_LINE_RE.match(stripped)
                if status_match:
                    content: str = status_match.group(1)

                    init_match = _INIT_LINE_RE.match(content)
                    if init_match:
                        session_id = init_match.group(1)
                        system_yielded = True
                        yield SystemMessage(type="system", subtype="init", session_id=session_id)
                        continue

                    error_match = _ERROR_LINE_RE.match(content)
                    if error_match:
                        has_error = True
                        error_message = error_match.group(1)
                        yield ErrorMessage(type="error", error=error_message)
                        continue

                    exec_match = _EXECUTE_LINE_RE.match(content)
                    if exec_match:
                        yield ToolUseMessage(
                            type="tool_use",
                            name=exec_match.group(1),
                            arguments={"command": exec_match.group(2)},
                        )
                        continue

                    # Unknown status line content — treat as assistant text
                    assistant_text += ("\n" if assistant_text else "") + stripped
                    yield AssistantMessage(type="assistant", content=stripped)
                else:
                    # Plain assistant text (no status line prefix)
                    assistant_text += ("\n" if assistant_text else "") + stripped
                    yield AssistantMessage(type="assistant", content=stripped)

    except asyncio.CancelledError:
        proc.kill()
        if abort_task:
            abort_task.cancel()
        raise

    # 20k: Handle remaining buffer (incomplete last line)
    remaining = buffer.strip()
    if remaining:
        stripped = _strip_ansi(remaining)
        if stripped:
            lstripped = stripped.lstrip()
            # Treat a single JSON object in the buffer as the result
            if lstripped.startswith("{"):
                try:
                    json_obj = json.loads(lstripped)
                    if json_obj.get("type") == "result":
                        yield ResultMessage(
                            type="result",
                            result=json_obj.get("result", ""),
                            session_id=session_id,
                            usage=None,
                        )
                        result_yielded_early = True  # suppress final result
                        result_text = ""
                    else:
                        assistant_text += ("\n" if assistant_text else "") + stripped
                except json.JSONDecodeError:
                    assistant_text += ("\n" if assistant_text else "") + stripped
            else:
                assistant_text += ("\n" if assistant_text else "") + stripped

    # 20l: Cancel abort watcher, await stderr
    if abort_task:
        abort_task.cancel()
    stderr_task.cancel()
    try:
        await stderr_task
    except asyncio.CancelledError:
        pass

    # 20m: Wait for process
    exit_code = await proc.wait()

    # 20n: Inspect stderr for error status lines
    stderr_text = "".join(stderr_lines)
    if not has_error and stderr_text.strip():
        for line in stderr_text.split("\n"):
            stripped = _strip_ansi(line.strip())
            status_match = _STATUS_LINE_RE.match(stripped)
            if status_match:
                error_match = _ERROR_LINE_RE.match(status_match.group(1))
                if error_match:
                    has_error = True
                    error_message = error_match.group(1)
                    yield ErrorMessage(type="error", error=error_message)
                    break

    # 20o: Handle non-zero exit code
    if exit_code != 0 and not has_error:
        yield ErrorMessage(
            type="error",
            error=stderr_text.strip() or f"Forge process exited with code {exit_code}",
            exit_code=exit_code,
        )
        return

    # 20p: Yield synthetic SystemMessage if none emitted
    if not system_yielded:
        yield SystemMessage(
            type="system",
            subtype="init",
            session_id=session_id or _generate_session_id(),
        )

    # Resolve result text
    result_text = assistant_text if assistant_text else "(no output)"

    # 20q: Handle output_format (json_schema with Pydantic validation)
    output_format = opts.get("output_format")
    if output_format and output_format.get("type") == "json_schema":
        model_cls: type[BaseModel] | None = output_format.get("model")
        if model_cls is None:
            # Deprecated `z` alias
            z_val = output_format.get("z")
            if z_val is not None:
                import warnings
                warnings.warn(
                    "The 'z' key in output_format is deprecated. Use 'model' instead.",
                    DeprecationWarning,
                    stacklevel=2,
                )
                model_cls = z_val  # type: ignore[assignment]

        if model_cls is not None:
            try:
                extracted = extract_json_from_text(result_text)
                if isinstance(extracted, str):
                    validated = model_cls.model_validate_json(extracted)
                else:
                    validated = model_cls.model_validate(extracted)
                yield ResultMessage(
                    type="result",
                    result=validated,
                    session_id=session_id or _generate_session_id(),
                    usage=None,
                )
                return
            except (json.JSONDecodeError, ValidationError) as e:
                yield ErrorMessage(type="error", error=f"JSON output failed schema validation: {e}")
                return

    # 20r: Yield final result message (skip if forge already emitted one inline)
    if not result_yielded_early:
        yield ResultMessage(
            type="result",
            result=result_text,
            session_id=session_id or _generate_session_id(),
            usage=None,
        )


__all__ = [
    "query",
    "resolve_forge_path",
    "strip_ansi",
    "extract_json_from_text",
]