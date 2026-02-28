#!/usr/bin/env node
const nodeVersion = parseInt(process.versions.node.split(".")[0], 10);
if (nodeVersion < 18) {
  process.stderr.write(
    `agent-lint requires Node.js >= 18. Current: ${process.versions.node}\n`
  );
  process.exit(1);
}

import { runStdioServer } from "./stdio.js";
import { logMcp } from "./logger.js";

runStdioServer().catch((error) => {
  logMcp("error", "mcp.stdio.fatal", {
    error: error instanceof Error ? error.message : "Unknown error",
  });
  process.exit(1);
});
