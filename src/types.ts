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
export interface ResultMessage {
  type: "result";
  /** The full text output of the run. */
  result: string;
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
export type ForgeMessage =
  | SystemMessage
  | AssistantMessage
  | ResultMessage
  | ToolUseMessage
  | ErrorMessage;

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

/** Reasoning effort levels supported by ForgeCode. */
export type ReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

/**
 * Output format options.
 *
 * When `type` is `"json_schema"`, the SDK will attempt to parse the final
 * text output as JSON that conforms to the provided `schema`.
 */
export interface OutputFormatJsonSchema {
  type: "json_schema";
  /** A JSON Schema object describing the expected output structure. */
  schema: Record<string, unknown>;
}

export type OutputFormat = OutputFormatJsonSchema;

/**
 * Options for the {@link query} function.
 *
 * Mirrors the Claude Agent SDK options pattern with ForgeCode-specific fields.
 */
export interface QueryOptions {
  /**
   * Agent ID to use for this session.
   * Maps to `forge --agent <id>`.
   */
  agent?: string;

  /**
   * Conversation ID to resume or continue.
   * Maps to `forge --conversation-id <id>`.
   */
  conversationId?: string;

  /**
   * Name for an isolated git worktree sandbox.
   * Maps to `forge --sandbox <name>`.
   */
  sandbox?: string;

  /**
   * Working directory for the forge process.
   * Maps to `forge --directory <path>`.
   */
  cwd?: string;

  /**
   * Additional environment variables to pass to the forge process.
   * These are merged with `process.env`.
   */
  env?: Record<string, string | undefined>;

  /**
   * Output format specification.
   * When provided, the SDK attempts to parse the final text as structured data.
   */
  outputFormat?: OutputFormat;

  /**
   * Reasoning effort level.
   * Maps to `forge config set reasoning-effort <level>` (set before the run).
   */
  reasoningEffort?: ReasoningEffort;

  /**
   * MCP server configurations to import before the run.
   * Maps to `forge mcp import <json>` for each entry.
   */
  mcpServers?: Record<string, McpServerConfig>;

  /**
   * Tools the agent is allowed to use.
   * Maps to ForgeCode's tool restriction mechanism.
   */
  allowedTools?: string[];

  /**
   * System prompt to prepend to the user prompt.
   * Injected before the prompt text.
   */
  systemPrompt?: string;
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
  /**
   * Explicit path to the forge binary.
   * When set, takes priority over PATH lookup and `FORGE_PATH`.
   */
  forgePath?: string;

  /**
   * Default OpenAI-compatible API base URL.
   * Maps to the `OPENAI_URL` environment variable.
   */
  openaiUrl?: string;

  /**
   * Default OpenAI-compatible API key.
   * Maps to the `OPENAI_API_KEY` environment variable.
   */
  openaiApiKey?: string;

  /**
   * Default model to use.
   * Maps to the `FORGE_MODEL` environment variable.
   */
  model?: string;

  /**
   * Default reasoning effort level.
   */
  reasoningEffort?: ReasoningEffort;
}

// ---------------------------------------------------------------------------
// Query parameters
// ---------------------------------------------------------------------------

/**
 * Parameters for the {@link query} function.
 */
export interface QueryParams {
  /** The prompt text to send to the agent. */
  prompt: string;
  /** Optional query configuration. */
  options?: QueryOptions;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Error thrown when the forge binary cannot be found.
 */
export class ForgeBinaryNotFoundError extends Error {
  constructor(searchedPaths: string[]) {
    super(
      `Forge binary not found. Searched: ${searchedPaths.join(", ")}. ` +
        `Install forge or set the FORGE_PATH environment variable.`,
    );
    this.name = "ForgeBinaryNotFoundError";
  }
}

/**
 * Error thrown when the forge process exits with a non-zero code.
 */
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

/**
 * Error thrown when output format parsing fails.
 */
export class ForgeOutputParseError extends Error {
  constructor(message: string, readonly rawOutput: string) {
    super(`Failed to parse forge output: ${message}`);
    this.name = "ForgeOutputParseError";
  }
}
