// @agent-lint/mcp — MCP server (stdio + HTTP transport)
// Zero state, no file writing, stderr logging only

export {
  createAgentLintMcpServer,
  DEFAULT_MCP_SERVER_NAME,
  type AgentLintTransportMode,
  type CreateAgentLintMcpServerOptions,
} from "./server.js";

export { runStdioServer } from "./stdio.js";

export { runHttpServer, type HttpServerOptions } from "./http.js";

export {
  createSecurityContext,
  validateRequest,
  setCorsHeaders,
  handleCorsPreflightIfNeeded,
  sendJsonError,
  parseJsonBody,
  startRateLimitCleanup,
  stopRateLimitCleanup,
  type HttpSecurityOptions,
  type HttpSecurityContext,
} from "./http-security.js";

export {
  registerAgentLintTools,
  type RegisterAgentLintToolsOptions,
} from "./tools/index.js";

export { registerAgentLintResources } from "./resources/register-resources.js";
export { registerAgentLintPrompts } from "./prompts/register-prompts.js";
export {
  applyMessageSizeGuard,
  withToolTimeout,
  getToolTimeout,
  ToolTimeoutError,
  TOOL_TIMEOUTS,
  MAX_JSONRPC_MESSAGE_BYTES,
  DEFAULT_TOOL_TIMEOUT_MS,
} from "./transport-security.js";
