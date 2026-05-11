/**
 * Abort a long-running query using AbortController.
 *
 * The SDK listens for the abort signal and kills the forge process
 * with SIGKILL. An error message is yielded and the generator terminates.
 *
 * Run: bun run examples/abort-query.ts
 */
import { query } from "../src";

const ac = new AbortController();

// Abort after 3 seconds
setTimeout(() => {
  console.log("[abort] Cancelling query...");
  ac.abort();
}, 3000);

try {
  for await (const message of query({
    prompt: "Write a detailed 5000-word essay on the history of computing.",
    options: {
      abortController: ac,
    },
  })) {
    switch (message.type) {
      case "system":
        console.log(`[session] ${message.session_id}`);
        break;
      case "assistant":
        process.stdout.write(message.content);
        break;
      case "error":
        console.error(`\n[error] ${message.error}`);
        break;
    }
  }
} catch (err) {
  console.error("Caught:", err);
}
