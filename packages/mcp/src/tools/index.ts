import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerGetGuidelinesTool } from "./get-guidelines.js";
import { registerPlanWorkspaceAutofixTool } from "./plan-workspace-autofix.js";
import { registerQuickCheckTool } from "./quick-check.js";
import { registerEmitMaintenanceSnippetTool } from "./emit-maintenance-snippet.js";
import { registerScoreArtifactTool } from "./score-artifact.js";

export type RegisterAgentLintToolsOptions = {
  enableWorkspaceScan: boolean;
};

export function registerAgentLintTools(
  server: McpServer,
  options: RegisterAgentLintToolsOptions,
): void {
  registerGetGuidelinesTool(server);
  registerPlanWorkspaceAutofixTool(server, { enabled: options.enableWorkspaceScan });
  registerQuickCheckTool(server);
  registerEmitMaintenanceSnippetTool(server);
  registerScoreArtifactTool(server);
}
