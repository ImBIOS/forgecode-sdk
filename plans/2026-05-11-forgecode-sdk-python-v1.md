# ForgeCode SDK — Monorepo Restructure + Python Support

## Objective

Restructure `submodules/forgecode-sdk` into a language-peer monorepo before adding Python support. Phase 0 migrates all existing TypeScript files into a `typescript/` subfolder so that both SDKs live as first-class peers under the submodule root. Phases 1–8 then add a fully self-contained Python package (`forgecode-sdk`) under `python/` that mirrors the TypeScript SDK's public API as closely as the language allows. The package targets Python ≥ 3.11, uses `uv` exclusively for tooling, Pydantic v2 for schema validation (Zod equivalent), and `asyncio.create_subprocess_exec` for process management (Bun.spawn equivalent). The async generator–based `query()` function, all message types, error classes, and helper functions must be present and documented.

---

## Implementation Plan

### Phase 0 — TypeScript Migration (Monorepo Restructure)

- [ ] **0a. Move all root-level TypeScript source files into `typescript/`** using `git mv` (preserving history):
  - `src/` → `typescript/src/`
  - `examples/` → `typescript/examples/`
  - `package.json` → `typescript/package.json`
  - `tsconfig.json` → `typescript/tsconfig.json`
  - `tsconfig.examples.json` → `typescript/tsconfig.examples.json`

  After the move the submodule root contains only: `README.md`, `AGENTS.md`, `.gitignore`, `typescript/`, and (after Phase 1) `python/`.

- [ ] **0b. Verify relative imports inside TypeScript examples remain correct after the move**.
  Examples move from `examples/*.ts` → `typescript/examples/*.ts`; source moves from `src/` → `typescript/src/`. The relative depth between examples and src is unchanged (`../src`), so no import path edits are needed. Confirm by inspecting each `examples/*.ts` for `from "../src"` and asserting the path still resolves correctly under the new layout.

- [ ] **0c. Fix `tsconfig.examples.json` path references relative to the new `typescript/` location**.
  Open `typescript/tsconfig.examples.json` and verify:
  - Any `extends` field pointing to `./tsconfig.json` still resolves (it will, as both files are now siblings inside `typescript/`).
  - Any `include` or `paths` entries that referenced the old root-relative `src/` or `examples/` now use paths relative to `typescript/` (e.g., `./src`, `./examples`).
  Update as needed.

- [ ] **0d. Fix `typescript/package.json` path references**.
  Inspect `main`, `exports`, and `scripts` fields. Any entry that previously assumed `src/` was at the package root (e.g., `"main": "./src/index.ts"`, `"exports": { ".": "./src/index.ts" }`) continues to work unchanged because `package.json` is now co-located with `src/` inside `typescript/`. Confirm `name` is still `@imbios/forgecode-sdk` and `exports`/`main` still point to `./src/index.ts`. If any script uses a path that escaped the old root (e.g., `../../something`), update it.

- [ ] **0e. Rewrite the root `README.md` as a monorepo overview**.
  The new root `README.md` must:
  - Describe the repo as a multi-language SDK.
  - Provide a table or section list linking to `typescript/` (existing SDK) and `python/` (new SDK).
  - Retain the original TypeScript quick-start under a `## TypeScript` heading, noting that all commands are now run from `typescript/`.
  - Include a `## Python` stub section that will be filled in by Phase 7.

- [ ] **0f. Update root `.gitignore` to cover both language environments**.
  Append (or merge) the following patterns if not already present:
  - TypeScript: `typescript/node_modules/`, `typescript/dist/`, `typescript/*.tsbuildinfo`
  - Python: `python/__pycache__/`, `python/.venv/`, `python/*.egg-info/`, `python/.mypy_cache/`, `python/.pytest_cache/`

- [ ] **0g. Note consumer impact: no source changes required in the parent monorepo**.
  Both `@alsafa/harness` (`packages/harness/src/session-runner.ts`) and `@alsafa/server` (`apps/server/src/chat.ts`) import from the package name `@imbios/forgecode-sdk`, which is resolved via `typescript/package.json`'s `name` + `exports` fields — not via file paths. As long as `typescript/package.json` retains the same `name`, `exports`, and `main` fields pointing to `./src/index.ts`, both consumers continue to work without any edits. Document this conclusion in a comment inside `typescript/package.json` or in the root `README.md` under a "Consumer compatibility" note.

