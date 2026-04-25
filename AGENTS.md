# ForgeCode SDK

## Project Overview

TypeScript SDK that wraps the ForgeCode CLI binary (`forge`) with a programmatic API. Follows the Claude Agent SDK pattern where `query()` returns an async iterator of typed messages.

## Architecture

- **src/types.ts** — Type definitions: `ForgeMessage` union type, `QueryOptions`, `ForgeConfig`, error classes
- **src/client.ts** — Core implementation: binary resolution, process spawning via `Bun.spawn`, output parsing, message streaming
- **src/index.ts** — Public API barrel export

## Key Design Decisions

1. **Bun.spawn** for process management (not child_process)
2. **Text parsing** — ForgeCode outputs markdown to stdout; there is no `--output-format json` flag. The SDK parses text output, including JSON extraction from markdown fences.
3. **No permission flags** — `restricted = false` is the default in `.forge.toml`, so no `--dangerously-skip-permissions` is needed.
4. **Binary resolution** — Searches `FORGE_PATH` env var, `config.forgePath`, system PATH, then `~/.local/bin/forge`.
5. **OpenAI-compatible endpoints** — Configured via `OPENAI_URL` and `OPENAI_API_KEY` env vars passed to the forge process.

## Development

```bash
bun install
bun run typecheck
```

## Claude Agent SDK Compatibility

The `query()` function signature mirrors the Claude Agent SDK:

```ts
query({ prompt, options?: { agent?, conversationId?, sandbox?, cwd?, env?, outputFormat?, ... } })
  -> AsyncGenerator<ForgeMessage>
```

Message types: `SystemMessage`, `AssistantMessage`, `ResultMessage`, `ToolUseMessage`, `ErrorMessage`.
