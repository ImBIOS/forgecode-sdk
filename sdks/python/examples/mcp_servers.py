"""
MCP server integration — import MCP servers before running a query.

The SDK calls `forge mcp import` for each configured server before
starting the query. This makes the server's tools available to the agent.

Run: uv run python examples/mcp_servers.py
"""
import asyncio
import os
import sys

from forgecode import query


async def main() -> None:
    async for message in query(
        "What MCP tools are available to you? List them briefly.",
        options={
            "mcp_servers": {
                "my-filesystem": {
                    "command": "npx",
                    "args": ["-y", "@anthropic-ai/mcp-filesystem-server", "/tmp"],
                    "transport": "stdio",
                },
            },
            "cwd": os.getcwd(),
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