---

### Phase 1 — Package Scaffolding

- [ ] **1. Create the `python/` directory tree** inside `submodules/forgecode-sdk/`.
  The canonical layout is:

  ```
  submodules/forgecode-sdk/python/
  ├── pyproject.toml
  ├── uv.lock               (generated, committed)
  ├── .python-version       (contains "3.11")
  ├── README.md             (minimal — purpose + quick-start only)
  ├── src/
  │   └── forgecode/
  │       ├── __init__.py   (public API barrel)
  │       ├── types.py      (all types, dataclasses, error classes)
  │       └── client.py     (async generator, subprocess management)
  ├── examples/
  │   ├── basic_query.py
  │   ├── json_output.py
  │   ├── abort_query.py
  │   ├── tool_use.py
  │   ├── advanced_options.py
  │   ├── session_management.py
  │   ├── error_handling.py
  │   └── mcp_servers.py
  └── tests/
      ├── conftest.py
      ├── test_types.py
      ├── test_client_helpers.py
      └── test_query_integration.py
  ```

- [ ] **2. Create `pyproject.toml`** with the following specification:
  - **Build backend**: `hatchling` (uv-native, no setuptools)
  - **Package name**: `forgecode-sdk`
  - **Version**: `0.1.0`
  - **Python requires**: `>=3.11`
  - **Runtime dependencies**: `pydantic>=2.0,<3` only — no other runtime deps
  - **Dev/optional dependencies** (in `[dependency-groups]`):
    - `dev`: `pytest>=8`, `pytest-asyncio>=0.23`, `mypy>=1.9`, `pydantic>=2`
  - **`[tool.pytest.ini_options]`**: `asyncio_mode = "auto"`, `testpaths = ["tests"]`
  - **`[tool.mypy]`**: `strict = true`, `python_version = "3.11"`
  - **`[project.urls]`**: point to the parent SDK repository
  - **`[tool.hatch.build.targets.wheel]`**: `packages = ["src/forgecode"]`

- [ ] **3. Pin the Python version** by writing `3.11` into `python/.python-version`. This is picked up automatically by `uv`.

- [ ] **4. Generate the lockfile** by running `uv lock` inside `python/`. Commit `uv.lock` alongside `pyproject.toml`.

---

### Phase 2 — Types Module (`src/forgecode/types.py`)

- [ ] **5. Define `ReasoningEffort`** as a `Literal` type alias:

  ```python
  ReasoningEffort = Literal["none","minimal","low","medium","high","xhigh","max"]
  ```

- [ ] **6. Define all message dataclasses** using `@dataclass(frozen=True)` for immutability, mirroring the TS interfaces exactly:
  - `SystemMessage` — fields: `type: Literal["system"]`, `subtype: Literal["init"]`, `session_id: str`
  - `AssistantMessage` — fields: `type: Literal["assistant"]`, `content: str`
  - `ResultMessage` — generic via `Generic[T]`: fields: `type: Literal["result"]`, `result: T`, `session_id: str`, `usage: UsageInfo | None = None`
  - `ToolUseMessage` — fields: `type: Literal["tool_use"]`, `name: str`, `arguments: dict[str, Any]`
  - `ErrorMessage` — fields: `type: Literal["error"]`, `error: str`, `exit_code: int | None = None`
  - `UsageInfo` — fields: `input_tokens: int | None = None`, `output_tokens: int | None = None`

- [ ] **7. Define `ForgeMessage`** as a `Union` type alias:

  ```python
  ForgeMessage = Union[SystemMessage, AssistantMessage, ToolUseMessage, ErrorMessage, ResultMessage[T]]
  ```

  Because Python generics on unions are cumbersome for consumers, also export `ForgeMessageStr = Union[..., ResultMessage[str]]` as the default concrete alias.

- [ ] **8. Define `OutputFormatJsonSchema`** as a `TypedDict`:

  ```python
  class OutputFormatJsonSchema(TypedDict, total=False):
      type: Required[Literal["json_schema"]]
      model: Required[type[BaseModel]]   # Pydantic BaseModel replaces ZodType
      verbose_errors: bool               # default False
  ```

  **Note**: The field is `model` (a `type[BaseModel]`) rather than `z` (a `ZodType`). This is the primary API divergence from the TypeScript SDK. Keep `z` as a deprecated alias that maps to `model` with a runtime warning, for discoverability by users migrating from the TS side.

