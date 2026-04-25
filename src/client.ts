/**
 * @module client
 * Core client implementation for the ForgeCode SDK.
 *
 * Spawns the `forge` binary via `Bun.spawn`, reads stdout/stderr,
 * and yields {@link ForgeMessage} objects through an async generator.
 */

import type {
  ForgeMessage,
  ForgeConfig,
  QueryParams,
  OutputFormatJsonSchema,
} from "./types.ts";
import {
  ForgeBinaryNotFoundError,
  ForgeOutputParseError,
} from "./types.ts";
import { existsSync, statSync } from "node:fs";

// ---------------------------------------------------------------------------
// Binary resolution
// ---------------------------------------------------------------------------

const DEFAULT_SEARCH_PATHS = [
  `${process.env["HOME"] ?? "/root"}/.local/bin/forge`,
  "forge",
];

/**
 * Resolve the path to the forge binary.
 *
 * Search order:
 * 1. `FORGE_PATH` environment variable
 * 2. `config.forgePath` if provided
 * 3. `~/.local/bin/forge`
 * 4. `forge` on PATH (via `which`)
 *
 * @throws {ForgeBinaryNotFoundError} if no binary is found
 */
export function resolveForgePath(config?: ForgeConfig): string {
  // 1. FORGE_PATH env var
  const envPath = process.env["FORGE_PATH"];
  if (envPath) return envPath;

  // 2. Config path
  if (config?.forgePath) return config.forgePath;

  // 3. Check ~/.local/bin/forge directly
  const localBin = `${process.env["HOME"] ?? "/root"}/.local/bin/forge`;
  if (existsSync(localBin)) {
    try {
      const stat = statSync(localBin);
      if (stat.isFile() && (stat.mode & 0o111) !== 0) {
        return localBin;
      }
    } catch {
      // continue
    }
  }

  // 4. Try which forge on PATH
  try {
    const result = Bun.spawnSync(["which", "forge"], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const stdoutBuf = result.stdout as Uint8Array;
    const resolved = new TextDecoder().decode(stdoutBuf).trim();
    if (resolved) return resolved;
  } catch {
    // continue
  }

  throw new ForgeBinaryNotFoundError(DEFAULT_SEARCH_PATHS);
}

// ---------------------------------------------------------------------------
// Stream utilities
// ---------------------------------------------------------------------------

/**
 * Collect all chunks from a ReadableStream into a single Uint8Array.
 */
async function collectStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Read a stream as text.
 */
async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const buf = await collectStream(stream);
  return new TextDecoder().decode(buf);
}

// ---------------------------------------------------------------------------
// JSON extraction from markdown
// ---------------------------------------------------------------------------

/**
 * Attempt to extract a JSON object from text that may contain markdown
 * fencing or other surrounding text.
 *
 * Strategies (tried in order):
 * 1. Find ```json ... ``` fenced block
 * 2. Find ``` ... ``` fenced block and parse as JSON
 * 3. Find first `{` ... last `}` and parse
 * 4. Parse entire text as JSON
 */
export function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();

  // Strategy 1: ```json ... ```
  const jsonFenceMatch = trimmed.match(/```json\s*\n([\s\S]*?)\n```/);
  if (jsonFenceMatch?.[1]) {
    try {
      return JSON.parse(jsonFenceMatch[1].trim());
    } catch {
      // fall through
    }
  }

  // Strategy 2: ``` ... ``` (generic fence)
  const fenceMatch = trimmed.match(/```\s*\n([\s\S]*?)\n```/);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // fall through
    }
  }

  // Strategy 3: first { ... last }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      // fall through
    }
  }

  // Strategy 4: entire text
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  throw new ForgeOutputParseError("No valid JSON found in output", trimmed);
}

/**
 * Simple recursive validation that a value loosely matches a JSON Schema.
 *
 * This is intentionally lightweight — it checks structural compatibility
 * (type matches, required properties present) rather than full schema
 * validation, which would require a library like ajv.
 */
