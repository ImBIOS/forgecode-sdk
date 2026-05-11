/**
 * Error handling — catch and handle SDK errors gracefully.
 *
 * The SDK throws specific error classes:
 * - ForgeBinaryNotFoundError — forge binary not found
 * - ForgeProcessError — forge exited with non-zero code
 * - ForgeOutputParseError — JSON extraction failed (internal, not thrown to caller)
 * - ForgeAbortError — query was cancelled
 *
 * Run: bun run examples/error-handling.ts
 */
import { ForgeBinaryNotFoundError, query, resolveForgePath } from "../src";

try {
  // Try to resolve the forge binary
  const forgePath = resolveForgePath();
  console.log(`Forge binary found at: ${forgePath}`);

  // Run a query
  for await (const message of query({
    prompt: "Say hello in exactly one word.",
  })) {
    switch (message.type) {
      case "result":
        console.log(`Result: ${message.result}`);
        break;
      case "error":
        console.error(`Forge error: ${message.error}`);
        break;
    }
  }
} catch (err) {
  if (err instanceof ForgeBinaryNotFoundError) {
    console.error("Forge binary not found!");
    console.error("Install forge or set FORGE_PATH environment variable.");
    process.exit(1);
  } else {
    console.error("Unexpected error:", err);
    process.exit(1);
  }
}
