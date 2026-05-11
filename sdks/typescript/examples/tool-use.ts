/**
 * Capture tool use events during a query.
 *
 * When forge runs in verbose mode, tool executions appear as status lines
 * in stdout. The SDK parses these into `tool_use` messages with the
 * tool name and arguments.
 *
 * Run: bun run examples/tool-use.ts
 */
import { query } from "../src";

const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

for await (const message of query({
  prompt: "List the files in the current directory, then read package.json.",
  options: {
    cwd: import.meta.dir,
  },
})) {
  switch (message.type) {
    case "system":
      console.log(`[session] ${message.session_id}`);
      break;
    case "assistant":
      process.stdout.write(message.content);
      break;
    case "tool_use":
      toolCalls.push({ name: message.name, args: message.arguments });
      console.log(`\n[tool_use] ${message.name}(${JSON.stringify(message.arguments)})`);
      break;
    case "result":
      console.log(`\n[result] ${message.result.slice(0, 200)}...`);
      break;
    case "error":
      console.error(`[error] ${message.error}`);
      break;
  }
}

console.log(`\nTotal tool calls: ${toolCalls.length}`);
for (const call of toolCalls) {
  console.log(`  - ${call.name}`);
}
