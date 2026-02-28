import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAnalyzeArtifactTool } from "./analyze-artifact.js";
import { registerAnalyzeContextBundleTool } from "./analyze-context-bundle.js";
import {
  registerAnalyzeWorkspaceArtifactsTool,
  type RegisterAnalyzeWorkspaceArtifactsOptions,
} from "./analyze-workspace-artifacts.js";
import { registerPrepareArtifactFixContextTool } from "./prepare-artifact-fix-context.js";
import { registerQualityGateArtifactTool } from "./quality-gate-artifact.js";
import { registerSubmitClientAssessmentTool } from "./submit-client-assessment.js";
import { registerSuggestPatchTool } from "./suggest-patch.js";
import { registerValidateExportTool } from "./validate-export.js";

export {
  executeAnalyzeArtifactTool,
  type AnalyzeArtifactToolOutput,
} from "./analyze-artifact.js";
export {
  executeAnalyzeContextBundleTool,
  type AnalyzeContextBundleToolOutput,
} from "./analyze-context-bundle.js";
export {
  executeAnalyzeWorkspaceArtifactsTool,
  type AnalyzeWorkspaceArtifactsToolOutput,
} from "./analyze-workspace-artifacts.js";
export {
  executePrepareArtifactFixContextTool,
  type PrepareArtifactFixContextToolOutput,
} from "./prepare-artifact-fix-context.js";
export {
  executeQualityGateArtifactTool,
  type QualityGateArtifactToolOutput,
} from "./quality-gate-artifact.js";
export {
  executeSubmitClientAssessmentTool,
  type SubmitClientAssessmentToolOutput,
} from "./submit-client-assessment.js";
export { executeSuggestPatchTool, type SuggestPatchToolOutput } from "./suggest-patch.js";
export {
  executeValidateExportTool,
  type ValidateExportToolOutput,
} from "./validate-export.js";

export type RegisterAgentLintToolsOptions = {
  enableWorkspaceScan: boolean;
};

export function registerAgentLintTools(
  server: McpServer,
  options: RegisterAgentLintToolsOptions,
): void {
  registerPrepareArtifactFixContextTool(server);
  registerAnalyzeArtifactTool(server);
  registerAnalyzeContextBundleTool(server);
  registerSubmitClientAssessmentTool(server);
  registerQualityGateArtifactTool(server);
  registerSuggestPatchTool(server);
  registerValidateExportTool(server);
  registerAnalyzeWorkspaceArtifactsTool(server, {
    enabled: options.enableWorkspaceScan,
  } satisfies RegisterAnalyzeWorkspaceArtifactsOptions);
}
