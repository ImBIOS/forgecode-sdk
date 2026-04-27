/**
 * @module @imbios/forgecode-sdk
 *
 * TypeScript SDK for the ForgeCode CLI (`forge` binary).
 *
 * Provides a `query()` function that spawns the forge binary and yields
 * typed messages through an async generator, following the Claude Agent SDK
 * pattern.
 *
 * @example
 * ```ts
 * import { query } from "@imbios/forgecode-sdk";
 *
 * for await (const message of query({
 *   prompt: "Fix the bug in auth.ts",
 *   options: {
 *     agent: "forge",
 *     sandbox: "experiment-1",
 *   },
 * })) {
 *   switch (message.type) {
 *     case "system":
 *       console.log(`Session: ${message.session_id}`);
 *       break;
 *     case "assistant":
 *       process.stdout.write(message.content);
 *       break;
 *     case "result":
 *       console.log("\nDone:", message.result);
 *       break;
 *     case "error":
 *       console.error("Error:", message.error);
 *       break;
 *   }
 * }
 * ```
 */

// Re-export everything from types
export type {
  ForgeMessage,
  SystemMessage,
  AssistantMessage,
  ResultMessage,
  ToolUseMessage,
  ErrorMessage,
  ReasoningEffort,
  OutputFormatJsonSchema,
  OutputFormat,
  QueryOptions,
  McpServerConfig,
  ForgeConfig,
  InferResult,
  ResolveResultType,
} from "./types.ts";

export {
  ForgeBinaryNotFoundError,
  ForgeProcessError,
  ForgeOutputParseError,
  ForgeAbortError,
} from "./types.ts";

// Re-export zod for consumers who want strict validation
export { z } from "zod";

// Re-export query and helpers from client
export { query, resolveForgePath, extractJsonFromText } from "./client.ts";
