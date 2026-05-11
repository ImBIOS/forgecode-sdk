"""
Basic query — send a prompt and collect the result.

Run: uv run python examples/basic_query.py
"""
import asyncio
import sys

from forgecode import query


async def main() -> None:
    async for message in query("What is 2 + 2? Reply with just the number."):
        match message.type:
            case "system":
                print(f"[session] {message.session_id}")
            case "assistant":
                sys.stdout.write(message.content)
            case "result":
                print(f"\n[result] {message.result}")
            case "error":
                print(f"[error] {message.error}", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())