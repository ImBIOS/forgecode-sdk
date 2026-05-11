/**
 * Basic query — send a prompt and collect the result.
 *
 * Run: bun run examples/basic-query.ts
 */
import { query } from "../src";

for await (const message of query({
  prompt: "What is 2 + 2? Reply with just the number.",
})) {
  switch (message.type) {
    case "system":
      console.log(`[session] ${message.session_id}`);
      break;
    case "assistant":
      process.stdout.write(message.content);
      break;
    case "result":
      console.log(`\n[result] ${message.result}`);
      break;
    case "error":
      console.error(`[error] ${message.error}`);
      break;
  }
}
