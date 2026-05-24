# @imbios/forgecode-sdk — TypeScript SDK for ForgeCode AI Agent CLI

> Integrate AI agent capabilities into your TypeScript/Bun applications with async-generator streaming, type-safe validation, and MCP server support.

[![npm version](https://img.shields.io/npm/v/@imbios/forgecode-sdk)](https://www.npmjs.com/package/@imbios/forgecode-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official TypeScript SDK for the [ForgeCode](https://github.com/tailcallhq/forgecode) CLI. Provides a programmatic async-generator API for integrating AI agent capabilities into your TypeScript/Bun applications, following the Claude Agent SDK pattern.

## Installation

### Option A: From npm (recommended)

```bash
pnpm add @imbios/forgecode-sdk
```

### Option B: From GitHub (bleeding edge)

```bash
# Clone the repo and link locally
git clone https://github.com/ImBIOS/forgecode-sdk.git
cd forgecode-sdk/sdks/typescript
pnpm install

# Add as a local dependency in your project
pnpm add -D github:ImBIOS/forgecode-sdk
# Or link globally
pnpm add -g github:ImBIOS/forgecode-sdk
```

> **Note:** pnpm does not support subdirectory installs from git URLs. Use the local install above or publish to npm.

### Option C: From source

```bash
# Clone and link locally
git clone https://github.com/ImBIOS/forgecode-sdk.git
cd forgecode-sdk/sdks/typescript
pnpm install
bun run typecheck
```

**Requirements:**

- [Bun](https://bun.sh/) >= 1.0.0
- `forge` CLI binary installed

## Quick Start

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

## Key Features

- **Async generator streaming** — Real-time token-by-token response streaming with proper async iteration
- **Type-safe schema validation** — Zod validation for structured outputs and input validation
- **Session management** — Continue and resume conversations with conversation IDs
- **MCP server integration** — Import Model Context Protocol servers before agent runs
- **Tool use monitoring** — Capture and handle agent tool invocations in real-time
- **Abort support** — Cancel long-running queries with AbortController
- **Error handling** — Graceful error handling with detailed error types

## API Reference

### `query(prompt, options?)`

Main function to send prompts to the ForgeCode agent.

**Parameters:**

- `prompt: string` — The prompt to send to the agent
- `options?: QueryOptions` — Optional configuration

**Returns:** `AsyncGenerator<AgentMessage>`

### Message Types

| Type | Description |
|------|-------------|
| `system` | Contains session_id and metadata |
| `assistant` | Streamed response tokens |
| `tool_use` | Agent invoking a tool |
| `result` | Final execution result |
| `error` | Error information |

### QueryOptions

| Option | Type | Description |
|--------|------|-------------|
| `agent` | `string` | Agent name to use (default: "forge") |
| `model` | `string` | Model to use |
| `maxTurns` | `number` | Maximum conversation turns |
| `conversationId` | `string` | Continue existing conversation |
| `systemPrompt` | `string` | Custom system prompt |
| `env` | `Record<string, string>` | Environment variables |
| `outputFormat` | `OutputFormat` | Structured output configuration |

## Binary Resolution

The SDK locates the `forge` CLI using this resolution order:

1. `FORGE_PATH` environment variable
2. `config.forgePath` (global config)
3. `~/.local/bin/forge`
4. `forge` on system PATH

## Examples

| Example | Description |
|---------|-------------|
| `examples/basic-query.ts` | Send a prompt and collect the result |
| `examples/json-output.ts` | Structured JSON with Zod validation |
| `examples/abort-query.ts` | Cancel with AbortController |
| `examples/tool-use.ts` | Capture tool use events |
| `examples/advanced-options.ts` | Model, maxTurns, env, systemPrompt |
| `examples/session-management.ts` | Continue and resume conversations |
| `examples/error-handling.ts` | Handle SDK errors gracefully |
| `examples/mcp-servers.ts` | Import MCP servers before a run |

### Running Examples

```bash
bun install
bun run examples/basic-query.ts
```

## Development

```bash
# Install dependencies
bun install

# Type-check the SDK
bun run typecheck

# Type-check examples
bun run typecheck:examples

# Run all examples
bun run examples/basic-query.ts
```

## Related

- [Python SDK](https://github.com/ImBIOS/forgecode-sdk/tree/main/sdks/python) — Python alternative
- [ForgeCode CLI](https://github.com/tailcallhq/forgecode) — Official CLI documentation
- [Main README](https://github.com/ImBIOS/forgecode-sdk) — Monorepo overview
