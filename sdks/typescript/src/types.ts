/**
 * @module types
 * Type definitions for the ForgeCode SDK.
 *
 * Message types mirror the Claude Agent SDK pattern:
 * - SystemMessage: session initialization (init with session_id)
 * - AssistantMessage: text content from the agent
 * - ResultMessage: final result with text output
 * - ToolUseMessage: tool calls made by the agent
 * - ErrorMessage: errors encountered during execution
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema inference utilities
// ---------------------------------------------------------------------------

/**
 * Extract the inferred type from a Zod schema.
 *
 * Usage:
 * ```ts
 * type MyType = InferResult<typeof mySchema>;  // { name: string; age: number }
 * ```
 */
export type InferResult<S> = S extends z.ZodType<infer T> ? T : never;

/**
 * Resolve the result type from `QueryOptions`.
 *
 * If `outputFormat.z` is a `ZodType<T>`, returns `T` so the
 * `ResultMessage.result` field is typed correctly without any manual generics.
 *
 * ```ts
 * const schema = z.object({ name: z.string() });
 * type T = ResolveResultType<{ outputFormat: { z: schema } }>;
 * // T = { name: string }
 * ```
 */
export type ResolveResultType<O> = O extends { outputFormat: { z: infer S } }
  ? S extends z.ZodType<infer T>
    ? T
    : string
  : string;

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/** System message emitted at session start. */
export interface SystemMessage {
  type: "system";
  /** Sub-type discriminator (currently only "init"). */
  subtype: "init";
  /** Unique session / conversation ID for this run. */
  session_id: string;
}

/** Streaming text chunk from the assistant. */
export interface AssistantMessage {
  type: "assistant";
  /** Markdown text produced by the agent. */
  content: string;
}

