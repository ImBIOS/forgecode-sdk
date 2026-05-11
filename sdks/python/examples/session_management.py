"""
Session management — continue and resume conversations.

- `continue_: True` resumes the most recent conversation in the cwd.
- `resume: "<session-id>"` resumes a specific session by ID.

Run: uv run python examples/session_management.py
"""
import asyncio
import os
import sys

from forgecode import query


async def main() -> None:
    session_id = ""

    # First query — creates a new session
    print("=== First query ===")

    async for message in query(
        "My favorite color is blue. Remember this.",
        options={"cwd": os.getcwd()},
    ):
        match message.type:
            case "system":
                session_id = message.session_id
                print(f"[session] Started: {session_id}")
            case "assistant":
                sys.stdout.write(message.content)
            case "result":
                print(f"\n[result] {message.result}")

    # Resume the same session by ID
    print("\n=== Resumed query ===")

    async for message in query(
        "What is my favorite color?",
        options={"resume": session_id, "cwd": os.getcwd()},
    ):
        match message.type:
            case "system":
                print(f"[session] Resumed: {message.session_id}")
            case "assistant":
                sys.stdout.write(message.content)
            case "result":
                print(f"\n[result] {message.result}")
            case "error":
                print(f"[error] {message.error}", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())