/**
 * Session management — continue and resume conversations.
 *
 * - `continue: true` resumes the most recent conversation in the cwd.
 * - `resume: "<session-id>"` resumes a specific session by ID.
 *
 * Run: bun run examples/session-management.ts
 */
import { query } from "../src";

// First query — creates a new session
console.log("=== First query ===");
let sessionId = "";

for await (const message of query({
  prompt: "My favorite color is blue. Remember this.",
  options: {
    cwd: import.meta.dir,
  },
})) {
  if (message.type === "system") {
    sessionId = message.session_id;
    console.log(`[session] Started: ${sessionId}`);
  } else if (message.type === "assistant") {
    process.stdout.write(message.content);
  } else if (message.type === "result") {
    console.log(`\n[result] ${message.result}`);
  }
}

// Resume the same session by ID
console.log("\n=== Resumed query ===");

for await (const message of query({
  prompt: "What is my favorite color?",
  options: {
    resume: sessionId,
    cwd: import.meta.dir,
  },
})) {
  if (message.type === "system") {
    console.log(`[session] Resumed: ${message.session_id}`);
  } else if (message.type === "assistant") {
    process.stdout.write(message.content);
  } else if (message.type === "result") {
    console.log(`\n[result] ${message.result}`);
  } else if (message.type === "error") {
    console.error(`[error] ${message.error}`);
  }
}
