# @imbios/forgecode-sdk — TypeScript SDK

TypeScript SDK for the [ForgeCode](https://github.com/tailcallhq/forgecode) CLI (`forge` binary). Wraps the `forge` CLI with a programmatic async-generator API that follows the Claude Agent SDK pattern.

## Installation

Requires [Bun](https://bun.sh/) >= 1.0.0 and the `forge` CLI binary installed.

```bash
# Install the SDK
bun add github:ImBIOS/forgecode-sdk

# Install forge (if not already installed)
curl -fsSL https://forgecode.dev/cli | sh
```

## Quickstart

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

## Binary resolution order

1. `FORGE_PATH` environment variable
2. `config.forgePath` (global config)
3. `~/.local/bin/forge`
4. `forge` on system PATH

## Examples

Run any example from `sdks/typescript/`:

```bash
bun install
bun run examples/basic-query.ts
```

| Example | Description |
|---|---|
| `examples/basic-query.ts` | Send a prompt and collect the result |
| `examples/json-output.ts` | Structured JSON with Zod validation |
| `examples/abort-query.ts` | Cancel with AbortController |
| `examples/tool-use.ts` | Capture tool use events |
| `examples/advanced-options.ts` | Model, maxTurns, env, systemPrompt |
| `examples/session-management.ts` | Continue and resume conversations |
| `examples/error-handling.ts` | Handle SDK errors gracefully |
| `examples/mcp-servers.ts` | Import MCP servers before a run |

## Development

```bash
bun install
bun run typecheck
bun run typecheck:examples
```