- [ ] **9. Define `McpServerConfig`** as a `TypedDict`:

  ```python
  class McpServerConfig(TypedDict, total=False):
      command: Required[str]
      args: list[str]
      transport: Literal["stdio", "sse"]
      env: dict[str, str | None]
  ```

- [ ] **10. Define `QueryOptions`** as a `TypedDict` with `total=False` (all fields optional):
  All fields mirror the TS `QueryOptions` interface exactly. Use snake_case names — provide a mapping table in the module docstring for TS→Python name correspondence:

  | TypeScript        | Python              | Notes                                          |
  |-------------------|---------------------|------------------------------------------------|
  | `agent`           | `agent`             | identical                                      |
  | `conversationId`  | `conversation_id`   | snake_case                                     |
  | `sandbox`         | `sandbox`           | identical                                      |
  | `cwd`             | `cwd`               | identical                                      |
  | `env`             | `env`               | `dict[str, str \| None]`                       |
  | `outputFormat`    | `output_format`     | `OutputFormatJsonSchema`                       |
  | `reasoningEffort` | `reasoning_effort`  | `ReasoningEffort` Literal                      |
  | `mcpServers`      | `mcp_servers`       | `dict[str, McpServerConfig]`                   |
  | `allowedTools`    | `allowed_tools`     | `list[str]`                                    |
  | `systemPrompt`    | `system_prompt`     | `str`                                          |
  | `abortController` | `abort_event`       | `asyncio.Event` — set to signal abort          |
  | `model`           | `model`             | `str`                                          |
  | `maxTurns`        | `max_turns`         | `int` (not yet wired to CLI arg — future)      |
  | `disallowedTools` | `disallowed_tools`  | `list[str]` (not yet wired — future)           |
  | `tools`           | `tools`             | `list[str]` (not yet wired — future)           |
  | `continue_`       | `continue_`         | `bool`; trailing underscore avoids keyword clash |
  | `resume`          | `resume`            | `str`                                          |
  | `stderr`          | `stderr`            | `Callable[[str], None]`                        |
  | `title`           | `title`             | `str` (not yet wired — future)                 |

