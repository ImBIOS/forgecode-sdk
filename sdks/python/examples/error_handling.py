"""
Error handling — catch and handle SDK errors gracefully.

The SDK yields specific error messages:
- ForgeBinaryNotFoundError — forge binary not found
- ForgeProcessError — forge exited with non-zero code
- ForgeOutputParseError — JSON extraction failed (internal, not yielded to caller)
- ForgeAbortError — query was cancelled

Run: uv run python examples/error_handling.py
"""
import asyncio
import sys

from forgecode import ForgeBinaryNotFoundError, query, resolve_forge_path


async def main() -> None:
    try:
        # Try to resolve the forge binary
        forge_path = resolve_forge_path()
        print(f"Forge binary found at: {forge_path}")

        # Run a query
        async for message in query("Say hello in exactly one word."):
            match message.type:
                case "result":
                    print(f"Result: {message.result}")
                case "error":
                    print(f"Forge error: {message.error}", file=sys.stderr)
    except ForgeBinaryNotFoundError:
        print("Forge binary not found!")
        print("Install forge or set FORGE_PATH environment variable.")
        sys.exit(1)
    except Exception as exc:
        print(f"Unexpected error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())