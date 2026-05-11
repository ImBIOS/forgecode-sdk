# Python SDK Tooling

This document describes the tooling setup for the `forgecode-sdk` Python package.

## uv Commands

All operations use [`uv`](https://docs.astral.sh/uv/) — no pip, no poetry.

```bash
# Install dependencies (creates .venv/)
uv sync

# Run a script (uses .venv/ automatically)
uv run python examples/basic_query.py

# Add a dependency
uv add httpx

# Add a dev dependency
uv add --group dev pytest pytest-asyncio mypy ruff

# Type-check
uv run mypy src/forgecode --strict

# Lint
uv run ruff check src/forgecode/

# Format
uv run ruff format src/forgecode/

# Run tests
uv run pytest tests/

# Update the lock file
uv lock

# Clean virtualenv
uv sync --no-install
```

## hatchling Entry Points

The `pyproject.toml` uses `hatchling` as the build backend.

```toml
[project.scripts]
forgecode = "forgecode.__main__:main"
```

This exposes a `forgecode` CLI entry point (optional, not yet implemented):

```bash
uv run forgecode --help
```

## Type Checking

`mypy --strict` is enforced. Key settings:

| Setting | Value | Reason |
|---|---|---|
| `python_version` | `3.11` | asyncio.Event generics require 3.10+ |
| `strict_optional` | `True` | Enforce None vs Missing distinction |
| `warn_return_any` | `True` | Catch implicit Any returns |
| `disallow_untyped_defs` | `True` | All functions must have type hints |
| `disallow_any_generics` | `True` | No bare `List`/`Dict` without params |

## Linting & Formatting

`ruff` handles both linting and formatting:

```toml
[tool.ruff]
target-version = "py311"
select = ["E", "F", "I", "N", "UP", "ANN", "PGH", "RUF"]
```

## Version Management

Python version is pinned via `.python-version`:

```
3.11
```

This file is read by `uv` automatically. CI should run: `uv sync` which respects the pinned version.
