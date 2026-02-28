// @agent-lint/cli — Watch Mode
// Uses node:fs/watch (recursive) to monitor artifact files and re-run analysis on change.
// No new dependencies — Node.js built-in only.

import { watch, type FSWatcher } from "node:fs";
import { writeStderr } from "./utils.js";

// ─── Types ───────────────────────────────────────────────────────

export type WatchOptions = {
  /** Root directory to watch */
  rootDir: string;
  /** Callback invoked on detected changes (debounced) */
  onChange: (changedPath: string) => Promise<void>;
  /** Debounce interval in ms (default: 300) */
  debounceMs?: number;
  /** File extensions to watch (default: [".md", ".mdx", ".txt", ".yaml", ".yml"]) */
  extensions?: string[];
  /** Signal to abort watching */
  signal?: AbortSignal;
};

export type WatchHandle = {
  /** Stop watching and clean up */
  close: () => void;
};

// ─── Constants ───────────────────────────────────────────────────

const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_EXTENSIONS = [".md", ".mdx", ".txt", ".yaml", ".yml"];

const SKIP_SEGMENTS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".agentlint",
]);

// ─── Implementation ──────────────────────────────────────────────

function shouldIgnore(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments.some((segment) => SKIP_SEGMENTS.has(segment));
}

function hasValidExtension(filePath: string, extensions: string[]): boolean {
  const lower = filePath.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

/**
 * Creates a debounced file watcher that monitors a directory for artifact changes.
 * Uses node:fs/watch with recursive option for efficient OS-level file monitoring.
 *
 * @returns A WatchHandle that can be used to stop watching.
 */
export function createWatcher(options: WatchOptions): WatchHandle {
  const {
    rootDir,
    onChange,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    extensions = DEFAULT_EXTENSIONS,
    signal,
  } = options;

  let watcher: FSWatcher | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isProcessing = false;
  const pendingPaths = new Set<string>();

  function cleanup(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (watcher !== null) {
      watcher.close();
      watcher = null;
    }
    pendingPaths.clear();
  }

  function scheduleBatch(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      if (isProcessing || pendingPaths.size === 0) {
        return;
      }

      isProcessing = true;
      const paths = [...pendingPaths];
      pendingPaths.clear();

      for (const changedPath of paths) {
        try {
          await onChange(changedPath);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          writeStderr(`watch: error processing ${changedPath}: ${message}`);
        }
      }

      isProcessing = false;

      // If more changes arrived while processing, schedule another batch
      if (pendingPaths.size > 0) {
        scheduleBatch();
      }
    }, debounceMs);
  }

  try {
    watcher = watch(rootDir, { recursive: true, signal }, (eventType, filename) => {
      if (!filename) {
        return;
      }

      // Filter by extension and skip ignored paths
      if (shouldIgnore(filename) || !hasValidExtension(filename, extensions)) {
        return;
      }

      pendingPaths.add(filename);
      scheduleBatch();
    });

    watcher.on("error", (err) => {
      const message = err instanceof Error ? err.message : String(err);
      writeStderr(`watch: watcher error: ${message}`);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeStderr(`watch: failed to start watcher: ${message}`);
    cleanup();
  }

  // Support AbortSignal for clean shutdown
  if (signal) {
    signal.addEventListener("abort", () => {
      cleanup();
    }, { once: true });
  }

  return {
    close: cleanup,
  };
}

/**
 * Prints the watch mode banner to stderr.
 */
export function printWatchBanner(rootDir: string): void {
  writeStderr(`\nWatching for changes in ${rootDir}...`);
  writeStderr("Press Ctrl+C to stop.\n");
}
