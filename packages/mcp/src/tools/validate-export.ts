import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { validateMarkdownOrYaml } from "@agent-lint/core";

import { validateExportInputSchema, type ValidateExportInput } from "@agent-lint/shared";
import { toToolResult } from "./tool-result.js";

export type ValidateExportToolOutput = {
  valid: boolean;
  reason: string | null;
};

export function executeValidateExportTool(input: ValidateExportInput): ValidateExportToolOutput {
  return validateMarkdownOrYaml(input.content);
}

export function registerValidateExportTool(server: McpServer): void {
  server.registerTool(
    "validate_export",
    {
      title: "Validate Export",
      description:
        "Final hard guardrail before returning artifact content. Validates markdown/yaml export safety constraints.",
      inputSchema: validateExportInputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async (args) => {
      try {
        const output = executeValidateExportTool(args);
        return toToolResult({
          summary: output.valid ? "Export content is valid." : `Export invalid: ${output.reason}`,
          structuredContent: output,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toToolResult({
          summary: `validate_export failed: ${message}`,
          structuredContent: { error: message },
          isError: true,
        });
      }
    },
  );
}
