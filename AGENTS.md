# ForgeCode SDK

## Project Overview

TypeScript SDK that wraps the ForgeCode CLI binary (`forge`) with a programmatic API. Follows the Claude Agent SDK pattern where `query()` returns an async iterator of typed messages.

## Architecture

- **src/types.ts** — Type definitions: `ForgeMessage` union type, `QueryOptions`, `ForgeConfig`, error classes
- **src/client.ts** — Core implementation: binary resolution, process spawning via `Bun.spawn`, output parsing, message streaming
- **src/index.ts** — Public API barrel export
- **examples/** — Runnable usage examples (see below)

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

### QueryOptions

| Option            | Type                                  | Description                                                                                                                                                                                             |
| ----------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent`           | `string`                              | Agent ID. Maps to `forge --agent <id>`.                                                                                                                                                                 |
| `conversationId`  | `string`                              | Conversation ID to resume. Maps to `forge --conversation-id <id>`.                                                                                                                                      |
| `sandbox`         | `string`                              | Git worktree sandbox name. Maps to `forge --sandbox <name>`.                                                                                                                                            |
| `cwd`             | `string`                              | Working directory. Maps to `forge --directory <path>`.                                                                                                                                                  |
| `env`             | `Record<string, string \| undefined>` | Extra environment variables for the forge process.                                                                                                                                                      |
| `outputFormat`    | `OutputFormat`                        | Structured output request. When `type: 'json_schema'`, the SDK attempts to extract JSON from the final result text using `extractJsonFromText()`. If parsing fails, the raw text is returned unchanged. |
| `reasoningEffort` | `ReasoningEffort`                     | Reasoning effort level (none/minimal/low/medium/high/xhigh/max).                                                                                                                                        |
| `mcpServers`      | `Record<string, McpServerConfig>`     | MCP servers to import before the run via `forge mcp import`.                                                                                                                                            |
| `allowedTools`    | `string[]`                            | Tools the agent is allowed to use.                                                                                                                                                                      |
| `systemPrompt`    | `string`                              | System prompt prepended to the user prompt.                                                                                                                                                             |
| `abortController` | `AbortController`                     | Cancel the query. Kills the forge process on abort.                                                                                                                                                     |
| `model`           | `string`                              | Claude model to use. Maps to `FORGE_MODEL` env var. Overrides `config.model`.                                                                                                                           |
| `maxTurns`        | `number`                              | Max conversation turns. Maps to `forge --max-turns <n>`.                                                                                                                                                |
| `disallowedTools` | `string[]`                            | Disallowed tool names. Maps to `forge --disallowed-tools`.                                                                                                                                              |
| `tools`           | `string[]`                            | Available built-in tools. Maps to `forge --tools`. Empty array disables all.                                                                                                                            |
| `continue`        | `boolean`                             | Continue most recent conversation. Maps to `forge --continue`.                                                                                                                                          |
| `resume`          | `string`                              | Session ID to resume. Maps to `forge --resume <id>`.                                                                                                                                                    |
| `stderr`          | `(data: string) => void`              | Callback invoked with stderr data as it arrives.                                                                                                                                                        |
| `title`           | `string`                              | Custom session title. Maps to `forge --title <title>`.                                                                                                                                                  |

### outputFormat Behavior

When `options.outputFormat` is set with `type: 'json_schema'`, the SDK does **not** pass it to the forge CLI (there is no `--output-format` flag). Instead, after the process completes, the SDK calls `extractJsonFromText()` on the final result. This attempts to find valid JSON in markdown fences or raw text. If extraction succeeds, the result's `result` field contains the JSON string. If it fails, the raw text is returned unchanged.

### Error Classes

- `ForgeBinaryNotFoundError` — forge binary not found on PATH
- `ForgeProcessError` — forge exited with non-zero code
- `ForgeOutputParseError` — output format parsing failed
- `ForgeAbortError` — query was cancelled via AbortController

### Message Types

- `SystemMessage` — session initialization (type: "system", subtype: "init", session_id)
- `AssistantMessage` — streaming text chunk (type: "assistant", content)
- `ResultMessage` — final result (type: "result", result, session_id, usage?)
- `ToolUseMessage` — tool call (type: "tool_use", name, arguments)
- `ErrorMessage` — error (type: "error", error, exitCode?)

## Examples

All examples are in `examples/` and can be run with `bun run examples/<name>.ts`:

| Example                 | What it demonstrates                                      |
| ----------------------- | --------------------------------------------------------- |
| `basic-query.ts`        | Send a prompt, iterate over messages, collect result      |
| `json-output.ts`        | Request structured JSON with schema, parse the result     |
| `abort-query.ts`        | Cancel a long-running query with AbortController          |
| `tool-use.ts`           | Capture tool_use events during execution                  |
| `advanced-options.ts`   | Model selection, maxTurns, env vars, systemPrompt, stderr |
| `session-management.ts` | Continue and resume conversations by session ID           |
| `error-handling.ts`     | Handle ForgeBinaryNotFoundError and other errors          |
| `mcp-servers.ts`        | Import MCP servers before running a query                 |

## Consumers

This SDK is consumed by:

- `@alsafa/harness` — `packages/harness/src/session-runner.ts` (SessionRunner.run)
- `@alsafa/server` — `apps/server/src/chat.ts` (chat handler)
