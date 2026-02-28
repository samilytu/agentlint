import { runStdioServer } from "./stdio.js";
import { logMcp } from "./logger.js";

runStdioServer().catch((error) => {
  logMcp("error", "mcp.stdio.fatal", {
    error: error instanceof Error ? error.message : "Unknown error",
  });
  process.exit(1);
});
