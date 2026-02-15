import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startMcpHttpServer, type RunningMcpHttpServer } from "@/mcp/http/server";

describe("MCP auth scope enforcement", () => {
  let running: RunningMcpHttpServer | null = null;

  beforeEach(() => {
    vi.stubEnv("LLM_PROVIDER", "mock");
    vi.stubEnv("MCP_REQUIRE_AUTH", "true");
    vi.stubEnv("MCP_BEARER_TOKENS", "scoped-client=scope-token:validate");
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (running) {
      await running.close();
      running = null;
    }
  });

  it("allows validate scope and blocks analyze scope", async () => {
    running = await startMcpHttpServer({ host: "127.0.0.1", port: 0 });

    const client = new Client({ name: "agentlint-scope-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${running.baseUrl}/mcp`), {
      requestInit: {
        headers: {
          Authorization: "Bearer scope-token",
        },
      },
    });

    try {
      await client.connect(transport);

      const validateResult = await client.callTool({
        name: "validate_export",
        arguments: {
          content: "# Safe",
        },
      });

      expect(validateResult.isError).not.toBe(true);

      await expect(
        client.callTool({
          name: "prepare_artifact_fix_context",
          arguments: {
            type: "rules",
          },
        }),
      ).rejects.toBeTruthy();

      await expect(
        client.callTool({
          name: "analyze_artifact",
          arguments: {
            type: "agents",
            content: "# AGENTS.md\n\nRules.",
          },
        }),
      ).rejects.toBeTruthy();

      await expect(
        client.callTool({
          name: "quality_gate_artifact",
          arguments: {
            type: "rules",
            content: "# Rules\n\nNever expose secrets.",
          },
        }),
      ).rejects.toBeTruthy();

      await expect(
        client.callTool({
          name: "submit_client_assessment",
          arguments: {
            type: "rules",
            content: "# Rules\n\nNever expose secrets.",
            assessment: {
              repositoryScanSummary: "Scanned rules files.",
              metricScores: [{ metric: "clarity", score: 80 }],
              metricEvidence: [{ metric: "clarity", citations: [{ snippet: "Evidence" }] }],
            },
          },
        }),
      ).rejects.toBeTruthy();
    } finally {
      await client.close();
      await transport.close();
    }
  });
});
