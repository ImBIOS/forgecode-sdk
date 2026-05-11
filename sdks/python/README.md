# forgecode-sdk (Python)

Python SDK for the [ForgeCode](https://github.com/tailcallhq/forgecode) CLI (`forge` binary). Wraps the `forge` CLI with a programmatic async-generator API that follows the Claude Agent SDK pattern.

Requires Python >= 3.11.

## Installation

```bash
uv add forgecode-sdk
```

Or from source:

```bash
uv sync
```

## Quickstart

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

## Examples

| Example | Description |
|---|---|
| `examples/basic_query.py` | Send a prompt and collect the result |
| `examples/json_output.py` | Structured JSON with Pydantic validation |
| `examples/abort_query.py` | Cancel with `asyncio.Event` |
| `examples/tool_use.py` | Capture tool use events |
| `examples/advanced_options.py` | Model, env, systemPrompt, stderr callback |
| `examples/session_management.py` | Continue and resume conversations |
| `examples/error_handling.py` | Handle SDK errors gracefully |
| `examples/mcp_servers.py` | Import MCP servers before a run |

## API differences from the TypeScript SDK

| Aspect | TypeScript SDK | Python SDK |
|---|---|---|
| Schema validation | `z: z.object({...})` (Zod) | `model: MyModel` (Pydantic `BaseModel`) |
| Abort mechanism | `abortController: new AbortController()` | `abort_event: asyncio.Event()` |
| Option casing | camelCase (`conversationId`) | snake_case (`conversation_id`) |
| `outputFormat` key | `outputFormat` | `output_format` |