/**
 * Transport security utilities for MCP server.
 *
 * - Message size limiting for JSON-RPC transport
 * - Tool execution timeout wrapper
 *
 * @module
 */

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { logMcp } from "./logger.js";
import { CURRENT_TOOL_TIMEOUTS, LEGACY_TOOL_TIMEOUT_ALIASES } from "./catalog.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum allowed JSON-RPC message size in bytes (10 MB).
 * Prevents memory exhaustion from oversized payloads.
 */
export const MAX_JSONRPC_MESSAGE_BYTES = 10 * 1024 * 1024;

/**
 * Per-tool timeout values in milliseconds for the current public tool surface.
 */
export const TOOL_TIMEOUTS: Record<string, number> = {
  ...CURRENT_TOOL_TIMEOUTS,
  ...LEGACY_TOOL_TIMEOUT_ALIASES,
};

/** Default timeout for unknown tools: 30 seconds */
export const DEFAULT_TOOL_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Message size guard
// ---------------------------------------------------------------------------

/**
 * Wraps a Transport's `onmessage` callback so that oversized messages are
 * rejected before reaching the MCP server's handler. The message is serialized
 * to JSON to compute its byte length — the same representation that travels
 * over stdio.
 *
 * Non-destructive: the original transport is returned (mutated in-place for
 * the `onmessage` wrapper). All other methods are untouched.
 */
export function applyMessageSizeGuard<T extends Transport>(
  transport: T,
  maxBytes: number = MAX_JSONRPC_MESSAGE_BYTES,
): T {
  const originalStart = transport.start.bind(transport);

  transport.start = async function () {
    await originalStart();

    // After start(), the MCP SDK will have assigned `onmessage`.
    // We wrap it to add the size check.
    const downstream = transport.onmessage;
    if (!downstream) {
      return;
    }

    transport.onmessage = (message: JSONRPCMessage, extra?: unknown) => {
      const serialized = JSON.stringify(message);
      const byteLength = Buffer.byteLength(serialized, "utf8");

      if (byteLength > maxBytes) {
        logMcp("warn", "transport.message_too_large", {
          byteLength,
          maxBytes,
          preview: serialized.slice(0, 200),
        });

        // Drop the message — do not forward to server
        if (transport.onerror) {
          transport.onerror(
            new Error(`JSON-RPC message too large: ${byteLength} bytes (limit: ${maxBytes} bytes)`),
          );
        }
        return;
      }

      // Forward to the real handler
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (downstream as (...args: unknown[]) => void)(message, extra);
    };
  };

  return transport;
}

// ---------------------------------------------------------------------------
// Tool timeout
// ---------------------------------------------------------------------------

/**
 * Error subclass for tool execution timeouts.
 */
export class ToolTimeoutError extends Error {
  public readonly toolName: string;
  public readonly timeoutMs: number;

  constructor(toolName: string, timeoutMs: number) {
    super(`Tool "${toolName}" timed out after ${timeoutMs}ms`);
    this.name = "ToolTimeoutError";
    this.toolName = toolName;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Returns the configured timeout for a given tool name.
 */
export function getToolTimeout(toolName: string): number {
  return TOOL_TIMEOUTS[toolName] ?? DEFAULT_TOOL_TIMEOUT_MS;
}

/**
 * Wraps an async function with a timeout. If the function does not resolve
 * within `timeoutMs`, a `ToolTimeoutError` is thrown.
 *
 * Uses `AbortSignal.timeout()` where available (Node 18+), with a
 * `setTimeout` fallback.
 */
export async function withToolTimeout<T>(
  toolName: string,
  fn: () => Promise<T>,
  timeoutMs?: number,
): Promise<T> {
  const ms = timeoutMs ?? getToolTimeout(toolName);

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        logMcp("warn", "tool.timeout", { toolName, timeoutMs: ms });
        reject(new ToolTimeoutError(toolName, ms));
      }
    }, ms);

    fn().then(
      (result) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }
      },
      (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      },
    );
  });
}
