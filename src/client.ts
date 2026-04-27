/**
 * @module client
 * Core client implementation for the ForgeCode SDK.
 *
 * Spawns the `forge` binary via `Bun.spawn`, reads stdout,
 * and yields {@link ForgeMessage} objects through an async generator.
 *
 * The forge CLI outputs plain text with ANSI-prefixed status lines:
 *   ● [HH:MM:SS] Initialize <uuid>
 *   <assistant text (multi-line)>
 *   ● [HH:MM:SS] Execute [/bin/zsh] <command>      (verbose mode only)
 *   <tool output (verbose mode only)>
 *   ● [HH:MM:SS] Finished <uuid>
 *
 * On error:
 *   ● [HH:MM:SS] ERROR: <message>
 */

import { existsSync, statSync } from "node:fs";
import { z } from "zod";
import type { ForgeConfig, ForgeMessage, QueryOptions, ResolveResultType } from "./types.ts";
import { ForgeBinaryNotFoundError } from "./types.ts";

// ---------------------------------------------------------------------------
// Binary resolution
// ---------------------------------------------------------------------------

const DEFAULT_SEARCH_PATHS = [`${process.env["HOME"] ?? "/root"}/.local/bin/forge`, "forge"];

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

  throw new Error(`No valid JSON found in output`);
}

// ---------------------------------------------------------------------------
// UUID generation for synthetic session IDs
// ---------------------------------------------------------------------------

function generateSessionId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// ANSI stripping
// ---------------------------------------------------------------------------

/**
 * Strip ANSI escape codes from a string.
 * Matches CSI sequences (ESC [ ... m), OSC sequences, and other common escapes.
 */
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07|\x1b[()][0-9a-zA-Z]/g;

function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, "");
}

// ---------------------------------------------------------------------------
// Output line patterns
// ---------------------------------------------------------------------------

/**
 * Regex for forge status lines (applied AFTER ANSI stripping):
 *   ● [HH:MM:SS] Initialize <uuid>
 *   ● [HH:MM:SS] Finished <uuid>
 *   ● [HH:MM:SS] ERROR: <message>
 *   ● [HH:MM:SS] Execute [/bin/zsh] <command>     (verbose)
 */
const STATUS_LINE_RE = /^●\s+\[\d{2}:\d{2}:\d{2}\]\s+(.+)$/;

/**
 * Extract session ID from an "Initialize <uuid>" status line.
 */
const INIT_LINE_RE = /^Initialize\s+([0-9a-f-]{36})$/;

/**
 * Extract error message from an "ERROR: <message>" status line.
 */
const ERROR_LINE_RE = /^ERROR:\s*(.+)$/;

/**
 * Extract tool info from an "Execute [/bin/zsh] <command>" status line.
 */
const EXECUTE_LINE_RE = /^Execute\s+\[([^\]]+)\]\s+(.+)$/;

// ---------------------------------------------------------------------------
// MCP server import helpers
// ---------------------------------------------------------------------------

/**
 * Run `forge mcp import` for each configured MCP server.
 * This must complete before the main query starts.
 */
