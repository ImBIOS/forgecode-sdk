# forgecode-sdk — Python SDK for ForgeCode AI Agent CLI

> Integrate AI agent capabilities into your Python applications with async-generator streaming, Pydantic validation, and MCP server support.

[![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official Python SDK for the [ForgeCode](https://github.com/tailcallhq/forgecode) CLI. Provides a programmatic async-generator API for integrating AI agent capabilities into your Python applications, following the Claude Agent SDK pattern.

## Installation
## Installation

> **Note:** This SDK is installed directly from GitHub. PyPI packages are not yet published.

### From GitHub (recommended)

```bash
# Install from GitHub using uv (recommended)
uv add git+https://github.com/ImBIOS/forgecode-sdk.git#subdirectory=sdks/python

# Or with pip
pip install git+https://github.com/ImBIOS/forgecode-sdk.git#subdirectory=sdks/python
```

### From source

```bash
# Clone and install from source
git clone https://github.com/ImBIOS/forgecode-sdk.git
cd forgecode-sdk/sdks/python

# With uv (recommended)
uv sync --group dev

# Or with pip
pip install -e .
```

**Requirements:**
- Python >= 3.11
- `forge` CLI binary installed
## Quick Start

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

## Key Features

- **Async generator streaming** — Real-time token-by-token response streaming with proper async iteration
- **Type-safe schema validation** — Pydantic models for structured outputs and input validation
- **Session management** — Continue and resume conversations with conversation IDs
- **MCP server integration** — Import Model Context Protocol servers before agent runs
- **Tool use monitoring** — Capture and handle agent tool invocations in real-time
- **Abort support** — Cancel long-running queries with `asyncio.Event`
- **Error handling** — Graceful error handling with detailed error types

## API Reference

### `query(prompt, options?)`

Main function to send prompts to the ForgeCode agent.

**Parameters:**

- `prompt: str` — The prompt to send to the agent
- `options?: QueryOptions` — Optional configuration

**Returns:** `AsyncGenerator[AgentMessage]`

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
| `agent` | `str` | Agent name to use (default: "forge") |
| `model` | `str` | Model to use |
| `max_turns` | `int` | Maximum conversation turns |
| `conversation_id` | `str` | Continue existing conversation |
| `system_prompt` | `str` | Custom system prompt |
| `env` | `dict[str, str]` | Environment variables |
| `output_format` | `OutputFormat` | Structured output configuration |

## Differences from TypeScript SDK

| Aspect | TypeScript SDK | Python SDK |
|--------|----------------|------------|
| Schema validation | `z: z.object({...})` (Zod) | `model: MyModel` (Pydantic `BaseModel`) |
| Abort mechanism | `abortController: new AbortController()` | `abort_event: asyncio.Event()` |
| Option casing | camelCase (`conversationId`) | snake_case (`conversation_id`) |
| `outputFormat` key | `outputFormat` | `output_format` |

## Examples

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

### Running Examples

```bash
uv sync --group dev
uv run python examples/basic_query.py
```

## Development

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

## Related

- [TypeScript SDK](https://github.com/ImBIOS/forgecode-sdk/tree/main/sdks/typescript) — TypeScript alternative
- [ForgeCode CLI](https://github.com/tailcallhq/forgecode) — Official CLI documentation
- [Main README](https://github.com/ImBIOS/forgecode-sdk) — Monorepo overview
