"""
Abort a long-running query using asyncio.Event.

The SDK watches the abort_event and kills the forge process when set().
An error message is yielded and the generator terminates.

Run: uv run python examples/abort_query.py
"""
import asyncio
import sys

from forgecode import query


async def main() -> None:
    abort_event = asyncio.Event()

    async def abort_after(seconds: float) -> None:
        await asyncio.sleep(seconds)
        print("[abort] Cancelling query...")
        abort_event.set()

    asyncio.create_task(abort_after(3))

    async for message in query(
        "Write a detailed 5000-word essay on the history of computing.",
        options={"abort_event": abort_event},
    ):
        match message.type:
            case "system":
                print(f"[session] {message.session_id}")
            case "assistant":
                sys.stdout.write(message.content)
            case "error":
                print(f"\n[error] {message.error}", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())