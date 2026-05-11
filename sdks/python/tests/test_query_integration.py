"""Integration tests for the query() async generator.

These tests use mock forge scripts written to temporary files.
They do NOT require an actual forge binary — forge_path is always
explicitly supplied via the options dict.
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest

from forgecode import ForgeBinaryNotFoundError, query
from forgecode.client import resolve_forge_path


class TestResolveForgePath:
    """Tests for resolve_forge_path() function."""

    def test_raises_when_forge_not_in_path(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """resolve_forge_path() raises ForgeBinaryNotFoundError when forge is not found."""
        # Remove FORGE_PATH and set a PATH that contains no executables
        monkeypatch.delenv("FORGE_PATH", raising=False)
        monkeypatch.setenv("PATH", "/nonexistent-path-with-no-executables")
        # Also stub out ~/.local/bin/forge so that path is not found
        monkeypatch.setenv("HOME", "/nonexistent-home")
        with pytest.raises(ForgeBinaryNotFoundError):
            resolve_forge_path()

    def test_forge_path_env_takes_priority(
        self,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        """FORGE_PATH environment variable takes priority over PATH."""
        fake_forge = tmp_path / "fake_forge"
        fake_forge.write_text("#!/bin/sh\necho '{}'\n", encoding=None)
        os.chmod(fake_forge, 0o755)

        monkeypatch.setenv("FORGE_PATH", str(fake_forge))
        monkeypatch.setenv("PATH", "/nonexistent")

        assert resolve_forge_path() == str(fake_forge)


class TestQueryIntegration:
    """Integration tests for the query() generator with a mock forge script.

    forge_path is always passed explicitly in options so we never rely
    on resolve_forge_path() finding a system binary.
    """

    def _write_forge_script(self, tmp_path: Path, lines: str) -> Path:
        script = tmp_path / "forge"
        script.write_text("#!/bin/sh\n" + lines, encoding=None)
        os.chmod(script, 0o755)
        return script

    async def test_yields_system_message(self, tmp_path: Path) -> None:
        """query() yields a system message with session_id."""
        script = self._write_forge_script(
            tmp_path,
            "echo '{\"type\":\"system\",\"subtype\":\"init\",\"session_id\":\"sess-abc\"}'\n"
            "echo '{\"type\":\"result\",\"result\":\"ok\",\"session_id\":\"sess-abc\"}'\n"
            "exit 0\n",
        )
        messages: list = []
        async for msg in query(
            "hello",
            options={"cwd": str(tmp_path), "forge_path": str(script)},
        ):
            messages.append(msg)

        types = [m.type for m in messages]
        assert "system" in types
        system_msg = next(m for m in messages if m.type == "system")
        assert system_msg.session_id == "sess-abc"

    async def test_yields_assistant_message(self, tmp_path: Path) -> None:
        """query() yields assistant messages for streamed text."""
        script = self._write_forge_script(
            tmp_path,
            "echo '{\"type\":\"system\",\"subtype\":\"init\",\"session_id\":\"sess-1\"}'\n"
            "echo '{\"type\":\"assistant\",\"content\":\"Hello there\"}'\n"
            "echo '{\"type\":\"result\",\"result\":\"done\",\"session_id\":\"sess-1\"}'\n"
            "exit 0\n",
        )
        messages: list = []
        async for msg in query(
            "hi",
            options={"cwd": str(tmp_path), "forge_path": str(script)},
        ):
            messages.append(msg)

        assistant_messages = [m for m in messages if m.type == "assistant"]
        assert len(assistant_messages) == 1
        assert "Hello there" in assistant_messages[0].content

    async def test_yields_result_message(self, tmp_path: Path) -> None:
        """query() yields a result message when forge completes."""
        script = self._write_forge_script(
            tmp_path,
            "echo '{\"type\":\"system\",\"subtype\":\"init\",\"session_id\":\"sess-1\"}'\n"
            "echo '{\"type\":\"result\",\"result\":\"the-answer\",\"session_id\":\"sess-1\"}'\n"
            "exit 0\n",
        )
        result_value: str | None = None
        async for msg in query(
            "answer",
            options={"cwd": str(tmp_path), "forge_path": str(script)},
        ):
            if msg.type == "result":
                result_value = msg.result

        assert result_value == "the-answer"

    async def test_yields_error_on_nonzero_exit(self, tmp_path: Path) -> None:
        """A non-zero forge exit code produces an error message."""
        script = self._write_forge_script(
            tmp_path,
            "echo '{\"type\":\"system\",\"subtype\":\"init\",\"session_id\":\"sess-1\"}'\n"
            "echo '{\"type\":\"error\",\"error\":\"it-broke\"}' >&2\n"
            "exit 1\n",
        )
        error_messages: list = []
        async for msg in query(
            "break",
            options={"cwd": str(tmp_path), "forge_path": str(script)},
        ):
            if msg.type == "error":
                error_messages.append(msg)

        assert len(error_messages) >= 1
        assert any("it-broke" in e.error for e in error_messages)

    async def test_respects_abort_event(self, tmp_path: Path) -> None:
        """Setting abort_event stops the generator before result is yielded."""
        script = self._write_forge_script(
            tmp_path,
            "echo '{\"type\":\"system\",\"subtype\":\"init\",\"session_id\":\"sess-1\"}'\n"
            "sleep 3\n"  # Long sleep — abort fires (0.2s) before result (3s)
            "echo '{\"type\":\"result\",\"result\":\"too-late\",\"session_id\":\"sess-1\"}'\n"
            "exit 0\n",
        )
        abort_ev = asyncio.Event()

        async def trigger_abort() -> None:
            await asyncio.sleep(0.2)
            abort_ev.set()

        messages: list = []
        task = asyncio.create_task(trigger_abort())
        try:
            async for msg in query(
                "slow",
                options={"forge_path": str(script), "abort_event": abort_ev},
            ):
                messages.append(msg)
        finally:
            await task

        types = [m.type for m in messages]
        # Abort should have fired before result
        assert "system" in types
        assert "result" not in types

    async def test_max_turns_is_accepted(self, tmp_path: Path) -> None:
        """max_turns option is accepted without error (value is passed through)."""
        script = self._write_forge_script(
            tmp_path,
            "echo '{\"type\":\"system\",\"subtype\":\"init\",\"session_id\":\"sess-1\"}'\n"
            "echo '{\"type\":\"assistant\",\"content\":\"turn-1\"}'\n"
            "echo '{\"type\":\"result\",\"result\":\"done\",\"session_id\":\"sess-1\"}'\n"
            "exit 0\n",
        )
        messages: list = []
        async for msg in query(
            "hi",
            options={
                "cwd": str(tmp_path),
                "forge_path": str(script),
                "max_turns": 1,
            },
        ):
            messages.append(msg)

        types = [m.type for m in messages]
        assert "result" in types


class TestQueryOptionsEnvPassthrough:
    """Tests that environment variables are passed through correctly."""

    async def test_env_is_passthrough_to_process(
        self,
        tmp_path: Path,
    ) -> None:
        """Custom env vars are passed through to the forge subprocess."""
        script = tmp_path / "forge"
        script.write_text(
            "#!/bin/sh\n"
            "echo '{\"type\":\"system\",\"subtype\":\"init\",\"session_id\":\"sess-1\"}'\n"
            'echo \'{"type":"assistant","content":"\'"$MY_CUSTOM_VAR"\'"}\''
            "echo '{\"type\":\"result\",\"result\":\"ok\",\"session_id\":\"sess-1\"}'\n"
            "exit 0\n",
            encoding=None,
        )
        os.chmod(script, 0o755)

        captured: list[str] = []
        async for msg in query(
            "check env",
            options={
                "cwd": str(tmp_path),
                "forge_path": str(script),
                "env": {"MY_CUSTOM_VAR": "custom-value"},
            },
        ):
            if msg.type == "assistant":
                captured.append(msg.content)

        # The forge script echoes back $MY_CUSTOM_VAR as the assistant content
        assert any("custom-value" in c for c in captured), \
            f"Expected env var 'custom-value' in assistant output, got: {captured}"