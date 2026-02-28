#!/usr/bin/env node
const nodeVersion = parseInt(process.versions.node.split(".")[0], 10);
if (nodeVersion < 18) {
  process.stderr.write(
    `agent-lint requires Node.js >= 18. Current: ${process.versions.node}\n`
  );
  process.exit(1);
}

import { runStdioServer } from "./stdio.js";
import { runHttpServer } from "./http.js";
import { logMcp } from "./logger.js";

// ---------------------------------------------------------------------------
// CLI argument parsing (no new deps — simple process.argv)
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

function getFlagValue(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

if (hasFlag("help") || hasFlag("h")) {
  process.stderr.write([
    "Usage: agent-lint-mcp [options]",
    "",
    "Options:",
    "  --http         Start HTTP transport (StreamableHTTP) instead of stdio",
    "  --port <n>     HTTP port (default: 3001, or MCP_HTTP_PORT env var)",
    "  --host <addr>  HTTP bind address (default: 127.0.0.1)",
    "  --help, -h     Show this help message",
    "",
  ].join("\n"));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Transport selection
// ---------------------------------------------------------------------------

if (hasFlag("http")) {
  const port = getFlagValue("port") ? parseInt(getFlagValue("port")!, 10) : undefined;
  const hostname = getFlagValue("host") ?? undefined;

  runHttpServer({ port, hostname }).catch((error) => {
    logMcp("error", "mcp.http.fatal", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    process.exit(1);
  });
} else {
  runStdioServer().catch((error) => {
    logMcp("error", "mcp.stdio.fatal", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    process.exit(1);
  });
}
