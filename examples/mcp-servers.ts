/**
 * MCP server integration — import MCP servers before running a query.
 *
 * The SDK calls `forge mcp import` for each configured server before
 * starting the query. This makes the server's tools available to the agent.
 *
 * Run: bun run examples/mcp-servers.ts
 */
import { query } from "../src";

for await (const message of query({
  prompt: "What MCP tools are available to you? List them briefly.",
  options: {
    mcpServers: {
      "my-filesystem": {
        command: "npx",
        args: ["-y", "@anthropic-ai/mcp-filesystem-server", "/tmp"],
        transport: "stdio",
      },
    },
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
    case "result":
      console.log(`\n[result] ${message.result}`);
      break;
    case "error":
      console.error(`[error] ${message.error}`);
      break;
  }
}