/** Final result message emitted when the agent finishes. */
export interface ResultMessage<T = string> {
  type: "result";
  /**
   * The output of the run.
   *
   * - `string` when no structured output was requested.
   * - `T` when `outputFormat.z` is a `ZodType<T>` — fully typed and validated.
   *
   * Consumers should narrow on the shape rather than assuming a type.
   */
  result: T;
  /** Unique session / conversation ID. */
  session_id: string;
  /** Token usage information (when available). */
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

/** Tool call performed by the agent during execution. */
export interface ToolUseMessage {
  type: "tool_use";
  /** Name of the tool that was called. */
  name: string;
  /** Arguments passed to the tool. */
  arguments: Record<string, unknown>;
}

/** Error message emitted when something goes wrong. */
export interface ErrorMessage {
  type: "error";
  /** Human-readable error description. */
  error: string;
  /** Exit code of the forge process (0 if the process is still running). */
  exitCode?: number;
}

/**
 * Union of all message types yielded by {@link query}.
 */
export type ForgeMessage<T = string> =
  | SystemMessage
  | AssistantMessage
  | ToolUseMessage
  | ErrorMessage
  | ResultMessage<T>;

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

/** Reasoning effort levels supported by ForgeCode. */
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Output format options.
 *
 * When `type` is `"json_schema"`, the SDK will:
 * 1. Auto-derive a JSON Schema from `z` via `z.toJSONSchema(z)` and inject it
 *    into a system prompt so the agent knows the expected structure
 * 2. After the process completes, extract JSON from the final result text
 * 3. If `z` is a `ZodType`, validate the extracted JSON with `z.parse()` —
 *    throws a clear error with Zod issues on failure
 * 4. Yield `message.result` as the validated typed object (no JSON.parse needed)
 */
export interface OutputFormatJsonSchema {
  type: "json_schema";
  /**
   * Zod schema for strict runtime validation and type inference.
   * The JSON Schema shown to the agent is auto-derived via `z.toJSONSchema(z)`.
   *
   * @example
   * ```ts
   * outputFormat: {
   *   type: "json_schema",
   *   z: z.object({ name: z.string(), age: z.number() }),
   * }
   * ```
   */
  z: unknown;
  /**
   * When `true`, include Zod `issues` in the error message on validation failure.
   * @default false
   */
  verboseErrors?: boolean;
}

export type OutputFormat = OutputFormatJsonSchema;

/**
 * Options for the {@link query} function.
 *
 * Mirrors the Claude Agent SDK options pattern with ForgeCode-specific fields.
 */
export interface QueryOptions {
  /** Agent ID to use for this session. Maps to `forge --agent <id>`. */
  agent?: string;
  /** Conversation ID to resume or continue. Maps to `forge --conversation-id <id>`. */
  conversationId?: string;
  /** Name for an isolated git worktree sandbox. Maps to `forge --sandbox <name>`. */
  sandbox?: string;
  /** Working directory for the forge process. Maps to `forge --directory <path>`. */
  cwd?: string;
  /** Additional environment variables to pass to the forge process. */
  env?: Record<string, string | undefined>;
  /** Output format specification for structured JSON output. */
  outputFormat?: OutputFormat;
  /** Reasoning effort level. Maps to `forge config set reasoning-effort <level>`. */
  reasoningEffort?: ReasoningEffort;
  /** MCP server configurations to import before the run. */
  mcpServers?: Record<string, McpServerConfig>;
  /** Tools the agent is allowed to use. Maps to ForgeCode's tool restriction. */
  allowedTools?: string[];
  /** System prompt to prepend to the user prompt. */
  systemPrompt?: string;
  /** AbortController for cancelling the query. */
  abortController?: AbortController;
  /** Claude model to use. Maps to FORGE_MODEL env var. */
  model?: string;
  /** Maximum number of conversation turns before stopping. */
  maxTurns?: number;
  /** List of tool names that are disallowed. */
  disallowedTools?: string[];
  /** Specify available built-in tools. Empty array = disable all. */
  tools?: string[];
  /** Continue the most recent conversation. */
  continue?: boolean;
  /** Session ID to resume. */
  resume?: string;
  /** Callback for stderr output from the forge process. */
  stderr?: (data: string) => void;
  /** Custom title for the session. */
  title?: string;
}

/**
 * MCP server configuration.
 */
export interface McpServerConfig {
  /** Command to run the MCP server (e.g. "npx"). */
  command: string;
  /** Arguments for the MCP server command. */
  args?: string[];
  /** Transport protocol (default: "stdio"). */
  transport?: "stdio" | "sse";
  /** Environment variables for the MCP server. */
  env?: Record<string, string | undefined>;
}

// ---------------------------------------------------------------------------
// SDK configuration
// ---------------------------------------------------------------------------

/**
 * Global SDK configuration.
 */
export interface ForgeConfig {
  /** Explicit path to the forge binary. Takes priority over PATH lookup. */
  forgePath?: string;
  /** Default OpenAI-compatible API base URL. Maps to `OPENAI_URL` env var. */
  openaiUrl?: string;
  /** Default OpenAI-compatible API key. Maps to `OPENAI_API_KEY` env var. */
  openaiApiKey?: string;
  /** Default model to use. Maps to `FORGE_MODEL` env var. */
  model?: string;
  /** Default reasoning effort level. */
  reasoningEffort?: ReasoningEffort;
}

// ---------------------------------------------------------------------------
// Query parameters
// ---------------------------------------------------------------------------

/**
 * Parameters for the {@link query} function.
 */
export interface QueryParams<O extends QueryOptions = QueryOptions> {
  /** The prompt text to send to the agent. */
  prompt: string;
  /** Optional query configuration. */
  options?: O;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Error thrown when the forge binary cannot be found. */
export class ForgeBinaryNotFoundError extends Error {
  constructor(searchedPaths: string[]) {
    super(
      `Forge binary not found. Searched: ${searchedPaths.join(", ")}. ` +
        `Install forge or set the FORGE_PATH environment variable.`,
    );
    this.name = "ForgeBinaryNotFoundError";
  }
}

/** Error thrown when the forge process exits with a non-zero code. */
export class ForgeProcessError extends Error {
  readonly exitCode: number;
  readonly stderr: string;

  constructor(exitCode: number, stderr: string) {
    super(`Forge process exited with code ${exitCode}: ${stderr.slice(0, 500)}`);
    this.name = "ForgeProcessError";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

/** Error thrown when output format parsing fails. */
export class ForgeOutputParseError extends Error {
  constructor(
    message: string,
    readonly rawOutput: string,
  ) {
    super(`Failed to parse forge output: ${message}`);
    this.name = "ForgeOutputParseError";
  }
}

/** Error thrown when a query is aborted via AbortController. */
export class ForgeAbortError extends Error {
  constructor() {
    super("Query was aborted");
    this.name = "ForgeAbortError";
  }
}
