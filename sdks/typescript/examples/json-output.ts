/**
 * Structured JSON output — request the agent to return JSON conforming to a
 * Zod schema. The schema is passed to the agent as a hint (via auto-derived
 * JSON Schema) and used for strict runtime validation.
 *
 * The result type is inferred automatically from the Zod schema — no need
 * to specify <T> or call JSON.parse() yourself.
 *
 * Run: bun run examples/json-output.ts
 */
import z from "zod";
import { query } from "../src";

// Define the shape you expect — Zod gives runtime validation + type inference
const mathSchema = z.object({
  expression: z.string(),
  result: z.number(),
  steps: z.array(z.string()),
});

for await (const message of query({
  prompt:
    "Solve: (15 * 7) - (42 / 6). Return ONLY a valid JSON object with fields: " +
    "expression (string), result (number), steps (array of strings). " +
    "No explanation, just the JSON.",
  options: {
    outputFormat: {
      type: "json_schema",
      // Auto-derived JSON Schema is shown to the agent as a hint
      // Zod parse validates at runtime — result is typed as the schema type
      z: mathSchema,
    },
  },
})) {
  if (message.type === "result") {
    // message.result is typed as { expression: string; result: number; steps: string[] }
    console.log("Expression:", message.result.expression);
    console.log("Result:", message.result.result);
    console.log("Steps:");
    for (const step of message.result.steps) {
      console.log(`  - ${step}`);
    }
  } else if (message.type === "error") {
    // Validation failed — the SDK throws because z.parse() rejected the output
    console.error("Error:", message.error);
  }
}
