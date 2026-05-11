"""Pytest configuration and shared fixtures for forgecode-sdk tests."""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import AsyncGenerator

import pytest


@pytest.fixture
def temp_cwd(tmp_path: Path) -> Path:
    """Temporary working directory for forge session tests."""
    return tmp_path


@pytest.fixture
async def abort_event() -> AsyncGenerator[asyncio.Event, None]:
    """A fresh abort event for every test."""
    ev = asyncio.Event()
    yield ev
    ev.set()  # ensure cleanup doesn't leave it dangling
