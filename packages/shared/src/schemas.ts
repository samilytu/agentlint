import { z } from "zod";

import { artifactTypeSchema } from "./artifacts.js";

// --- MVP Tool Names ---

export const MCP_TOOL_NAMES = [
  "agentlint_get_guidelines",
  "agentlint_plan_workspace_autofix",
  "agentlint_quick_check",
  "agentlint_emit_maintenance_snippet",
] as const;

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

// --- Client types ---

export const mcpClientValues = [
  "cursor",
  "windsurf",
  "vscode",
  "claude-desktop",
  "claude-code",
  "generic",
] as const;

export type McpClient = (typeof mcpClientValues)[number];

export const mcpClientSchema = z
  .enum(mcpClientValues)
  .optional()
  .describe(
    "Target MCP client environment. Affects path hints and snippet format. Defaults to generic.",
  );

// --- Tool Input Schemas ---

export const getGuidelinesInputSchema = z.object({
  type: artifactTypeSchema.describe(
    "Artifact type to get guidelines for: agents, skills, rules, workflows, or plans.",
  ),
  client: mcpClientSchema,
});

export type GetGuidelinesInput = z.infer<typeof getGuidelinesInputSchema>;

export const planWorkspaceAutofixInputSchema = z.object({
  rootPath: z
    .string()
    .optional()
    .describe("Workspace root path. Defaults to current working directory."),
});

export type PlanWorkspaceAutofixInput = z.infer<typeof planWorkspaceAutofixInputSchema>;

export const quickCheckInputSchema = z.object({
  changedPaths: z
    .array(z.string().min(1).max(512))
    .optional()
    .describe("List of file/directory paths that changed."),
  changeDescription: z
    .string()
    .max(2_000)
    .optional()
    .describe("Optional human description of what changed."),
});

export type QuickCheckInput = z.infer<typeof quickCheckInputSchema>;

export const emitMaintenanceSnippetInputSchema = z.object({
  client: mcpClientSchema,
});

export type EmitMaintenanceSnippetInput = z.infer<typeof emitMaintenanceSnippetInputSchema>;

export const scoreArtifactInputSchema = z.object({
  content: z
    .string()
    .min(1)
    .max(50_000)
    .describe("Full text content of the artifact to score."),
  type: artifactTypeSchema.describe(
    "Artifact type: agents, skills, rules, workflows, or plans.",
  ),
});

export type ScoreArtifactInput = z.infer<typeof scoreArtifactInputSchema>;