- [ ] **11. Define `ForgeConfig`** as a `dataclass` (not TypedDict — it's a config object, not a call-site dict):

  ```python
  @dataclass
  class ForgeConfig:
      forge_path: str | None = None
      openai_url: str | None = None
      openai_api_key: str | None = None
      model: str | None = None
      reasoning_effort: ReasoningEffort | None = None
  ```

- [ ] **12. Define all four error classes**, each extending `Exception`:
  - `ForgeBinaryNotFoundError(searched_paths: list[str])` — message mirrors TS exactly
  - `ForgeProcessError(exit_code: int, stderr: str)` — stores `exit_code` and `stderr` as attributes; message truncates stderr to 500 chars
  - `ForgeOutputParseError(message: str, raw_output: str)` — stores `raw_output` as attribute
  - `ForgeAbortError()` — message: `"Query was aborted"`

---

### Phase 3 — Client Module (`src/forgecode/client.py`)

- [ ] **13. Implement `resolve_forge_path(config: ForgeConfig | None = None) -> str`**:
  Search order (identical to TS):
  1. `os.environ.get("FORGE_PATH")` — return immediately if set
  2. `config.forge_path` — return if provided
  3. `~/.local/bin/forge` — check `os.path.isfile()` + `os.access(path, os.X_OK)`
  4. `shutil.which("forge")` — return if found
  5. Raise `ForgeBinaryNotFoundError` with the paths that were checked

- [ ] **14. Implement `extract_json_from_text(text: str) -> Any`**:
  Mirror the four-strategy TS implementation precisely:
  1. Regex `r'```json\s*\n([\s\S]*?)\n```'` → `json.loads(match.group(1).strip())`
  2. Regex `r'```\s*\n([\s\S]*?)\n```'` → `json.loads(match.group(1).strip())`
  3. Brace-matching: collect all `{` positions, iterate from last to first, find matching `}` by tracking nesting depth, attempt `json.loads`
  4. `json.loads(trimmed)` on the entire text
  5. Raise `ValueError("No valid JSON found in output")` if all four fail

- [ ] **15. Implement `_strip_ansi(text: str) -> str`** (private):
  Compile one regex at module level:

  ```python
  _ANSI_RE = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07|\x1b[()][0-9a-zA-Z]')
  ```

  Return `_ANSI_RE.sub("", text)`.

- [ ] **16. Compile all status-line patterns** at module level (private constants):

  ```python
  _STATUS_LINE_RE  = re.compile(r'^●\s+\[\d{2}:\d{2}:\d{2}\]\s+(.+)$')
  _INIT_LINE_RE    = re.compile(r'^Initialize\s+([0-9a-f-]{36})$')
  _ERROR_LINE_RE   = re.compile(r'^ERROR:\s*(.+)$')
  _EXECUTE_LINE_RE = re.compile(r'^Execute\s+\[([^\]]+)\]\s+(.+)$')
  ```

- [ ] **17. Implement `_import_mcp_servers(forge_path, servers, env)` as an `async def`**:
  For each `(name, server_config)` pair:
  1. Build the JSON payload dict: `{name, command, args, transport, env}` (defaults: `args=[]`, `transport="stdio"`, `env={}`)
  2. Run `forge mcp import <json_payload> --scope local` via `asyncio.create_subprocess_exec`
  3. `await proc.wait()` — on non-zero exit, print a warning with the first 200 chars of stderr (do not raise)
  4. Process each server sequentially (mirrors TS `for...of`)

- [ ] **18. Implement the `_set_reasoning_effort(forge_path, effort, env)` helper as an `async def`**:
  Run `forge config set reasoning-effort <effort>` via `asyncio.create_subprocess_exec`. Await completion. No return value.

- [ ] **19. Implement `_generate_session_id() -> str`**:
  Return `str(uuid.uuid4())`.

- [ ] **20. Implement the main `query()` async generator** with signature:

  ```python
  async def query(
      prompt: str,
      options: QueryOptions | None = None,
      config: ForgeConfig | None = None,
  ) -> AsyncGenerator[ForgeMessage[Any], None]:
  ```

  **Note on signature**: The Python function takes `prompt` as a positional parameter directly (no `QueryParams` wrapper dict) to match Python calling conventions. The TS `{ prompt, options }` object maps to `query(prompt, options=...)`. This is documented in the compatibility notes.

  **Implementation steps inside `query()`**:

  - [ ] **20a. Resolve binary path** via `resolve_forge_path(config)`. Wrap in `try/except ForgeBinaryNotFoundError` so the generator yields an `ErrorMessage` and returns rather than raising.

  - [ ] **20b. Build the environment dict**:

    ```python
    env = {**os.environ, **(options.get("env") or {})}
    ```

    Then apply config overrides (`OPENAI_URL`, `OPENAI_API_KEY`, `FORGE_MODEL`) and option-level `model` override (higher priority than config). Filter out `None` values before passing to subprocess: `{k: v for k, v in env.items() if v is not None}`.

  - [ ] **20c. Set reasoning effort** (if `options.reasoning_effort` or `config.reasoning_effort`): call `await _set_reasoning_effort(...)`. Option-level takes priority over config-level.

  - [ ] **20d. Import MCP servers** (if `options.mcp_servers`): call `await _import_mcp_servers(...)`.

  - [ ] **20e. Build the `args` list**:
    Start with `["-p", effective_prompt]` where `effective_prompt` prepends `system_prompt + "\n\n"` if provided.
    Append flag pairs for mapped options (identical to TS):
    - `agent` → `["--agent", value]`
    - `conversation_id` → `["--conversation-id", value]`
    - `sandbox` → `["--sandbox", value]`
    - `cwd` → `["--directory", value]`
    Options not yet mapped to CLI args (`max_turns`, `allowed_tools`, `disallowed_tools`, `tools`, `title`) are accepted silently and logged at `DEBUG` level as "not yet wired to CLI args".

  - [ ] **20f. Handle abort_event pre-check**: if `options.abort_event` is set and already set, yield an `ErrorMessage("Query was aborted before process started")` and return.

  - [ ] **20g. Spawn the subprocess** using `asyncio.create_subprocess_exec`:

    ```python
    proc = await asyncio.create_subprocess_exec(
        forge_path, *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        stdin=asyncio.subprocess.DEVNULL,
        env=clean_env,
        cwd=options.get("cwd") or None,
    )
    ```

  - [ ] **20h. Manage the abort_event** using `asyncio.create_task` for a watcher coroutine:

    ```python
    async def _abort_watcher():
        await options["abort_event"].wait()
        proc.kill()
    ```

    Store the task so it can be cancelled when the generator finishes.

  - [ ] **20i. Read stderr concurrently** using `asyncio.create_task`:
    - If `options.stderr` callback is provided: stream stderr lines to the callback as they arrive (read chunks, decode, call callback).
    - Otherwise: collect all stderr into a string for later error inspection.
    Both paths store the final stderr string in a variable accessible after the main loop.

  - [ ] **20j. Implement the stdout reading loop**:

    ```python
    buffer = ""
    async for chunk in proc.stdout:
        buffer += chunk.decode("utf-8", errors="replace")
        *complete_lines, buffer = buffer.split("\n")
        for line in complete_lines:
            # ... process line
    ```

    For each line:
    1. Strip trailing whitespace → `raw`
    2. `_strip_ansi(raw)` → `stripped`
    3. Match `_STATUS_LINE_RE` on `stripped`
    4. If status match → dispatch to init/error/execute sub-patterns (yield appropriate message, `continue`)
    5. If no status match and `stripped` is non-empty → accumulate `assistant_text`, yield `AssistantMessage(type="assistant", content=stripped)`

  - [ ] **20k. Handle remaining buffer** after the loop ends: strip and accumulate any non-empty remainder into `assistant_text`.

  - [ ] **20l. Cancel the abort watcher task** and await stderr collection task.

  - [ ] **20m. Await `proc.wait()`** to get `exit_code`.

  - [ ] **20n. Inspect collected stderr** for ERROR status lines (identical to TS post-loop logic): if no error was found during stdout reading but stderr contains an `ERROR:` status line, yield an `ErrorMessage` from it.

  - [ ] **20o. Handle non-zero exit code**: if `exit_code != 0` and no error has been yielded yet, yield `ErrorMessage(error=stderr_text or f"Forge process exited with code {exit_code}", exit_code=exit_code)` and return.

  - [ ] **20p. Yield synthetic SystemMessage** if the forge process never emitted an Initialize line.

  - [ ] **20q. Handle `output_format`**: if `options.output_format.type == "json_schema"`:
    1. Call `extract_json_from_text(result_text)` to get `extracted`
    2. If `options.output_format.model` is a `type[BaseModel]` subclass:
       - Call `model_cls.model_validate(extracted)`
       - On `ValidationError`: if `verbose_errors`, include `err.errors()` in message; yield `ErrorMessage` and return
       - On success: yield `ResultMessage(result=validated_obj, session_id=session_id)`; return
    3. If no `model` key: yield `ResultMessage(result=extracted, session_id=session_id)`; return
    4. On any extraction failure (ValueError): fall through to plain-text result

  - [ ] **20r. Yield final plain-text ResultMessage**: `ResultMessage(result=result_text or "(no output)", session_id=session_id)`.

---

### Phase 4 — Public API (`src/forgecode/__init__.py`)

- [ ] **21. Barrel-export all public symbols**, mirroring `src/index.ts`:
  - From `types`: `SystemMessage`, `AssistantMessage`, `ResultMessage`, `ToolUseMessage`, `ErrorMessage`, `ForgeMessage`, `ForgeMessageStr`, `UsageInfo`, `ReasoningEffort`, `OutputFormatJsonSchema`, `OutputFormat`, `QueryOptions`, `McpServerConfig`, `ForgeConfig`
  - From `types` (errors): `ForgeBinaryNotFoundError`, `ForgeProcessError`, `ForgeOutputParseError`, `ForgeAbortError`
  - From `client`: `query`, `resolve_forge_path`, `extract_json_from_text`
  - Set `__all__` explicitly to match.
  - Set `__version__ = "0.1.0"`.

---

### Phase 5 — Examples (`python/examples/`)

Each example is a standalone script runnable with `uv run python examples/<name>.py` from the `python/` directory. All use `asyncio.run(main())` as the entry point.

- [ ] **22. `basic_query.py`** — mirrors `typescript/examples/basic-query.ts`:

  ```python
  async def main():
      async for message in query("What is 2 + 2? Reply with just the number."):
          match message.type:
              case "system": print(f"[session] {message.session_id}")
              case "assistant": sys.stdout.write(message.content)
              case "result": print(f"\n[result] {message.result}")
              case "error": print(f"[error] {message.error}", file=sys.stderr)
  ```

- [ ] **23. `json_output.py`** — mirrors `typescript/examples/json-output.ts` using Pydantic instead of Zod:

  ```python
  class MathResult(BaseModel):
      expression: str
      result: float
      steps: list[str]

  async def main():
      async for message in query(
          "Solve: (15 * 7) - (42 / 6). Return ONLY valid JSON...",
          options={"output_format": {"type": "json_schema", "model": MathResult}},
      ):
          if message.type == "result":
              print("Expression:", message.result.expression)
              ...
  ```

- [ ] **24. `abort_query.py`** — mirrors `typescript/examples/abort-query.ts` using `asyncio.Event`:

  ```python
  async def main():
      abort_event = asyncio.Event()
      async def _abort_after(secs):
          await asyncio.sleep(secs)
          print("[abort] Cancelling query...")
          abort_event.set()
      asyncio.create_task(_abort_after(3))
      async for message in query(
          "Write a detailed 5000-word essay on the history of computing.",
          options={"abort_event": abort_event},
      ):
          ...
  ```

- [ ] **25. `tool_use.py`** — mirrors `typescript/examples/tool-use.ts`: accumulate `tool_use` messages, print summary at end.

- [ ] **26. `advanced_options.py`** — mirrors `typescript/examples/advanced-options.ts`: demonstrates `model`, `max_turns`, `system_prompt`, `env`, `stderr` callback.

- [ ] **27. `session_management.py`** — mirrors `typescript/examples/session-management.ts`: two-step conversation using `session_id` from `SystemMessage` and `resume` option.

- [ ] **28. `error_handling.py`** — mirrors `typescript/examples/error-handling.ts`: try/except `ForgeBinaryNotFoundError`, calls `resolve_forge_path()`.

- [ ] **29. `mcp_servers.py`** — mirrors `typescript/examples/mcp-servers.ts`: passes `mcp_servers` dict with one filesystem MCP server.

---

### Phase 6 — Tests (`python/tests/`)

- [ ] **30. `conftest.py`**:
  - Provide a `forge_path` fixture that skips the test if the `forge` binary is not found (uses `resolve_forge_path()` in a try/except).
  - Provide a `fake_forge_script` fixture that creates a temporary shell script mimicking forge's stdout output format, used for unit tests that don't need the real binary.

- [ ] **31. `test_types.py`** — unit tests for all types and error classes:
  - Instantiate each message dataclass, assert fields are set correctly.
  - Assert `ForgeBinaryNotFoundError` message includes all searched paths.
  - Assert `ForgeProcessError` truncates stderr to 500 chars in message.
  - Assert `ForgeOutputParseError` stores `raw_output`.
  - Assert `ForgeAbortError` message is `"Query was aborted"`.

- [ ] **32. `test_client_helpers.py`** — unit tests for pure functions:
  - `resolve_forge_path`: test env var priority, test config path priority, test `ForgeBinaryNotFoundError` when nothing found (mock `shutil.which` to return None).
  - `extract_json_from_text`: test all four strategies with concrete inputs (JSON fence, generic fence, brace-matching in surrounding prose, raw JSON, failure case raising ValueError).
  - `_strip_ansi`: test removal of CSI sequences, OSC sequences, and passthrough of plain text.
  - Status-line regex: parametrize with Initialize, Finished, ERROR:, Execute lines and assert correct group capture.

- [ ] **33. `test_query_integration.py`** — integration-style tests using `fake_forge_script`:
  - Test that `SystemMessage` is yielded when Initialize line is emitted.
  - Test that `AssistantMessage` is yielded for plain text lines.
  - Test that `ResultMessage` with raw string result is yielded at end.
  - Test `ErrorMessage` is yielded when `ERROR:` status line appears.
  - Test abort: set `abort_event` before calling query, assert `ErrorMessage("Query was aborted before process started")` is first message.
  - Test `output_format` with a Pydantic model: fake forge emits `{"expression":"x","result":1.0,"steps":[]}`, assert `ResultMessage.result` is a validated `MathResult` instance.
  - Test `output_format` validation failure: forge emits invalid JSON, assert `ErrorMessage` is yielded (verbose_errors=True path).

---

### Phase 7 — Tooling Documentation

- [ ] **34. Document all `uv` commands** in `python/README.md` under a "Development" section:

  ```bash
  # Install all deps (including dev group)
  uv sync --group dev

  # Run a single example
  uv run python examples/basic_query.py

  # Run all tests
  uv run pytest

  # Type-check with mypy
  uv run mypy src/forgecode

  # Update lockfile after pyproject.toml changes
  uv lock
  ```

- [ ] **35. Add a `[tool.hatch.build.targets.wheel]` section** confirming the src layout is discovered correctly — this is required because `src/` is not the default search root for hatchling without explicit config.

---

### Phase 8 — AGENTS.md Update

- [ ] **36. Rewrite `submodules/forgecode-sdk/AGENTS.md`** to cover both SDK implementations with the following structure:

  **`## TypeScript SDK`** section:
  - Location: `typescript/` subdirectory (moved from root in Phase 0)
  - Package name: `@imbios/forgecode-sdk`
  - Toolchain: Bun + TypeScript
  - Entry point: `typescript/src/index.ts`
  - Examples directory: `typescript/examples/`
  - Key commands run from `typescript/`: `bun install`, `bun run typecheck`, `bun run examples/<file>.ts`
  - Note that consumers in the parent monorepo (`@alsafa/harness`, `@alsafa/server`) import by package name and are unaffected by the `typescript/` move

  **`## Python SDK`** section:
  - Location: `python/` subdirectory
  - Package name: `forgecode-sdk`
  - Toolchain: `uv` + `pytest` + `mypy`
  - Key API difference table (abort_event vs AbortController, Pydantic BaseModel vs Zod, snake_case options)
  - Quick-start snippet showing `asyncio.run(main())` + `async for message in query(...)`
  - Reference to all 8 examples in `python/examples/`

  **`## Monorepo Layout`** section (at the top):
  - Summarise the two-peer structure: `typescript/` and `python/` are first-class siblings
  - Reference the root `README.md` for the overview

---

## Verification Criteria

- Running `uv run pytest python/tests/` from `submodules/forgecode-sdk/` exits 0 with all tests passing.
- Running `uv run mypy src/forgecode` reports no errors under `strict = true`.
- Running `uv run python examples/basic_query.py` (with a real `forge` binary on PATH) produces a `[session]` line followed by output and a `[result]` line.
- Running `uv run python examples/json_output.py` produces typed Pydantic fields (`expression`, `result`, `steps`) rather than a raw string.
- Running `uv run python examples/abort_query.py` terminates within 5 seconds and prints the abort message.
- Running `uv run python examples/error_handling.py` without forge on PATH prints the `ForgeBinaryNotFoundError` message and exits with code 1.
- `uv lock` completes without errors and `uv.lock` is committed.
- `python/.python-version` contains `3.11`.
- `src/forgecode/__init__.__all__` contains every symbol listed in Phase 4.
- The AGENTS.md `## Python SDK` section is present and references all 8 examples.
- Running `bun run typecheck` (or equivalent tsc invocation) from `submodules/forgecode-sdk/typescript/` exits 0 — confirming that the TypeScript restructure in Phase 0 introduced no broken path references.
- `git log --follow typescript/src/client.ts` inside the submodule shows history from before the Phase 0 move, confirming `git mv` was used rather than delete-and-create.
- Importing `@imbios/forgecode-sdk` from `packages/harness` and `apps/server` in the parent monorepo continues to resolve correctly (no changes required in consumer packages).

---

## Potential Risks and Mitigations

1. **`asyncio.create_subprocess_exec` buffering differences from `Bun.spawn`**
   The Python asyncio subprocess reads stdout as a stream of `bytes` chunks, not newline-delimited. A buffer-accumulation approach (split on `\n`, keep partial last line) must be used — identical to the TS decoder buffer pattern. Failing to handle partial lines will corrupt status-line detection.
   Mitigation: implement the `buffer + chunk; *lines, buffer = buffer.split("\n")` pattern (step 20j) and add a regression test in `test_client_helpers.py` with a fake stream that sends partial lines.

2. **Pydantic v2 `model_validate` vs Zod's `z.parse` error shapes**
   Pydantic v2 raises `pydantic.ValidationError` with an `errors()` list (dicts with `loc`, `msg`, `type`). When `verbose_errors=True`, the error message must serialize `err.errors()` rather than Zod `issues`. Consumers migrating from TS must adjust their error-handling code.
   Mitigation: document this difference in `python/README.md` and in the `OutputFormatJsonSchema` docstring.

3. **`asyncio.Event` semantics differ from `AbortController`**
   `AbortController.signal` can be checked synchronously (`signal.aborted`). `asyncio.Event.is_set()` is the Python equivalent and is also synchronous. The pre-check (step 20f) uses `abort_event.is_set()`. The watcher task (step 20h) uses `await abort_event.wait()`. These are direct equivalents.
   Mitigation: add an explicit test for the pre-set case and the mid-execution abort case.

4. **`uv.lock` checked into a git submodule**
   The submodule is a separate git repo (`submodules/forgecode-sdk`). The lockfile should be committed to that repo's own history, not the parent monorepo. This means the implementer must `git add uv.lock` inside the submodule directory.
   Mitigation: document in `python/README.md` that `uv.lock` is intentionally committed and must be regenerated after dependency changes.

5. **`forge` binary resolution on CI without the binary**
   Integration tests that call the real `forge` binary will be skipped by the `forge_path` fixture guard. If CI never has `forge` installed, integration tests are permanently skipped, giving false confidence.
   Mitigation: the `fake_forge_script` fixture provides a shell script that emulates forge output, allowing the full message-processing pipeline to be tested without the real binary.

6. **`asyncio_mode = "auto"` in pytest-asyncio**
   This mode marks all `async def test_*` functions as asyncio tests automatically, which is the least-friction approach but requires `pytest-asyncio >= 0.21`. Ensure the dev dependency pins `pytest-asyncio>=0.23` to avoid the deprecated `@pytest.mark.asyncio` requirement.
   Mitigation: pin explicitly in `pyproject.toml` dev group.

7. **Breaking parent-monorepo consumers via path-based imports after the Phase 0 move**
   `@alsafa/harness` (`packages/harness/src/session-runner.ts`) and `@alsafa/server` (`apps/server/src/chat.ts`) both import from the package name `@imbios/forgecode-sdk`. If either consumer were using a direct file-path import (e.g., `../../submodules/forgecode-sdk/src/client`) rather than the package name, the Phase 0 `git mv` would silently break it.
   Mitigation: before executing Phase 0, verify both files use only the bare package name `@imbios/forgecode-sdk` (no relative path escape). The package name, `exports` map, and `main` field in `typescript/package.json` are unchanged by the move, so package-name imports remain unaffected. If any path-based import is discovered, convert it to a package-name import before committing the restructure.

---

## Compatibility Notes (TypeScript → Python API Reference)

| Aspect                  | TypeScript SDK                              | Python SDK                                                      |
|-------------------------|---------------------------------------------|-----------------------------------------------------------------|
| Entry point             | `import { query } from "@imbios/forgecode-sdk"` | `from forgecode import query`                               |
| Async iteration         | `for await (const msg of query({prompt}))` | `async for msg in query(prompt):`                               |
| Prompt parameter        | `query({ prompt, options? })`              | `query(prompt, options=..., config=...)`                        |
| Schema validation       | `z: z.object({...})` (Zod)                 | `model: MyModel` (Pydantic `BaseModel` subclass)                |
| Abort mechanism         | `abortController: new AbortController()`   | `abort_event: asyncio.Event()`; call `.set()` to abort          |
| Option casing           | camelCase (`conversationId`)               | snake_case (`conversation_id`)                                  |
| `outputFormat` key      | `outputFormat`                             | `output_format`                                                 |
| Top-level `await`       | supported natively in Bun/Node             | requires `asyncio.run(main())`                                  |
| `process.stdout.write`  | `process.stdout.write(content)`            | `sys.stdout.write(content)` (no implicit newline)               |
| `import.meta.dir`       | resolves to script directory               | `Path(__file__).parent` or `os.path.dirname(__file__)`          |
| Unmapped CLI options    | `maxTurns`, `allowedTools`, etc. accepted  | same — accepted, logged at DEBUG, not yet wired to CLI args     |
| Examples location       | `typescript/examples/`                     | `python/examples/`                                              |
