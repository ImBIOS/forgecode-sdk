"""
Advanced options — model selection, environment variables, system prompt,
and stderr capture.

Run: uv run python examples/advanced_options.py
"""
import asyncio
import os
import sys

from forgecode import query


async def main() -> None:
    stderr_lines: list[str] = []

    def on_stderr(data: str) -> None:
        stderr_lines.append(data)
        sys.stderr.write(f"[forge:stderr] {data}")

    async for message in query(
        "What model are you? Reply in one sentence.",
        options={
            "model": "MiniMax-M2.7",
            "max_turns": 1,
            "system_prompt": "You are a concise assistant. Never use more than one sentence.",
            "cwd": os.getcwd(),
            "env": {
                "MY_CUSTOM_VAR": "hello-from-sdk",
            },
            "stderr": on_stderr,
        },
    ):
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