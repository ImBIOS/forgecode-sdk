"""Tests for client helper functions (no subprocess needed)."""
from __future__ import annotations

import re

import pytest

from forgecode.client import (
    _ANSI_RE,
    _ERROR_LINE_RE,
    _EXECUTE_LINE_RE,
    _INIT_LINE_RE,
    _STATUS_LINE_RE,
    extract_json_from_text,
    resolve_forge_path,
    strip_ansi,
)


class TestStripAnsi:
    """Tests for strip_ansi()."""

    def test_passthrough_plain_text(self) -> None:
        """Plain text is returned unchanged."""
        text = "Hello, world!"
        assert strip_ansi(text) == text

    def test_removes_ansi_codes(self) -> None:
        """All ANSI SGR escape sequences are stripped."""
        colored = "\x1b[31mError\x1b[0m: something went wrong"
        assert strip_ansi(colored) == "Error: something went wrong"

    def test_removes_multiple_codes(self) -> None:
        """Multiple ANSI codes in one string are stripped."""
        colored = "\x1b[1m\x1b[34mBold Blue\x1b[0m Normal"
        assert strip_ansi(colored) == "Bold Blue Normal"

    def test_empty_string(self) -> None:
        """Empty string returns empty."""
        assert strip_ansi("") == ""

    def test_compiled_pattern_is_valid(self) -> None:
        """The module-level pattern compiles without error."""
        assert _ANSI_RE is not None
        assert isinstance(_ANSI_RE, re.Pattern)


class TestExtractJsonFromText:
    """Tests for extract_json_from_text()."""

    def test_returns_plain_json(self) -> None:
        """A single JSON object is returned directly."""
        text = '{"type":"result","result":"hello"}'
        assert extract_json_from_text(text) == {"type": "result", "result": "hello"}

    def test_extracts_from_markdown(self) -> None:
        """JSON inside a markdown code block is extracted."""
        text = 'Here is the result:\n```json\n{"result":"42"}\n```\nDone.'
        assert extract_json_from_text(text) == {"result": "42"}

    def test_extracts_from_plain_text(self) -> None:
        """JSON at the end of plain text is extracted."""
        text = 'The model outputted some text and then:\n{"type":"result","result":"done"}'
        assert extract_json_from_text(text) == {"type": "result", "result": "done"}

    def test_last_json_wins(self) -> None:
        """When multiple JSON blocks exist, the last one is returned."""
        text = '{"a":1}\nSome text\n{"b":2}'
        assert extract_json_from_text(text) == {"b": 2}

    def test_markdown_wins_over_plain_text(self) -> None:
        """A markdown block takes priority over plain-text JSON."""
        text = '{"a":1}\n```json\n{"b":2}\n```'
        assert extract_json_from_text(text) == {"b": 2}

    def test_returns_none_for_non_json(self) -> None:
        """Plain English text with no JSON returns None."""
        text = "Hello, this is plain text with no JSON at all."
        with pytest.raises(ValueError):
            extract_json_from_text(text)

    def test_empty_string(self) -> None:
        """Empty string raises ValueError."""
        with pytest.raises(ValueError):
            extract_json_from_text("")


class TestStatusLinePatterns:
    """Tests for the status-line regex patterns."""

    def test_status_line_re_matches_check_status(self) -> None:
        """Check status lines are matched by _STATUS_LINE_RE."""
        line = "●  [14:30:00] Checking for updates..."
        match = _STATUS_LINE_RE.match(line)
        assert match is not None
        assert "Checking" in match.group(1)

    def test_status_line_re_matches_thinking_status(self) -> None:
        """Thinking status lines are matched by _STATUS_LINE_RE."""
        line = "●  [14:30:00] Thinking: Reasoning effort: high"
        match = _STATUS_LINE_RE.match(line)
        assert match is not None
        assert "Thinking" in match.group(1)

    def test_status_line_re_no_match_for_empty_line(self) -> None:
        """Empty lines don't match."""
        assert _STATUS_LINE_RE.match("") is None
        assert _STATUS_LINE_RE.match("   ") is None

    def test_init_line_re_matches_uuid(self) -> None:
        """_INIT_LINE_RE extracts the session UUID."""
        line = "Initialize 550e8400-e29b-41d4-a716-446655440000"
        match = _INIT_LINE_RE.match(line)
        assert match is not None
        assert match.group(1) == "550e8400-e29b-41d4-a716-446655440000"

    def test_error_line_re_matches_error(self) -> None:
        """_ERROR_LINE_RE extracts the error message."""
        line = "ERROR: something went wrong"
        match = _ERROR_LINE_RE.match(line)
        assert match is not None
        assert match.group(1) == "something went wrong"

    def test_execute_line_re_matches_command(self) -> None:
        """_EXECUTE_LINE_RE extracts the shell and command."""
        line = "Execute [/bin/zsh] ls -la"
        match = _EXECUTE_LINE_RE.match(line)
        assert match is not None
        assert match.group(1) == "/bin/zsh"
        assert match.group(2) == "ls -la"
