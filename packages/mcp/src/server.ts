import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAgentLintPrompts } from "./prompts/register-prompts.js";
import { registerAgentLintResources } from "./resources/register-resources.js";
import { registerAgentLintTools } from "./tools/index.js";

export const DEFAULT_MCP_SERVER_NAME = "agentlint";

declare const __MCP_VERSION__: string;

const DEFAULT_MCP_INSTRUCTIONS =
  [
    "Agent Lint is a meta-agent orchestrator for AI coding agent context artifacts (AGENTS.md, CLAUDE.md, skills, rules, workflows, plans).",
    "It provides guidelines, action plans, and maintenance rules — the client LLM does all file reading and writing.",
    "Call agentlint_get_guidelines before creating or updating any context artifact.",
    "Call agentlint_plan_workspace_autofix to discover all artifacts in a workspace and get a step-by-step fix plan.",
    "Call agentlint_quick_check after structural changes to check if context artifacts need updating.",
    "Call agentlint_emit_maintenance_snippet to get a persistent rule snippet for continuous context hygiene.",
    "Call agentlint_score_artifact to score any context artifact against 12 quality dimensions and get targeted improvement suggestions for autoresearch loops.",
    "Apply safe context-artifact changes directly using your file editing capabilities unless the user explicitly wants a different outcome or the host approval model requires a gate.",
    "Tell the user when Agent Lint guidance triggered or shaped a context update.",
  ].join(" ");

export type AgentLintTransportMode = "stdio" | "http";

export type CreateAgentLintMcpServerOptions = {
  name?: string;
  version?: string;
  instructions?: string;
  transportMode?: AgentLintTransportMode;
  enableWorkspaceScan?: boolean;
};

function resolveServerVersion(): string {
  if (
    process.env.npm_package_name === "@agent-lint/mcp" &&
    process.env.npm_package_version
  ) {
    return process.env.npm_package_version;
  }

  if (typeof __MCP_VERSION__ === "string" && __MCP_VERSION__.length > 0) {
    return __MCP_VERSION__;
  }

  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
    ) as { version?: string };
    if (typeof pkg.version === "string" && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // Fall through to the dev default when package metadata is unavailable.
  }

  return "0.0.0-dev";
}

function resolveWorkspaceScanEnabled(options: CreateAgentLintMcpServerOptions): boolean {
  if (typeof options.enableWorkspaceScan === "boolean") {
    return options.enableWorkspaceScan;
  }

  if (options.transportMode === "stdio") {
    return process.env.MCP_ENABLE_WORKSPACE_SCAN !== "false";
  }

  if (options.transportMode === "http") {
    return process.env.MCP_ENABLE_WORKSPACE_SCAN === "true";
  }

  return process.env.MCP_ENABLE_WORKSPACE_SCAN !== "false";
}

function resolveInstructions(options: CreateAgentLintMcpServerOptions, workspaceScanEnabled: boolean): string {
  if (options.instructions) {
    return options.instructions;
  }

  if (workspaceScanEnabled) {
    return `${DEFAULT_MCP_INSTRUCTIONS} Local workspace scanning is enabled via agentlint_plan_workspace_autofix.`;
  }

  return `${DEFAULT_MCP_INSTRUCTIONS} Workspace scanning is disabled in this transport.`;
}

export function createAgentLintMcpServer(
  options: CreateAgentLintMcpServerOptions = {},
): McpServer {
  const workspaceScanEnabled = resolveWorkspaceScanEnabled(options);

  const server = new McpServer(
    {
      name: options.name ?? DEFAULT_MCP_SERVER_NAME,
      version: options.version ?? resolveServerVersion(),
    },
    {
      instructions: resolveInstructions(options, workspaceScanEnabled),
      capabilities: {
        tools: {
          listChanged: true,
        },
        resources: {
          listChanged: true,
        },
      },
    },
  );

  registerAgentLintTools(server, {
    enableWorkspaceScan: workspaceScanEnabled,
  });
  registerAgentLintPrompts(server);
  registerAgentLintResources(server);

  return server;
}
