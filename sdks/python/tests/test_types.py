"""Tests for the types module."""
from __future__ import annotations

import asyncio

import pytest
from pydantic import BaseModel

from forgecode import (
    AssistantMessage,
    BaseModel,
    ErrorMessage,
    ForgeBinaryNotFoundError,
    ForgeConfig,
    ForgeMessage,
    ForgeProcessError,
    QueryOptions,
    ReasoningEffort,
    ResultMessage,
    SystemMessage,
    ToolUseMessage,
    resolve_forge_path,
)


class TestResolveForgePath:
    """Tests for resolve_forge_path()."""

    def test_returns_path_when_forge_path_set(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """FORGE_PATH takes priority."""
        monkeypatch.setenv("FORGE_PATH", "/custom/forge")
        assert resolve_forge_path() == "/custom/forge"

    def test_returns_config_path_when_available(
        self,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: pytest.Path,
    ) -> None:
        """config.forge_path is used when FORGE_PATH is not set."""
        monkeypatch.delenv("FORGE_PATH", raising=False)
        config = ForgeConfig(forge_path="/config/forge")
        assert resolve_forge_path(config=config) == "/config/forge"

    def test_falls_back_to_path_when_no_forge_path_or_config(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Resolves 'forge' from PATH when no explicit path is configured."""
        monkeypatch.delenv("FORGE_PATH", raising=False)
        monkeypatch.setenv("PATH", "/usr/bin:/bin")
        result = resolve_forge_path()
        assert result is not None
        assert isinstance(result, str)


class TestQueryOptionsDefaults:
    """Tests for QueryOptions TypedDict defaults."""

    def test_all_keys_absent_by_default(self) -> None:
        """TypedDict keys are absent (None-like) when not provided."""
        opts: QueryOptions = {}
        assert "agent" not in opts
        assert "model" not in opts
        assert "max_turns" not in opts
        assert "cwd" not in opts
        assert "env" not in opts
        assert "abort_event" not in opts
        assert "stderr" not in opts
        assert "output_format" not in opts
        assert "mcp_servers" not in opts
        assert "continue_" not in opts
        assert "resume" not in opts
        assert "system_prompt" not in opts

    def test_system_prompt_type(self) -> None:
        """systemPrompt is a string."""
        opts: QueryOptions = {"system_prompt": "You are helpful."}
        assert opts["system_prompt"] == "You are helpful."


class TestMessageDataclasses:
    """Tests for the message dataclasses."""

    def test_system_message_requires_type_and_subtype(self) -> None:
        """SystemMessage requires type='system' and subtype='init'."""
        msg = SystemMessage(type="system", subtype="init", session_id="sess-1")
        assert msg.type == "system"
        assert msg.subtype == "init"
        assert msg.session_id == "sess-1"

    def test_assistant_message_requires_type(self) -> None:
        """AssistantMessage requires type='assistant'."""
        msg = AssistantMessage(type="assistant", content="Hello")
        assert msg.type == "assistant"
        assert msg.content == "Hello"

    def test_result_message_requires_type_and_session_id(self) -> None:
        """ResultMessage requires type='result' and session_id."""
        msg = ResultMessage(type="result", result="hello", session_id="sess-1")
        assert msg.result == "hello"
        assert msg.session_id == "sess-1"

    def test_result_message_with_usage(self) -> None:
        """ResultMessage can carry usage info."""
        msg = ResultMessage(
            type="result",
            result="done",
            session_id="sess-1",
            usage={"input_tokens": 100, "output_tokens": 50},
        )
        assert msg.usage is not None
        # usage is a dict in the dataclass
        assert msg.usage["input_tokens"] == 100

    def test_tool_use_message(self) -> None:
        """ToolUseMessage carries name and arguments."""
        msg = ToolUseMessage(
            type="tool_use",
            name="Read",
            arguments={"file": "auth.py"},
        )
        assert msg.name == "Read"
        assert msg.arguments == {"file": "auth.py"}

    def test_error_message_with_exit_code(self) -> None:
        """ErrorMessage can carry an exit code."""
        msg = ErrorMessage(type="error", error="it broke", exit_code=127)
        assert msg.error == "it broke"
        assert msg.exit_code == 127


class TestErrorClasses:
    """Tests for error classes."""

    def test_forge_binary_not_found_is_raised(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """ForgeBinaryNotFoundError is raised when forge is not found anywhere."""
        monkeypatch.delenv("FORGE_PATH", raising=False)
        monkeypatch.setenv("PATH", "/nonexistent-path-with-no-executables")
        monkeypatch.setenv("HOME", "/nonexistent-home")
        with pytest.raises(ForgeBinaryNotFoundError):
            resolve_forge_path()

    def test_forge_process_error_properties(self) -> None:
        """ForgeProcessError carries exit_code and stderr."""
        err = ForgeProcessError(exit_code=127, stderr="command not found")
        assert err.exit_code == 127
        assert "127" in str(err)

    def test_forge_process_error_message_truncates_stderr(self) -> None:
        """The error message truncates long stderr output."""
        long_stderr = "x" * 1000
        err = ForgeProcessError(exit_code=1, stderr=long_stderr)
        # Message is truncated to 500 chars
        assert len(err.stderr) == 1000
        assert len(str(err)) < 600


class TestForgeMessageUnion:
    """Tests for the ForgeMessage union type."""

    def test_system_message_is_in_union(self) -> None:
        """SystemMessage is part of ForgeMessage."""
        msg: ForgeMessage = SystemMessage(type="system", subtype="init", session_id="s")
        assert msg.type == "system"

    def test_assistant_message_is_in_union(self) -> None:
        """AssistantMessage is part of ForgeMessage."""
        msg: ForgeMessage = AssistantMessage(type="assistant", content="Hi")
        assert msg.content == "Hi"

    def test_result_message_is_in_union(self) -> None:
        """ResultMessage is part of ForgeMessage."""
        msg: ForgeMessage = ResultMessage(type="result", result="ok", session_id="s")
        assert msg.result == "ok"
