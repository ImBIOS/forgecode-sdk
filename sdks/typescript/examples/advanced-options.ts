/**
 * Advanced options — model selection, max turns, environment variables,
 * system prompt, and stderr capture.
 *
 * Run: bun run examples/advanced-options.ts
 */
import { query } from "../src";

for await (const message of query({
  prompt: "What model are you? Reply in one sentence.",
  options: {
    model: "MiniMax-M2.7",
    maxTurns: 1,
    systemPrompt: "You are a concise assistant. Never use more than one sentence.",
    cwd: import.meta.dir,
    env: {
      // Custom env vars passed to the forge process
      MY_CUSTOM_VAR: "hello-from-sdk",
    },
    stderr: (data) => {
      // Real-time stderr output (useful for debugging)
      process.stderr.write(`[forge:stderr] ${data}`);
    },
  },
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
