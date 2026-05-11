# ForgeCode SDK — Multi-Language Monorepo

TypeScript and Python SDKs for the [ForgeCode](https://github.com/tailcallhq/forgecode) CLI (`forge` binary). Both packages wrap the `forge` CLI with a programmatic async-generator API that follows the Claude Agent SDK pattern.

## SDKs

| Language | Location | Package name | Toolchain |
|---|---|---|---|
| **TypeScript** | `sdks/typescript/` | `@imbios/forgecode-sdk` | Bun + TypeScript |
| **Python** | `sdks/python/` | `forgecode-sdk` | `uv` + Pydantic |

---

## TypeScript SDK

Quickstart:

```bash
cd sdks/typescript && bun install
```

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

For full API documentation, see [`sdks/typescript/README.md`](sdks/typescript/README.md).

---

## Python SDK

Requires Python >= 3.11.

```bash
cd sdks/python
uv sync
```

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

For full API documentation, see [`sdks/python/README.md`](sdks/python/README.md).

---

## Consumer Compatibility

Both SDK packages export from their respective language's package manager. The parent monorepo (`alsafa`) consumes `@imbios/forgecode-sdk` via the Bun workspace resolution — no file-path imports are used. Moving or restructuring the internal layout does not affect consumers as long as `package.json` `name` and `exports` fields remain unchanged.

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
uv run pytest
uv run mypy src/forgecode
uv run python examples/basic_query.py
```