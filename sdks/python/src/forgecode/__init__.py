"""
@module forgecode

Python SDK for the ForgeCode CLI (forge binary).

Wraps the ``forge`` CLI with a programmatic async-generator API that follows
the Claude Agent SDK pattern.

Example::

    import asyncio
    from forgecode import query

    async def main():
        async for message in query("Fix the bug in auth.py"):
            match message.type:
                case "system": print(f"Session: {message.session_id}")
                case "assistant": print(message.content, end="")
                case "result": print(f"Done: {message.result}")
                case "error": print(f"Error: {message.error}", file=__import__("sys").stderr)

    asyncio.run(main())
"""

from .client import query, resolve_forge_path, extract_json_from_text
from .types import (
    # Messages
    SystemMessage,
    AssistantMessage,
    ResultMessage,
    ToolUseMessage,
    ErrorMessage,
    ForgeMessage,
    ForgeMessageStr,
    UsageInfo,
    # Config / enums
    ReasoningEffort,
    OutputFormatJsonSchema,
    OutputFormat,
    QueryOptions,
    McpServerConfig,
    ForgeConfig,
    # Errors
    ForgeBinaryNotFoundError,
    ForgeProcessError,
    ForgeOutputParseError,
    ForgeAbortError,
    # Re-export BaseModel for consumers defining schemas
    BaseModel,
)

__version__ = "0.1.0"

__all__ = [
    # From client
    "query",
    "resolve_forge_path",
    "extract_json_from_text",
    # From types — messages
    "SystemMessage",
    "AssistantMessage",
    "ResultMessage",
    "ToolUseMessage",
    "ErrorMessage",
    "ForgeMessage",
    "ForgeMessageStr",
    "UsageInfo",
    # From types — config / enums
    "ReasoningEffort",
    "OutputFormatJsonSchema",
    "OutputFormat",
    "QueryOptions",
    "McpServerConfig",
    "ForgeConfig",
    # From types — errors
    "ForgeBinaryNotFoundError",
    "ForgeProcessError",
    "ForgeOutputParseError",
    "ForgeAbortError",
    # Re-export BaseModel for consumers defining schemas
    "BaseModel",
]