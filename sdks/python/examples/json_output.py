"""
Structured JSON output — request the agent to return JSON conforming to a
Pydantic schema. The schema is shown to the agent as a hint and used for
strict runtime validation.

The result is a validated Pydantic model instance — no JSON.parse needed.

Run: uv run python examples/json_output.py
"""
import asyncio

from pydantic import BaseModel

from forgecode import query


class MathResult(BaseModel):
    expression: str
    result: float
    steps: list[str]


async def main() -> None:
    async for message in query(
        "Solve: (15 * 7) - (42 / 6). Return ONLY a valid JSON object with fields: "
        "expression (string), result (number), steps (array of strings). "
        "No explanation, just the JSON.",
        options={
            "output_format": {
                "type": "json_schema",
                "model": MathResult,
            },
        },
    ):
        if message.type == "result":
            print(f"Expression: {message.result.expression}")
            print(f"Result: {message.result.result}")
            print("Steps:")
            for step in message.result.steps:
                print(f"  - {step}")
        elif message.type == "error":
            print(f"Error: {message.error}", file=__import__("sys").stderr)


if __name__ == "__main__":
    asyncio.run(main())