function matchesSchema(value: unknown, schema: Record<string, unknown>): boolean {
  if (!schema.type) return true;

  switch (schema.type) {
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
      const obj = value as Record<string, unknown>;
      const required = schema.required as string[] | undefined;
      if (required) {
        for (const key of required) {
          if (!(key in obj)) return false;
        }
      }
      const properties = schema.properties as Record<string, unknown> | undefined;
      if (properties) {
        for (const [key, propSchema] of Object.entries(properties)) {
          if (key in obj && propSchema && typeof propSchema === "object") {
            if (!matchesSchema(obj[key], propSchema as Record<string, unknown>)) return false;
          }
        }
      }
      return true;
    }
    case "array": {
      if (!Array.isArray(value)) return false;
      const items = schema.items as Record<string, unknown> | undefined;
      if (items) {
        return value.every((item) => matchesSchema(item, items));
      }
      return true;
    }
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// UUID generation for synthetic session IDs
// ---------------------------------------------------------------------------

function generateSessionId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// MCP server import helpers
// ---------------------------------------------------------------------------

/**
 * Run `forge mcp import` for each configured MCP server.
 * This must complete before the main query starts.
 */
async function importMcpServers(
  forgePath: string,
  servers: Record<string, { command: string; args?: string[]; transport?: string; env?: Record<string, string | undefined> }>,
  env: Record<string, string | undefined>,
): Promise<void> {
  for (const [name, serverConfig] of Object.entries(servers)) {
    const importPayload = JSON.stringify({
      name,
      command: serverConfig.command,
      args: serverConfig.args ?? [],
      transport: serverConfig.transport ?? "stdio",
      env: serverConfig.env ?? {},
    });

    const proc = Bun.spawn(
      [forgePath, "mcp", "import", importPayload, "--scope", "local"],
      {
        env,
        stdout: "pipe",
        stderr: "pipe",
        stdin: "ignore",
      },
    );

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await streamToText(proc.stderr);
      console.warn(`[forgecode-sdk] MCP import for "${name}" failed (exit ${exitCode}): ${stderr.slice(0, 200)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// query — main entry point
// ---------------------------------------------------------------------------

/**
 * Execute a ForgeCode query and yield messages as they arrive.
 *
 * This is the primary SDK function, mirroring the Claude Agent SDK's
 * `query()` pattern. It spawns the `forge` binary in one-shot mode,
 * collects its output, and yields typed messages.
 *
 * @example
 * ```ts
 * import { query } from "@imbios/forgecode-sdk";
 *
 * for await (const message of query({
 *   prompt: "What files are in this directory?",
 *   options: { agent: "sage" }
 * })) {
 *   if (message.type === "result") {
 *     console.log(message.result);
 *   }
 * }
 * ```
 *
 * @param params - Query parameters including prompt and options
 * @param config - Optional global SDK configuration
 * @yields {@link ForgeMessage} objects as the agent processes the prompt
 */
export async function* query(
  params: QueryParams,
  config?: ForgeConfig,
): AsyncGenerator<ForgeMessage> {
  const { prompt, options } = params;

  // Resolve binary path
  const forgePath = resolveForgePath(config);

  // Build environment
  const env: Record<string, string | undefined> = {
    ...process.env,
    ...(options?.env ?? {}),
  };

  // Apply config-level env overrides
  if (config?.openaiUrl) {
    env["OPENAI_URL"] = config.openaiUrl;
  }
  if (config?.openaiApiKey) {
    env["OPENAI_API_KEY"] = config.openaiApiKey;
  }
  if (config?.model) {
    env["FORGE_MODEL"] = config.model;
  }

  // Set reasoning effort if configured
  const effort = options?.reasoningEffort ?? config?.reasoningEffort;
  if (effort) {
    const setProc = Bun.spawn(
      [forgePath, "config", "set", "reasoning-effort", effort],
      { env, stdout: "pipe", stderr: "pipe", stdin: "ignore" },
    );
    await setProc.exited;
  }

  // Import MCP servers if configured
  if (options?.mcpServers && Object.keys(options.mcpServers).length > 0) {
    await importMcpServers(forgePath, options.mcpServers, env);
  }

  // Build forge arguments — always use --output-format json for structured output
  const args: string[] = ["-p", prompt, "--output-format", "json"];

  if (options?.agent) {
    args.push("--agent", options.agent);
  }
  if (options?.conversationId) {
    args.push("--conversation-id", options.conversationId);
  }
  if (options?.sandbox) {
    args.push("--sandbox", options.sandbox);
  }
  if (options?.cwd) {
    args.push("--directory", options.cwd);
  }

  // Prepend system prompt to the user prompt if provided
  if (options?.systemPrompt) {
    const promptIdx = args.indexOf("-p");
    if (promptIdx !== -1) {
      args[promptIdx + 1] = `${options.systemPrompt}\n\n${prompt}`;
    }
  }

  // Spawn the forge process
  const proc = Bun.spawn([forgePath, ...args], {
    env,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
    cwd: options?.cwd ?? undefined,
  });

  // Read stderr for error reporting
  let stderrText = "";
  try {
    const stderrBuf = await collectStream(proc.stderr);
    stderrText = new TextDecoder().decode(stderrBuf);
  } catch {
    // ignore
  }

  // Parse NDJSON from stdout line by line
  let fullAssistantText = "";
  let conversationId = options?.conversationId ?? "";
  let finalResult: unknown = "";

  try {
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("{")) continue;

        try {
          const msg = JSON.parse(trimmed);

          // Track conversation_id from forge
          if (msg.conversation_id) {
            conversationId = msg.conversation_id;
          }

          switch (msg.type) {
            case "assistant":
              fullAssistantText += msg.content ?? "";
              yield {
                type: "assistant",
                content: msg.content ?? "",
              } satisfies ForgeMessage;
              break;

            case "reasoning":
              // Reasoning is internal, don't yield but track
              break;

            case "tool_input":
              yield {
                type: "tool_use",
                name: msg.title ?? "unknown",
                arguments: {},
              } satisfies ForgeMessage;
              break;

            case "tool_output":
              // Tool output is informational
              break;

            case "tool_call_start":
              yield {
                type: "tool_use",
                name: msg.name ?? "unknown",
                arguments: {},
              } satisfies ForgeMessage;
              break;

            case "tool_call_end":
              // Tool end is informational
              break;

            case "complete":
            case "result":
              // Yield system init right before result (we now have conversation_id)
              yield {
                type: "system",
                subtype: "init",
                session_id: conversationId || generateSessionId(),
              } satisfies ForgeMessage;
              // Yield the result with accumulated text and session_id
              yield {
                type: "result",
                result: fullAssistantText || String(finalResult),
                session_id: conversationId || generateSessionId(),
              } satisfies ForgeMessage;
              break;

            case "retry":
              // Retry is informational
              break;

            case "interrupt":
              yield {
                type: "error",
                error: `Interrupted: ${msg.reason ?? "unknown"}`,
              } satisfies ForgeMessage;
              break;
          }
        } catch {
          // Skip non-JSON lines (e.g., the "● [HH:MM:SS] Initialize ..." line)
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim() && buffer.trim().startsWith("{")) {
      try {
        const msg = JSON.parse(buffer.trim());
        if (msg.conversation_id) {
          conversationId = msg.conversation_id;
        }
      } catch {
        // ignore
      }
    }
  } catch (err) {
    proc.kill("SIGKILL");
    yield {
      type: "error",
      error: `Failed to read forge output: ${err instanceof Error ? err.message : String(err)}`,
    };
    return;
  }

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    yield {
      type: "error",
      error: stderrText.trim() || `Forge process exited with code ${exitCode}`,
      exitCode,
    };
    return;
  }

  // Yield system init if no messages were received at all
  if (!systemYielded) {
    yield* yieldSystemInit();
  }

  // Process output format if specified (JSON schema validation)
  finalResult = fullAssistantText;

  if (options?.outputFormat?.type === "json_schema") {
    const fmt = options.outputFormat as OutputFormatJsonSchema;
    try {
      const parsed = extractJsonFromText(fullAssistantText);
      if (!matchesSchema(parsed, fmt.schema)) {
        console.warn("[forgecode-sdk] Output JSON does not match the provided schema");
      }
      finalResult = parsed;
    } catch (err) {
      if (err instanceof ForgeOutputParseError) {
        yield {
          type: "error",
          error: err.message,
        };
        return;
      }
      throw err;
    }
  }

  // Yield the final result message
  yield {
    type: "result",
    result: typeof finalResult === "string" ? finalResult : JSON.stringify(finalResult, null, 2),
    session_id: conversationId || generateSessionId(),
  };
}
