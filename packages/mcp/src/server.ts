import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAgentLintPrompts } from "./prompts/register-prompts.js";
import { registerAgentLintResources } from "./resources/register-resources.js";
import { registerAgentLintTools } from "./tools/index.js";

export const DEFAULT_MCP_SERVER_NAME = "agentlint";

const DEFAULT_MCP_INSTRUCTIONS =
  [
    "Agent Lint MCP focuses on AGENTS.md, CLAUDE.md, skills, rules, workflows, and plans artifacts.",
    "Primary worker is MCP client LLM: scan repository, evaluate artifacts with evidence, rewrite content, then re-run quality loop.",
    "Fix/update flow: first call prepare_artifact_fix_context to get weights, required flow, and assessment template.",
    "Policy-first flow: read scoring-policy + assessment-schema resources, compute client metric scores, call submit_client_assessment, then run quality_gate_artifact with candidateContent and clientAssessment.",
    "quality_gate_artifact requires clientAssessment by default in client-led mode.",
    "Use analyze_artifact or analyze_context_bundle as advisory diagnostics when deeper server-side signals are needed.",
    "Before final output ensure validate_export passes.",
    "Use suggest_patch for selective segment-level merges when needed.",
    "Never auto-run destructive actions; keep recommendations verifiable and repository-specific.",
  ].join(" ");

export type AgentLintTransportMode = "stdio" | "http";

export type CreateAgentLintMcpServerOptions = {
  name?: string;
  version?: string;
  instructions?: string;
  transportMode?: AgentLintTransportMode;
  enableWorkspaceScan?: boolean;
  enableApplyPatches?: boolean;
};

function resolveServerVersion(): string {
  return process.env.npm_package_version ?? "0.1.0";
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

  return process.env.MCP_ENABLE_WORKSPACE_SCAN === "true";
}

/**
 * apply_patches is only enabled in stdio (local) mode by default.
 * HTTP mode disables it entirely per great_plan.md §1.3.
 */
function resolveApplyPatchesEnabled(options: CreateAgentLintMcpServerOptions): boolean {
  if (typeof options.enableApplyPatches === "boolean") {
    return options.enableApplyPatches;
  }

  // Only enabled in stdio mode (local-first)
  if (options.transportMode === "stdio") {
    return process.env.MCP_ENABLE_APPLY_PATCHES !== "false";
  }

  // Disabled in HTTP mode by default
  return false;
}

function resolveInstructions(options: CreateAgentLintMcpServerOptions, workspaceScanEnabled: boolean): string {
  if (options.instructions) {
    return options.instructions;
  }

  if (workspaceScanEnabled) {
    return `${DEFAULT_MCP_INSTRUCTIONS} Local workspace scanning is enabled via analyze_workspace_artifacts.`;
  }

  return `${DEFAULT_MCP_INSTRUCTIONS} Workspace scanning is disabled in this transport; provide file content explicitly for analysis.`;
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
        prompts: {
          listChanged: true,
        },
        resources: {
          listChanged: true,
        },
      },
    },
  );

  const applyPatchesEnabled = resolveApplyPatchesEnabled(options);

  registerAgentLintTools(server, {
    enableWorkspaceScan: workspaceScanEnabled,
    enableApplyPatches: applyPatchesEnabled,
  });
  registerAgentLintPrompts(server);
  registerAgentLintResources(server);

  return server;
}
