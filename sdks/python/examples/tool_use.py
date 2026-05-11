"""
Capture tool use events during a query.

When forge runs in verbose mode, tool executions appear as status lines
in stdout. The SDK parses these into `tool_use` messages with the
tool name and arguments.

Run: uv run python examples/tool_use.py
"""
import asyncio
import os
import sys

from forgecode import query


async def main() -> None:
    tool_calls: list[dict[str, object]] = []

    async for message in query(
        "List the files in the current directory, then read package.json.",
        options={"cwd": os.getcwd()},
    ):
        match message.type:
            case "system":
                print(f"[session] {message.session_id}")
            case "assistant":
                sys.stdout.write(message.content)
            case "tool_use":
                tool_calls.append({"name": message.name, "args": message.arguments})
                print(f"\n[tool_use] {message.name}({message.arguments})")
            case "result":
                print(f"\n[result] {message.result[:200]}...")
            case "error":
                print(f"[error] {message.error}", file=sys.stderr)

    print(f"\nTotal tool calls: {len(tool_calls)}")
    for call in tool_calls:
        print(f"  - {call['name']}")


if __name__ == "__main__":
    asyncio.run(main())