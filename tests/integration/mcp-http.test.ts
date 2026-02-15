import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startMcpHttpServer, type RunningMcpHttpServer } from "@/mcp/http/server";

const CLIENT_METRICS = [
  "clarity",
  "specificity",
  "scope-control",
  "completeness",
  "actionability",
  "verifiability",
  "safety",
  "injection-resistance",
  "secret-hygiene",
  "token-efficiency",
  "platform-fit",
  "maintainability",
] as const;

describe("MCP streamable HTTP server", () => {
  let running: RunningMcpHttpServer | null = null;

  beforeEach(() => {
    vi.stubEnv("LLM_PROVIDER", "mock");
    vi.stubEnv("MCP_BEARER_TOKENS", "test-client=test-token:*");
    vi.stubEnv("MCP_REQUIRE_AUTH", "true");
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (running) {
      await running.close();
      running = null;
    }
  });

  it("accepts authenticated clients and serves MCP tools", async () => {
    running = await startMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
    });

    const ready = await fetch(`${running.baseUrl}/readyz`);
    expect(ready.status).toBe(200);
    const readyPayload = (await ready.json()) as Record<string, unknown>;
    expect(readyPayload.capabilities).toEqual(
      expect.objectContaining({
        tools: true,
        prompts: true,
        resources: true,
      }),
    );
    expect(Array.isArray(readyPayload.advertisedToolNames)).toBe(true);
    expect(readyPayload.advertisedToolNames).toEqual(
      expect.arrayContaining([
        "prepare_artifact_fix_context",
        "submit_client_assessment",
        "quality_gate_artifact",
      ]),
    );
    expect(readyPayload.resourceTemplates).toEqual(
      expect.arrayContaining([
        "agentlint://scoring-policy/{type}",
        "agentlint://assessment-schema/{type}",
        "agentlint://improvement-playbook/{type}",
      ]),
    );

    const client = new Client({ name: "agentlint-http-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${running.baseUrl}/mcp`), {
      requestInit: {
        headers: {
          Authorization: "Bearer test-token",
        },
      },
    });

    try {
      await client.connect(transport);

      const listed = await client.listTools();
      const toolNames = listed.tools.map((tool) => tool.name);
      expect(toolNames).toEqual(
        expect.arrayContaining([
          "prepare_artifact_fix_context",
          "analyze_artifact",
          "analyze_context_bundle",
          "submit_client_assessment",
          "quality_gate_artifact",
          "suggest_patch",
          "validate_export",
        ]),
      );
      expect(toolNames.includes("analyze_workspace_artifacts")).toBe(false);

      const prompts = await client.listPrompts();
      expect(prompts.prompts.some((prompt) => prompt.name === "artifact_review_prompt")).toBe(true);

      const resources = await client.listResources();
      expect(resources.resources.some((resource) => resource.uri === "agentlint://quality-metrics/agents")).toBe(
        true,
      );
      expect(
        resources.resources.some((resource) => resource.uri === "agentlint://artifact-path-hints/agents"),
      ).toBe(true);
      expect(resources.resources.some((resource) => resource.uri === "agentlint://artifact-spec/agents")).toBe(
        true,
      );
      expect(resources.resources.some((resource) => resource.uri === "agentlint://scoring-policy/agents")).toBe(
        true,
      );
      expect(resources.resources.some((resource) => resource.uri === "agentlint://assessment-schema/agents")).toBe(
        true,
      );
      expect(
        resources.resources.some((resource) => resource.uri === "agentlint://improvement-playbook/agents"),
      ).toBe(true);

      const resourceRead = await client.readResource({
        uri: "agentlint://scoring-policy/agents",
      });
      const firstContent = resourceRead.contents[0];
      if (!firstContent || !("text" in firstContent)) {
        throw new Error("Expected text resource content for scoring policy");
      }
      expect(firstContent.text).toContain("clientWeighted*90%");

      const result = await client.callTool({
        name: "validate_export",
        arguments: {
          content: "# Valid markdown",
        },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toEqual(
        expect.objectContaining({
          valid: true,
        }),
      );

      const prepare = await client.callTool({
        name: "prepare_artifact_fix_context",
        arguments: {
          type: "agents",
        },
      });
      expect(prepare.isError).not.toBe(true);
      expect(prepare.structuredContent).toEqual(
        expect.objectContaining({
          policySnapshot: expect.any(Object),
        }),
      );
    } finally {
      await client.close();
      await transport.close();
    }
  });

  it("rejects unauthenticated clients", async () => {
    running = await startMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
    });

    const client = new Client({ name: "agentlint-http-test-no-auth", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${running.baseUrl}/mcp`));

    await expect(client.connect(transport)).rejects.toBeTruthy();

    await transport.close();
  });

  it("supports stateless compatibility mode with resources and quality gate", async () => {
    vi.stubEnv("MCP_HTTP_STATELESS", "true");
    running = await startMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
    });

    const client = new Client({ name: "agentlint-http-test-stateless", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${running.baseUrl}/mcp`), {
      requestInit: {
        headers: {
          Authorization: "Bearer test-token",
        },
      },
    });

    try {
      await client.connect(transport);

      const listed = await client.listTools();
      expect(listed.tools.some((tool) => tool.name === "quality_gate_artifact")).toBe(true);

      const resources = await client.listResources();
      expect(resources.resources.some((resource) => resource.uri === "agentlint://artifact-spec/agents")).toBe(
        true,
      );

      const qualityGate = await client.callTool({
        name: "quality_gate_artifact",
        arguments: {
          type: "agents",
          content: "# AGENTS.md\n\nNever run destructive commands automatically.",
          targetScore: 80,
          candidateContent:
            "# AGENTS.md\n\nNever run destructive commands automatically.\n\n## Verification\n- Run lint and tests before merge.",
          clientAssessment: {
            repositoryScanSummary: "Scanned AGENTS.md and docs for policy alignment.",
            metricScores: CLIENT_METRICS.map((metric) => ({ metric, score: 86 })),
            metricEvidence: CLIENT_METRICS.map((metric) => ({
              metric,
              citations: [{ filePath: "AGENTS.md", snippet: `Evidence for ${metric}` }],
            })),
          },
        },
      });

      expect(qualityGate.isError).not.toBe(true);
      expect(qualityGate.structuredContent).toEqual(
        expect.objectContaining({
          initialScore: expect.any(Number),
          score: expect.any(Number),
          finalScore: expect.any(Number),
          scoreModel: "client_weighted_hybrid",
        }),
      );

      const strictWithoutAssessment = await client.callTool({
        name: "quality_gate_artifact",
        arguments: {
          type: "agents",
          content: "# AGENTS.md\n\nNever run destructive commands automatically.",
          targetScore: 80,
        },
      });
      expect(strictWithoutAssessment.isError).not.toBe(true);
      expect(strictWithoutAssessment.structuredContent).toEqual(
        expect.objectContaining({
          passed: false,
          enforcement: expect.objectContaining({
            violationCode: "CLIENT_ASSESSMENT_REQUIRED",
          }),
        }),
      );

      const submitAssessment = await client.callTool({
        name: "submit_client_assessment",
        arguments: {
          type: "agents",
          content: "# AGENTS.md\n\nNever run destructive commands automatically.",
          targetScore: 80,
          assessment: {
            repositoryScanSummary: "Scanned AGENTS.md and docs.",
            metricScores: CLIENT_METRICS.map((metric) => ({ metric, score: 85 })),
            metricEvidence: CLIENT_METRICS.map((metric) => ({
              metric,
              citations: [{ filePath: "AGENTS.md", snippet: `Citation ${metric}` }],
            })),
          },
        },
      });
      expect(submitAssessment.isError).not.toBe(true);
      expect(submitAssessment.structuredContent).toEqual(
        expect.objectContaining({
          finalScore: expect.any(Number),
          policyVersion: "client-led-v1",
        }),
      );
    } finally {
      await client.close();
      await transport.close();
    }
  });
});
