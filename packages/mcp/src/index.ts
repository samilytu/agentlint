// @agent-lint/mcp — MCP server (stdio transport)
// Zero state, read-only analysis, stderr logging only

export {
  createAgentLintMcpServer,
  DEFAULT_MCP_SERVER_NAME,
  type AgentLintTransportMode,
  type CreateAgentLintMcpServerOptions,
} from "./server.js";

export { runStdioServer } from "./stdio.js";

export {
  registerAgentLintTools,
  type RegisterAgentLintToolsOptions,
  executeAnalyzeArtifactTool,
  type AnalyzeArtifactToolOutput,
  executeAnalyzeContextBundleTool,
  type AnalyzeContextBundleToolOutput,
  executeAnalyzeWorkspaceArtifactsTool,
  type AnalyzeWorkspaceArtifactsToolOutput,
  executePrepareArtifactFixContextTool,
  type PrepareArtifactFixContextToolOutput,
  executeQualityGateArtifactTool,
  type QualityGateArtifactToolOutput,
  executeSubmitClientAssessmentTool,
  type SubmitClientAssessmentToolOutput,
  executeSuggestPatchTool,
  type SuggestPatchToolOutput,
  executeValidateExportTool,
  type ValidateExportToolOutput,
} from "./tools/index.js";

export { registerAgentLintResources } from "./resources/register-resources.js";
export { registerAgentLintPrompts } from "./prompts/register-prompts.js";
