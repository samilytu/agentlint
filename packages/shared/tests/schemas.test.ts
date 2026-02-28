import {
  MCP_TOOL_NAMES,
  MCP_TOOL_SCOPE_REQUIREMENTS,
  analyzeArtifactInputSchema,
  analyzeContextBundleInputSchema,
  analyzeWorkspaceArtifactsInputSchema,
  clientAssessmentSchema,
  mcpContextDocumentSchema,
  prepareArtifactFixContextInputSchema,
  qualityGateArtifactInputSchema,
  submitClientAssessmentInputSchema,
  suggestPatchInputSchema,
  validateExportInputSchema,
} from "@agent-lint/shared";

function createValidAssessment() {
  return {
    repositoryScanSummary: "Scanned AGENTS.md and related docs.",
    metricScores: [{ metric: "clarity", score: 90 }],
    metricEvidence: [
      {
        metric: "clarity",
        citations: [{ snippet: "Use precise, deterministic steps." }],
      },
    ],
  } as const;
}

describe("schemas", () => {
  it("exposes MCP tool names and scope requirements", () => {
    expect(MCP_TOOL_NAMES).toHaveLength(8);
    expect(MCP_TOOL_SCOPE_REQUIREMENTS.analyze_artifact).toBe("analyze");
    expect(MCP_TOOL_SCOPE_REQUIREMENTS.suggest_patch).toBe("patch");
    expect(MCP_TOOL_SCOPE_REQUIREMENTS.validate_export).toBe("validate");
  });

  it("validates mcp context document schema", () => {
    const valid = {
      label: "Rules",
      content: "No destructive commands.",
      type: "rules",
      priority: 5,
    } as const;

    expect(mcpContextDocumentSchema.parse(valid)).toEqual(valid);
    expect(mcpContextDocumentSchema.safeParse({ label: "Rules", content: "" }).success).toBe(false);
  });

  it("validates analyze_artifact input schema", () => {
    const valid = {
      type: "agents",
      content: "# AGENTS",
      contextDocuments: [{ label: "Plan", content: "Phased plan" }],
      analysisEnabled: true,
    } as const;

    expect(analyzeArtifactInputSchema.parse(valid)).toEqual(valid);
    expect(analyzeArtifactInputSchema.safeParse({ type: "agents", content: "" }).success).toBe(false);
  });

  it("validates prepare_artifact_fix_context input schema", () => {
    expect(
      prepareArtifactFixContextInputSchema.parse({
        type: "skills",
        targetScore: 90,
        includeExamples: true,
      }),
    ).toEqual({
      type: "skills",
      targetScore: 90,
      includeExamples: true,
    });

    expect(
      prepareArtifactFixContextInputSchema.safeParse({
        type: "skills",
        targetScore: 101,
      }).success,
    ).toBe(false);
  });

  it("validates analyze_context_bundle input schema", () => {
    const valid = {
      type: "rules",
      content: "# Rules",
      contextDocuments: [{ label: "Guide", content: "Guide body" }],
      analysisEnabled: false,
      includeMergedContentPreview: true,
    } as const;

    expect(analyzeContextBundleInputSchema.parse(valid)).toEqual(valid);
    expect(
      analyzeContextBundleInputSchema.safeParse({
        type: "rules",
        content: "# Rules",
        contextDocuments: [],
      }).success,
    ).toBe(false);
  });

  it("validates suggest_patch input schema", () => {
    const valid = {
      originalContent: "old",
      refinedContent: "new",
      selectedSegmentIndexes: [0, 2],
    } as const;

    expect(suggestPatchInputSchema.parse(valid)).toEqual(valid);
    expect(suggestPatchInputSchema.safeParse({ originalContent: "x" }).success).toBe(false);
  });

  it("validates validate_export input schema", () => {
    expect(validateExportInputSchema.parse({ content: "# Final" })).toEqual({ content: "# Final" });
    expect(validateExportInputSchema.safeParse({ content: "" }).success).toBe(false);
  });

  it("validates client assessment schema", () => {
    const valid = createValidAssessment();
    expect(clientAssessmentSchema.parse(valid)).toEqual(valid);

    const invalid = {
      repositoryScanSummary: "scan",
      metricScores: [{ metric: "clarity", score: 80 }],
      metricEvidence: [{ metric: "clarity", citations: [] }],
    };
    expect(clientAssessmentSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates submit_client_assessment input schema", () => {
    const valid = {
      type: "workflows",
      content: "# Workflow",
      assessment: createValidAssessment(),
      targetScore: 85,
      analysisEnabled: true,
    } as const;

    expect(submitClientAssessmentInputSchema.parse(valid)).toEqual(valid);
    expect(
      submitClientAssessmentInputSchema.safeParse({
        type: "workflows",
        content: "# Workflow",
      }).success,
    ).toBe(false);
  });

  it("validates quality_gate_artifact input schema", () => {
    const valid = {
      type: "plans",
      content: "# Plan",
      requireClientAssessment: true,
      applyPatchWhenBelowTarget: true,
      candidateContent: "# Better Plan",
      clientAssessment: createValidAssessment(),
      selectedSegmentIndexes: [0],
      iterationIndex: 1,
      previousFinalScore: 70,
      analysisEnabled: true,
    } as const;

    const parsed = qualityGateArtifactInputSchema.parse(valid);
    expect(parsed.type).toBe("plans");
    expect(parsed.iterationIndex).toBe(1);
    expect(parsed.clientAssessment.metricScores).toHaveLength(1);

    expect(
      qualityGateArtifactInputSchema.safeParse({
        type: "plans",
        content: "# Plan",
        iterationIndex: 0,
      }).success,
    ).toBe(false);
  });

  it("validates analyze_workspace_artifacts input schema", () => {
    const valid = {
      rootPath: ".",
      maxFiles: 20,
      includePatterns: ["AGENTS\\.md", "skills"],
      analysisEnabled: true,
    } as const;

    expect(analyzeWorkspaceArtifactsInputSchema.parse(valid)).toEqual(valid);
    expect(analyzeWorkspaceArtifactsInputSchema.safeParse({ maxFiles: 0 }).success).toBe(false);
  });
});