async function importMcpServers(
  forgePath: string,
  servers: Record<
    string,
    {
      command: string;
      args?: string[];
      transport?: string;
      env?: Record<string, string | undefined>;
    }
  >,
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

    const proc = Bun.spawn([forgePath, "mcp", "import", importPayload, "--scope", "local"], {
      env,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await collectStream(proc.stderr);
      const stderrText = new TextDecoder().decode(stderr);
      console.warn(
        `[forgecode-sdk] MCP import for "${name}" failed (exit ${exitCode}): ${stderrText.slice(0, 200)}`,
      );
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
 * collects its plain-text output, and yields typed messages.
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
export async function* query<O extends QueryOptions = QueryOptions>(
  params: { prompt: string; options?: O },
  config?: ForgeConfig,
): AsyncGenerator<ForgeMessage<ResolveResultType<O>>> {
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
  // Option-level model takes precedence over config
  if (options?.model) {
    env["FORGE_MODEL"] = options.model;
  }

  // Set reasoning effort if configured
  const effort = options?.reasoningEffort ?? config?.reasoningEffort;
  if (effort) {
    const setProc = Bun.spawn([forgePath, "config", "set", "reasoning-effort", effort], {
      env,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });
    await setProc.exited;
  }

  // Import MCP servers if configured
  if (options?.mcpServers && Object.keys(options.mcpServers).length > 0) {
    await importMcpServers(forgePath, options.mcpServers, env);
  }

  // Build forge arguments
  const args: string[] = ["-p", prompt];

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
  if (options?.maxTurns != null) {
    args.push("--max-turns", String(options.maxTurns));
  }
  if (options?.disallowedTools?.length) {
    args.push("--disallowed-tools", options.disallowedTools.join(","));
  }
  if (options?.tools?.length) {
    args.push("--tools", options.tools.join(","));
  }
  if (options?.continue) {
    args.push("--continue");
  }
  if (options?.resume) {
    args.push("--resume", options.resume);
  }
  if (options?.title) {
    args.push("--title", options.title);
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

  // Set up abort controller listener
  let aborted = false;
  if (options?.abortController) {
    const { signal } = options.abortController;
    if (signal.aborted) {
      proc.kill("SIGKILL");
      yield {
        type: "error",
        error: "Query was aborted before process started",
      } satisfies ForgeMessage;
      return;
    }
    signal.addEventListener(
      "abort",
      () => {
        aborted = true;
        proc.kill("SIGKILL");
      },
      { once: true },
    );
  }

  // Read stderr concurrently — forge writes ERROR status lines to stderr
  // If a stderr callback is provided, stream data to it as it arrives
  let stderrCollected = "";
  let stderrPromise: Promise<string>;

  if (options?.stderr) {
    stderrPromise = (async () => {
      try {
        const reader = proc.stderr.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          options.stderr!(buffer);
          stderrCollected = buffer;
          buffer = "";
        }
        return stderrCollected;
      } catch {
        return stderrCollected;
      }
    })();
  } else {
    stderrPromise = collectStream(proc.stderr)
      .then((buf) => new TextDecoder().decode(buf))
      .catch(() => "");
  }

  // Parse plain-text output from stdout
  let sessionId = "";
  let assistantText = "";
  let hasError = false;
  let errorMessage = "";
  let systemYielded = false;

  try {
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      // Check if aborted while waiting for next chunk
      if (aborted) {
        yield {
          type: "error",
          error: "Query was aborted",
        } satisfies ForgeMessage;
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

      for (const line of lines) {
        const raw = line.trimEnd();
        const stripped = stripAnsi(raw);

        // Check for status lines (on ANSI-stripped content)
        const statusMatch = stripped.match(STATUS_LINE_RE);
        if (statusMatch?.[1]) {
          const statusContent = statusMatch[1];

          // Initialize line — extract session ID
          const initMatch = statusContent.match(INIT_LINE_RE);
          if (initMatch?.[1]) {
            sessionId = initMatch[1];
            yield {
              type: "system",
              subtype: "init",
              session_id: sessionId,
            } satisfies ForgeMessage;
            systemYielded = true;
            continue;
          }

          // Error line
          const errorMatch = statusContent.match(ERROR_LINE_RE);
          if (errorMatch?.[1]) {
            hasError = true;
            errorMessage = errorMatch[1];
            yield {
              type: "error",
              error: errorMessage,
            } satisfies ForgeMessage;
            continue;
          }

          // Tool execution line (verbose mode) — yield as tool_use
          const execMatch = statusContent.match(EXECUTE_LINE_RE);
          if (execMatch?.[1] && execMatch?.[2]) {
            yield {
              type: "tool_use",
              name: execMatch[1], // shell path
              arguments: { command: execMatch[2] },
            } satisfies ForgeMessage;
            continue;
          }

          // Finished line — we'll handle result after the loop
          continue;
        }

        // Non-status line: this is assistant output content
        // Use ANSI-stripped version for clean content
        if (stripped.length > 0) {
          assistantText += (assistantText ? "\n" : "") + stripped;
          // Yield assistant messages as they stream
          yield {
            type: "assistant",
            content: stripped,
          } satisfies ForgeMessage;
        }
      }
    }

    // Process any remaining buffer content
    const remainingStripped = stripAnsi(buffer.trim());
    if (remainingStripped.length > 0) {
      assistantText += (assistantText ? "\n" : "") + remainingStripped;
    }
  } catch (err) {
    proc.kill("SIGKILL");
    if (aborted) {
      yield {
        type: "error",
        error: "Query was aborted",
      } satisfies ForgeMessage;
      return;
    }
    yield {
      type: "error",
      error: `Failed to read forge output: ${err instanceof Error ? err.message : String(err)}`,
    };
    return;
  }

  const exitCode = await proc.exited;

  // Resolve stderr text (already being read concurrently)
  const stderrText = await stderrPromise;

  // Check stderr for ERROR status lines that forge writes there
  if (!hasError && stderrText.trim()) {
    for (const line of stderrText.split("\n")) {
      const stripped = stripAnsi(line.trim());
      const statusMatch = stripped.match(STATUS_LINE_RE);
      if (statusMatch?.[1]) {
        const errorMatch = statusMatch[1].match(ERROR_LINE_RE);
        if (errorMatch?.[1]) {
          hasError = true;
          errorMessage = errorMatch[1];
          yield {
            type: "error",
            error: errorMessage,
          } satisfies ForgeMessage;
          break;
        }
      }
    }
  }

  // Handle non-zero exit codes (that weren't already caught as ERROR status lines)
  if (exitCode !== 0 && !hasError) {
    yield {
      type: "error",
      error: stderrText.trim() || `Forge process exited with code ${exitCode}`,
      exitCode,
    };
    return;
  }

  // Yield system init if forge didn't emit one (e.g., immediate error)
  if (!systemYielded) {
    yield {
      type: "system",
      subtype: "init",
      session_id: sessionId || generateSessionId(),
    } satisfies ForgeMessage;
  }

  // Determine the final result text
  let resultText = assistantText || "(no output)";

  // Wire outputFormat: attempt JSON extraction + optional zod validation when json_schema is requested
  if (options?.outputFormat?.type === "json_schema") {
    try {
      const extracted = extractJsonFromText(resultText);
      const jsonValue = typeof extracted === "string" ? JSON.parse(extracted) : extracted;

      // Validate with Zod and yield the typed result
      if (options.outputFormat.z instanceof z.ZodType) {
        const verbose = options.outputFormat.verboseErrors ?? false;
        try {
          const validated = (options.outputFormat.z as z.ZodType).parse(jsonValue);
          // Yield the validated object so consumers get a typed value
          yield {
            type: "result",
            result: validated as ResolveResultType<O>,
            session_id: sessionId || generateSessionId(),
          } satisfies ForgeMessage<ResolveResultType<O>>;
          return;
        } catch (err) {
          if (err instanceof z.ZodError) {
            const issueDetail = verbose ? `: ${JSON.stringify(err.issues)}` : "";
            throw new Error(`JSON output failed schema validation${issueDetail}`);
          }
          throw err;
        }
      } else {
        // No z — yield the parsed JSON object directly (typed as string)
        yield {
          type: "result",
          result: jsonValue as ResolveResultType<O>,
          session_id: sessionId || generateSessionId(),
        } satisfies ForgeMessage<ResolveResultType<O>>;
        return;
      }
    } catch {
      // Extraction or validation failed — return raw text as-is
    }
  }

  // Always yield a result with the accumulated assistant text (plain string, no JSON)
  yield {
    type: "result",
    result: resultText as ResolveResultType<O>,
    session_id: sessionId || generateSessionId(),
  } satisfies ForgeMessage<ResolveResultType<O>>;
}
