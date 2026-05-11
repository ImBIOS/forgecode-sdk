# ForgeCode SDK

Multi-language SDK monorepo for the [ForgeCode](https://github.com/tailcallhq/forgecode) CLI (`forge` binary). Both SDKs wrap the `forge` CLI with a programmatic async-generator API that follows the Claude Agent SDK pattern.

## Monorepo Layout

```
forgecode-sdk/
├── README.md             ← Root overview
├── AGENTS.md             ← Agent-facing guide (this file)
├── .gitignore
├── sdks/
│   ├── typescript/        ← TypeScript / Bun SDK
│   │   ├── src/
│   │   ├── examples/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── python/            ← Python / uv SDK
│       ├── src/forgecode/
│       ├── examples/
│       ├── tests/
│       ├── pyproject.toml
│       └── uv.lock
└── .relay/
    └── plans/             ← Implementation plans (alsafa workspace)
```

## Language SDKs

| Language | Location | Package name | Toolchain |
|---|---|---|---|
| TypeScript | `sdks/typescript/` | `@imbios/forgecode-sdk` | Bun + TypeScript |
| Python | `sdks/python/` | `forgecode-sdk` | `uv` + Pydantic v2 |

## Architecture

### TypeScript SDK

- **`sdks/typescript/src/types.ts`** — `ForgeMessage` union, `QueryOptions`, `ForgeConfig`, error classes
- **`sdks/typescript/src/client.ts`** — Binary resolution, `Bun.spawn`, output parsing, message streaming
- **`sdks/typescript/src/index.ts`** — Public API barrel export

### Python SDK

- **`sdks/python/src/forgecode/types.py`** — All message dataclasses, error classes, `QueryOptions`, `ForgeConfig`
- **`sdks/python/src/forgecode/client.py`** — Binary resolution, `asyncio.create_subprocess_exec`, output parsing
- **`sdks/python/src/forgecode/__init__.py`** — Public API barrel export

### Cross-language Design Decisions

1. **Process management** — TypeScript uses `Bun.spawn`; Python uses `asyncio.create_subprocess_exec`
2. **Text parsing** — ForgeCode outputs markdown to stdout; no `--output-format json` flag exists. The SDK parses text output, including JSON extraction from markdown fences.
3. **No permission flags** — `restricted = false` is the default in `.forge.toml`, so no `--dangerously-skip-permissions` is needed
4. **Binary resolution** — Same order in both: `FORGE_PATH` → `config.forgePath` → `~/.local/bin/forge` → system `PATH`
5. **Structured output** — Both SDKs call `extract_json_from_text()` on the final result text (not a CLI flag) to find JSON in markdown fences

### QueryOptions Crosswalk

| TypeScript | Python | Description |
|---|---|---|
| `agent` | `agent` | Agent ID |
| `conversationId` | *(unavailable)* | Conversation ID to resume |
| `sandbox` | *(unavailable)* | Git worktree sandbox name |
| `cwd` | `cwd` | Working directory for forge |
| `env` | `env` | Extra environment variables |
| `outputFormat` | `output_format` | `OutputFormat` with `model: BaseModel` |
| `reasoningEffort` | `reasoning_effort` | Reasoning effort level |
| `mcpServers` | `mcp_servers` | MCP servers to import |
| `allowedTools` | *(unavailable)* | Tools the agent may use |
| `systemPrompt` | `system_prompt` | System prompt |
| `abortController` | `abort_event: asyncio.Event` | Cancel the query |
| `model` | `model` | Claude model name |
| `maxTurns` | `max_turns` | Max conversation turns |
| `disallowedTools` | *(unavailable)* | Disallowed tool names |
| `tools` | *(unavailable)* | Available built-in tools |
| `continue` | `continue_` | Continue most recent conversation |
| `resume` | `resume` | Session ID to resume |
| `stderr` | `stderr: Callable[[str], None]` | Callback invoked with stderr data |
| `title` | `title` | Custom session title |

### API Pattern

Both SDKs use the same `async for` pattern:

```ts
// TypeScript
for await (const message of query({ prompt, options })) {
  if (message.type === "result") console.log(message.result);
}
```

```python
# Python
async for message in query("prompt", options={...}):
    if message.type == "result":
        print(message.result)
```

## Error Classes

| TypeScript | Python | Description |
|---|---|---|
| `ForgeBinaryNotFoundError` | `ForgeBinaryNotFoundError` | forge binary not found on PATH |
| `ForgeProcessError` | `ForgeProcessError` | forge exited with non-zero code |
| `ForgeOutputParseError` | *(internal only)* | JSON extraction failed |
| `ForgeAbortError` | *(yielded as error msg)* | Query was cancelled |

## Consumers

Both SDK packages are consumed by the parent `alsafa` workspace:

- **`@alsafa/harness`** — `packages/harness/src/session-runner.ts` (`SessionRunner.run`) imports `@imbios/forgecode-sdk`
- **`@alsafa/server`** — `apps/server/src/chat.ts` (chat handler) imports `@imbios/forgecode-sdk`
- **Python SDK consumers** — Not yet integrated; Python SDK is new

## Development

**TypeScript:**

```bash
cd sdks/typescript
bun install
bun run typecheck
bun run examples/basic-query.ts
```

**Python:**

```bash
cd sdks/python
uv sync --group dev
uv run mypy src/forgecode --strict
uv run pytest tests/
uv run python examples/basic_query.py
```
