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
import { registerApplyPatchesTool, type RegisterApplyPatchesToolOptions } from "./apply-patches.js";
import { withTimeoutGuard } from "./tool-result.js";

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
export { executeApplyPatchesTool, type ApplyPatchesToolOutput } from "./apply-patches.js";

export type RegisterAgentLintToolsOptions = {
  enableWorkspaceScan: boolean;
  enableApplyPatches: boolean;
};

export function registerAgentLintTools(
  server: McpServer,
  options: RegisterAgentLintToolsOptions,
): void {
  // Wrap server with timeout guard so every tool gets automatic timeout protection
  const guarded = withTimeoutGuard(server);

  registerPrepareArtifactFixContextTool(guarded);
  registerAnalyzeArtifactTool(guarded);
  registerAnalyzeContextBundleTool(guarded);
  registerSubmitClientAssessmentTool(guarded);
  registerQualityGateArtifactTool(guarded);
  registerSuggestPatchTool(guarded);
  registerValidateExportTool(guarded);
  registerAnalyzeWorkspaceArtifactsTool(guarded, {
    enabled: options.enableWorkspaceScan,
  } satisfies RegisterAnalyzeWorkspaceArtifactsOptions);
  registerApplyPatchesTool(guarded, {
    enabled: options.enableApplyPatches,
  } satisfies RegisterApplyPatchesToolOptions);
}
