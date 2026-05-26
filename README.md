# ForgeCode SDK — Official TypeScript & Python SDKs for AI Agent Integration

> Build powerful AI-powered applications with async-generator streaming, session management, and MCP server integration.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)](https://www.python.org/)

**ForgeCode SDK** provides official language-specific libraries for integrating with the [ForgeCode](https://github.com/tailcallhq/forgecode) CLI (`forge` binary) in your applications. Built for developers who want programmatic access to AI agent capabilities using async-generator patterns that follow the Claude Agent SDK specification.

## Key Features

- **Multi-language support** — Official TypeScript and Python SDKs with identical API patterns
- **Async generator streaming** — Real-time streaming of agent responses with proper async iteration
- **Type-safe schemas** — Zod validation (TypeScript) and Pydantic models (Python) for structured outputs
- **Session management** — Continue and resume conversations across multiple interactions
- **MCP server integration** — Import Model Context Protocol servers before agent runs
- **Tool use capture** — Monitor and handle agent tool invocations in real-time
- **Error handling** — Graceful error handling with detailed error types and recovery options

## Supported Languages

| Language | Package | Install |
|----------|---------|---------|
| **TypeScript** | `@imbios/forgecode-sdk` | `pnpm add github:ImBIOS/forgecode-sdk#sdks/typescript` |
| **Python** | `forgecode-sdk` | `uv add git+https://github.com/ImBIOS/forgecode-sdk#subdirectory=sdks/python` |

## Installation

> **Note:** Both SDKs are installed directly from GitHub. PyPI and npm packages are not yet published.

### TypeScript SDK

```bash
# Install from GitHub
pnpm add github:ImBIOS/forgecode-sdk#sdks/typescript

# Or with npm
npm install github:ImBIOS/forgecode-sdk#sdks/typescript
```

> **Note:** requires a special syntax for subdirectory installs. The `#sdks/typescript` fragment is required.

**Requires:** Bun >= 1.0.0

### Python SDK

```bash
# Install from GitHub using uv (recommended)
uv add git+https://github.com/ImBIOS/forgecode-sdk#subdirectory=sdks/python

# Or with pip
pip install git+https://github.com/ImBIOS/forgecode-sdk.git#subdirectory=sdks/python
```

**Requires:** Python >= 3.11

## Quick Start

### TypeScript

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

### Python

```python
import asyncio
from forgecode import query

async def main():
    async for message in query("What is 2 + 2? Reply with just the number."):
        match message.type:
            case "system": print(f"[session] {message.session_id}")
            case "assistant": print(message.content, end="")
            case "result": print(f"\n[result] {message.result}")
            case "error": print(f"[error] {message.error}", file=__import__("sys").stderr)

asyncio.run(main())
```

## Common Use Cases

- **AI-powered automation scripts** — Build automation tools powered by AI agents
- **CI/CD pipeline integration** — Integrate AI code review and fixes into build pipelines
- **Developer tooling** — Create IDE extensions and CLI tools with AI capabilities
- **Chatbot applications** — Build conversational AI interfaces with streaming responses
- **Code generation services** — Integrate AI code generation into your services
- **AI agent orchestration** — Build multi-agent workflows with session persistence

## Documentation

- [TypeScript SDK Guide](sdks/typescript/README.md) — Complete TypeScript SDK documentation
- [Python SDK Guide](sdks/python/README.md) — Complete Python SDK documentation
- [ForgeCode CLI](https://github.com/tailcallhq/forgecode) — Official CLI documentation

## SDK Examples

### TypeScript Examples

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

### Python Examples

| Example | Description |
|---------|-------------|
| `examples/basic_query.py` | Send a prompt and collect the result |
| `examples/json_output.py` | Structured JSON with Pydantic validation |
| `examples/abort_query.py` | Cancel with `asyncio.Event` |
| `examples/tool_use.py` | Capture tool use events |
| `examples/advanced_options.py` | Model, env, systemPrompt, stderr callback |
| `examples/session_management.py` | Continue and resume conversations |
| `examples/error_handling.py` | Handle SDK errors gracefully |
| `examples/mcp_servers.py` | Import MCP servers before a run |

## Architecture

Both SDKs wrap the `forge` CLI binary and expose a streaming async-generator API. The design follows the Claude Agent SDK pattern, providing:

- **Message streaming** — Real-time token-by-token response streaming
- **Session management** — Conversation context persistence and resumption
- **Schema validation** — Type-safe input/output validation
- **Error recovery** — Detailed error types for graceful failure handling

## Binary Resolution

The SDK locates the `forge` CLI using this resolution order:

1. `FORGE_PATH` environment variable
2. `config.forgePath` (global config)
3. `~/.local/bin/forge`
4. `forge` on system PATH

## Development

### TypeScript SDK

```bash
cd sdks/typescript
pnpm install
bun run typecheck
bun run examples/basic-query.ts
```

### Python SDK

```bash
cd sdks/python
uv sync --group dev
uv run pytest
uv run python examples/basic_query.py
```

## License

MIT License — see individual SDK directories for details.
