"""
@module types

Type definitions for the ForgeCode Python SDK.

Mirrors the TypeScript SDK's type system using Python idioms:
- Message types: @dataclass(frozen=True)
- Dict-based configs: TypedDict
- Config objects: @dataclass
- Schema validation: Pydantic BaseModel (replacing Zod)

TS → Python name mapping for QueryOptions:
  agent             → agent
  conversationId    → conversation_id
  sandbox           → sandbox
  cwd               → cwd
  env               → env
  outputFormat      → output_format
  reasoningEffort   → reasoning_effort
  mcpServers        → mcp_servers
  allowedTools      → allowed_tools
  systemPrompt      → system_prompt
  abortController   → abort_event (asyncio.Event — set() to abort)
  model             → model
  maxTurns          → max_turns
  disallowedTools   → disallowed_tools
  tools             → tools
  continue          → continue_
  resume            → resume
  stderr            → stderr
  title             → title
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Callable, Literal, Required, TypedDict, Union

from pydantic import BaseModel
# ---------------------------------------------------------------------------
# Reasoning effort
# ---------------------------------------------------------------------------

ReasoningEffort = Literal["none", "minimal", "low", "medium", "high", "xhigh", "max"]

# ---------------------------------------------------------------------------
# Usage info
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class UsageInfo:
    """Token usage information attached to a ResultMessage."""

    input_tokens: int | None = None
    output_tokens: int | None = None


# ---------------------------------------------------------------------------
# Message types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SystemMessage:
    """Emitted at session start."""

    type: Literal["system"]
    subtype: Literal["init"]
    session_id: str


@dataclass(frozen=True)
class AssistantMessage:
    """Streaming text chunk from the assistant."""

    type: Literal["assistant"]
    content: str


@dataclass(frozen=True)
class ResultMessage:
    """Final result when the agent finishes."""

    type: Literal["result"]
    result: Any
    session_id: str
    usage: UsageInfo | None = None


@dataclass(frozen=True)
class ToolUseMessage:
    """Tool call performed during execution."""

    type: Literal["tool_use"]
    name: str
    arguments: dict[str, Any]


@dataclass(frozen=True)
class ErrorMessage:
    """Error encountered during execution."""

    type: Literal["error"]
    error: str
    exit_code: int | None = None


# ---------------------------------------------------------------------------
# ForgeMessage union
# ---------------------------------------------------------------------------

ForgeMessage = Union[
    SystemMessage,
    AssistantMessage,
    ResultMessage,
    ToolUseMessage,
    ErrorMessage,
]

# Concrete alias with result typed as str (no output_format)
ForgeMessageStr = Union[
    SystemMessage,
    AssistantMessage,
    ResultMessage,
    ToolUseMessage,
    ErrorMessage,
]


# ---------------------------------------------------------------------------
# Output format
# ---------------------------------------------------------------------------


class OutputFormatJsonSchema(TypedDict, total=False):
    """Structured output request.

    When `type == "json_schema"`, the SDK attempts to extract JSON from the
    final result text. If `model` (a Pydantic BaseModel subclass) is provided,
    the extracted JSON is validated with `model.model_validate()`.

    Note: the field is `model` (Pydantic) rather than `z` (Zod). The `z` key
    is accepted as a deprecated alias that maps to `model` with a warning.
    """

    type: Required[Literal["json_schema"]]
    model: type[BaseModel]
    verbose_errors: bool


OutputFormat = OutputFormatJsonSchema


# ---------------------------------------------------------------------------
# MCP server config
# ---------------------------------------------------------------------------


class McpServerConfig(TypedDict, total=False):
    """Configuration for an MCP server to import before a query run."""

    command: Required[str]
    args: list[str]
    transport: Literal["stdio", "sse"]
    env: dict[str, str | None]


# ---------------------------------------------------------------------------
# Query options
# ---------------------------------------------------------------------------


class QueryOptions(TypedDict, total=False):
    """Options for the :func:`query` function.

    Mirrors the TypeScript SDK's QueryOptions interface exactly, using
    snake_case for multi-word identifiers.
    """

    agent: str
    conversation_id: str
    sandbox: str
    cwd: str
    env: dict[str, str | None]
    output_format: OutputFormat
    reasoning_effort: ReasoningEffort
    mcp_servers: dict[str, McpServerConfig]
    allowed_tools: list[str]
    system_prompt: str
    abort_event: asyncio.Event  # set() to abort
    model: str
    max_turns: int
    disallowed_tools: list[str]
    tools: list[str]
    continue_: bool
    resume: str
    stderr: Callable[[str], None]
    title: str


# ---------------------------------------------------------------------------
# Forge config
# ---------------------------------------------------------------------------


@dataclass
class ForgeConfig:
    """Global SDK configuration."""

    forge_path: str | None = None
    openai_url: str | None = None
    openai_api_key: str | None = None
    model: str | None = None
    reasoning_effort: ReasoningEffort | None = None


# ---------------------------------------------------------------------------
# Error types
# ---------------------------------------------------------------------------


class ForgeBinaryNotFoundError(Exception):
    """Raised when the `forge` binary cannot be found on PATH."""

    def __init__(self, searched_paths: list[str]) -> None:
        super().__init__(
            f"Forge binary not found. Searched: {', '.join(searched_paths)}. "
            f"Install forge or set the FORGE_PATH environment variable.",
        )
        self.name = "ForgeBinaryNotFoundError"


class ForgeProcessError(Exception):
    """Raised when the forge process exits with a non-zero code."""

    def __init__(self, exit_code: int, stderr: str) -> None:
        super().__init__(f"Forge process exited with code {exit_code}: {stderr[:500]}")
        self.name = "ForgeProcessError"
        self.exit_code = exit_code
        self.stderr = stderr


class ForgeOutputParseError(Exception):
    """Raised when output format parsing fails."""

    def __init__(self, message: str, raw_output: str) -> None:
        super().__init__(f"Failed to parse forge output: {message}")
        self.name = "ForgeOutputParseError"
        self.raw_output = raw_output


class ForgeAbortError(Exception):
    """Raised when a query is aborted via abort_event."""

    def __init__(self) -> None:
        super().__init__("Query was aborted")
        self.name = "ForgeAbortError"


# ---------------------------------------------------------------------------
# Re-export BaseModel for consumers
# ------------------------------------------------------------------------__

__all__ = [
    # Messages
    "SystemMessage",
    "AssistantMessage",
    "ResultMessage",
    "ToolUseMessage",
    "ErrorMessage",
    "ForgeMessage",
    "ForgeMessageStr",
    "UsageInfo",
    # Enums / aliases
    "ReasoningEffort",
    "OutputFormatJsonSchema",
    "OutputFormat",
    "QueryOptions",
    "McpServerConfig",
    "ForgeConfig",
    # Errors
    "ForgeBinaryNotFoundError",
    "ForgeProcessError",
    "ForgeOutputParseError",
    "ForgeAbortError",
    # Pydantic re-export
    "BaseModel",
]