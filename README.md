# @imbios/forgecode-sdk

TypeScript SDK for the [ForgeCode](https://github.com/tailcallhq/forgecode) CLI (`forge` binary). Wraps the `forge` CLI with a programmatic async-generator API that follows the Claude Agent SDK pattern.

## Quickstart

```bash
bun add github:ImBIOS/forgecode-sdk
```

> [!NOTE]
> Not publishing to npm is good enough for our company use-case, you can request me to publish it, just vote in GitHub issues of this repo.

```ts
import { query } from "@imbios/forgecode-sdk";

for await (const message of query({
  prompt: "Fix the bug in auth.ts",
  options: { agent: "forge" },
})) {
  switch (message.type) {
    case "system":
      console.log(`Session: ${message.session_id}`);
      break;
    case "assistant":
      process.stdout.write(message.content);
      break;
    case "result":
      console.log("\nDone:", message.result);
      break;
    case "error":
      console.error("Error:", message.error);
      break;
  }
}
```

## Installation

Requires [Bun](https://bun.sh/) >= 1.0.0 and the `forge` CLI binary installed.

```bash
# Install the SDK
bun add github:ImBIOS/forgecode-sdk

# Install forge (if not already installed)
curl -fsSL https://forgecode.dev/cli | sh
```

The SDK resolves the `forge` binary in this order:

1. `FORGE_PATH` environment variable
2. `config.forgePath` (global config)
3. `~/.local/bin/forge`
4. `forge` on system PATH

## API

### `query(params, config?)`

The main entry point. Spawns the `forge` binary and yields typed messages as they arrive.

```ts
import type { ForgeMessage, QueryOptions, ForgeConfig } from "@imbios/forgecode-sdk";

for await (const message of query({
  prompt: string,
  options?: QueryOptions,
}, config?: ForgeConfig)): ForgeMessage { ... }
```

### Message Types

| Type        | Fields                                                                              | Description                          |
| ----------- | ----------------------------------------------------------------------------------- | ------------------------------------ |
| `system`    | `subtype: "init"`, `session_id: string`                                             | Emitted at session start             |
| `assistant` | `content: string`                                                                   | Streaming text chunk from the agent  |
| `result`    | `result: string`, `session_id: string`, `usage?: { input_tokens?, output_tokens? }` | Final result when the agent finishes |
| `tool_use`  | `name: string`, `arguments: Record<string, unknown>`                                | Tool call performed during execution |
| `error`     | `error: string`, `exitCode?: number`                                                | Error encountered during execution   |

### QueryOptions

| Option            | Type                                                                     | Description                                                          |
| ----------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `agent`           | `string`                                                                 | Agent ID. Maps to `forge --agent <id>`                               |
| `model`           | `string`                                                                 | Model to use. Maps to `FORGE_MODEL` env var                          |
| `systemPrompt`    | `string`                                                                 | Prepended to the user prompt                                         |
| `cwd`             | `string`                                                                 | Working directory. Maps to `forge --directory <path>`                |
| `env`             | `Record<string, string \| undefined>`                                    | Environment variables for the forge process                          |
| `outputFormat`    | `{ type: "json_schema", z: ZodType, verboseErrors?: boolean }`           | Structured JSON output with Zod validation                           |
| `maxTurns`        | `number`                                                                 | Max conversation turns. Maps to `forge --max-turns <n>`              |
| `allowedTools`    | `string[]`                                                               | Tools the agent is allowed to use                                    |
| `disallowedTools` | `string[]`                                                               | Disallowed tool names. Maps to `forge --disallowed-tools`            |
| `tools`           | `string[]`                                                               | Available built-in tools. Maps to `forge --tools`. `[]` disables all |
| `continue`        | `boolean`                                                                | Continue most recent conversation. Maps to `forge --continue`        |
| `resume`          | `string`                                                                 | Session ID to resume. Maps to `forge --resume <id>`                  |
| `conversationId`  | `string`                                                                 | Conversation ID. Maps to `forge --conversation-id <id>`              |
| `sandbox`         | `string`                                                                 | Git worktree sandbox name. Maps to `forge --sandbox <name>`          |
| `reasoningEffort` | `"none" \| "minimal" \| "low" \| "medium" \| "high" \| "xhigh" \| "max"` | Reasoning effort level                                               |
| `mcpServers`      | `Record<string, McpServerConfig>`                                        | MCP servers to import before the run                                 |
| `abortController` | `AbortController`                                                        | Cancel the query (kills forge process)                               |
| `stderr`          | `(data: string) => void`                                                 | Real-time stderr callback                                            |
| `title`           | `string`                                                                 | Custom session title. Maps to `forge --title <title>`                |

### ForgeConfig (Global)

```ts
const config: ForgeConfig = {
  forgePath?: string,      // Explicit binary path
  openaiUrl?: string,      // API base URL (OPENAI_URL env var)
  openaiApiKey?: string,   // API key (OPENAI_API_KEY env var)
  model?: string,          // Default model (FORGE_MODEL env var)
  reasoningEffort?: ReasoningEffort,
};

// Pass as second argument to query()
for await (const msg of query({ prompt: "..." }, config)) { ... }
```

### Helper Functions

#### `resolveForgePath(config?)`

Returns the resolved path to the `forge` binary. Throws `ForgeBinaryNotFoundError` if not found.

```ts
import { resolveForgePath } from "@imbios/forgecode-sdk";
const path = resolveForgePath(); // "/home/user/.local/bin/forge"
```

#### `extractJsonFromText(text)`

Attempts to extract a JSON object from text that may contain markdown fences or surrounding text. Tries four strategies in order:

1. ` ```json ... ``` ` fenced block
2. ` ``` ... ``` ` generic fenced block
3. First `{` ... last `}` substring
4. Entire text as JSON

````ts
import { extractJsonFromText } from "@imbios/forgecode-sdk";
const obj = extractJsonFromText('Here is the result:\n```json\n{"x": 1}\n```');
// obj === { x: 1 }
````

### Error Classes

| Class                      | When                                |
| -------------------------- | ----------------------------------- |
| `ForgeBinaryNotFoundError` | `forge` binary not found on PATH    |
| `ForgeProcessError`        | Forge exited with non-zero code     |
| `ForgeOutputParseError`    | JSON extraction from output failed  |
| `ForgeAbortError`          | Query cancelled via AbortController |

## Examples

| Example                                                 | Description                                                 |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| [basic-query.ts](examples/basic-query.ts)               | Send a prompt and collect the result                        |
| [json-output.ts](examples/json-output.ts)               | Request structured JSON output with schema validation       |
| [abort-query.ts](examples/abort-query.ts)               | Cancel a long-running query with AbortController            |
| [tool-use.ts](examples/tool-use.ts)                     | Capture tool use events during execution                    |
| [advanced-options.ts](examples/advanced-options.ts)     | Model selection, max turns, env vars, system prompt, stderr |
| [session-management.ts](examples/session-management.ts) | Continue and resume conversations                           |
| [error-handling.ts](examples/error-handling.ts)         | Handle SDK errors gracefully                                |
| [mcp-servers.ts](examples/mcp-servers.ts)               | Import MCP servers before a query                           |

Run any example:

```bash
bun run examples/basic-query.ts
```

## How outputFormat Works

The `forge` CLI has no `--output-format` flag. The SDK handles structured output by:

1. Injecting a system prompt that instructs the agent to produce JSON matching the `z` schema
2. Auto-deriving a JSON Schema from `z` via `z.toJSONSchema(z)` for the agent's benefit
3. After the process completes, calling `extractJsonFromText()` on the final output
4. If `z` is a `ZodType`, validating the extracted JSON with `z.parse()` — throws a clear error with Zod issues on failure
5. Yielding `message.result` as a fully typed object (no extra `JSON.parse` needed)

```ts
// zodSchema → typed result object (no JSON.parse needed)
outputFormat: { type: "json_schema", z: z.object({ name: z.string() }) }

// no schema → result is a string
outputFormat: { type: "json_schema" }
```

## Claude Agent SDK Compatibility

The SDK follows the same mental model as `@anthropic-ai/claude-agent-sdk`:

```ts
// Claude Agent SDK
import { query } from "@anthropic-ai/claude-agent-sdk";
for await (const msg of query({ prompt, options })) { ... }

// ForgeCode SDK (same pattern)
import { query } from "@imbios/forgecode-sdk";
for await (const msg of query({ prompt, options })) { ... }
```

Key differences from Claude Agent SDK:

- ForgeCode SDK uses `Bun.spawn` (requires Bun runtime)
- No permission system (forge runs autonomously)
- No hook system (PreToolUse, PostToolUse, etc.)
- No session management API (listSessions, getSessionMessages, etc.)
- `outputFormat` is post-processed, not enforced by the API
- `systemPrompt` is a string (not array/preset object)

## Development

```bash
bun install
bun run typecheck
```
