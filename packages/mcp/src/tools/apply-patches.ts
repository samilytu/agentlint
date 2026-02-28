import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { applyPatchSecure, computeSha256 } from "@agent-lint/core";
import { applyPatchesInputSchema, type ApplyPatchesInput } from "@agent-lint/shared";
import { toToolResult } from "./tool-result.js";

export type ApplyPatchesToolOutput = {
  success: boolean;
  filePath: string;
  backupPath: string;
  newHash: string;
  dryRun: boolean;
  preview?: {
    patchedContentLength: number;
    expectedHash: string;
    computedNewHash: string;
  };
  error?: string;
  errorCode?: string;
};

export function executeApplyPatchesTool(input: ApplyPatchesInput): ApplyPatchesToolOutput {
  const workDir = input.workDir ?? process.cwd();
  const dryRun = input.dryRun ?? true; // dry-run default per great_plan.md

  const result = applyPatchSecure({
    filePath: input.filePath,
    patchedContent: input.patchedContent,
    expectedHash: input.expectedHash,
    workDir,
    allowWrite: input.allowWrite,
    dryRun,
  });

  if (!result.ok) {
    return {
      success: false,
      filePath: input.filePath,
      backupPath: "",
      newHash: "",
      dryRun,
      error: result.error.message,
      errorCode: result.error.code,
    };
  }

  const output: ApplyPatchesToolOutput = {
    success: true,
    filePath: result.value.filePath,
    backupPath: result.value.backupPath,
    newHash: result.value.newHash,
    dryRun: result.value.dryRun,
  };

  if (result.value.dryRun) {
    output.preview = {
      patchedContentLength: input.patchedContent.length,
      expectedHash: input.expectedHash,
      computedNewHash: computeSha256(input.patchedContent),
    };
  }

  return output;
}

export type RegisterApplyPatchesToolOptions = {
  enabled: boolean;
};

export function registerApplyPatchesTool(
  server: McpServer,
  options: RegisterApplyPatchesToolOptions,
): void {
  if (!options.enabled) {
    return;
  }

  server.registerTool(
    "apply_patches",
    {
      title: "Apply Patches",
      description:
        "Write patched content to an artifact file with full security guards: SHA-256 hash verification, extension allowlist (.md/.yaml/.yml/.txt), path traversal protection, automatic backup, and dry-run by default. Requires allowWrite=true and dryRun=false to actually write. Only available in stdio (local) transport mode.",
      inputSchema: applyPatchesInputSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
      },
    },
    async (args) => {
      try {
        const output = executeApplyPatchesTool(args);

        if (!output.success) {
          return toToolResult({
            summary: `apply_patches rejected: [${output.errorCode}] ${output.error}`,
            structuredContent: output,
            isError: true,
          });
        }

        const mode = output.dryRun ? "dry-run" : "applied";
        return toToolResult({
          summary: `apply_patches ${mode}: ${output.filePath} → hash=${output.newHash.slice(0, 12)}... backup=${output.backupPath}`,
          structuredContent: output,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toToolResult({
          summary: `apply_patches failed: ${message}`,
          structuredContent: { error: message },
          isError: true,
        });
      }
    },
  );
}
