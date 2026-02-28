import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { computeSha256 } from "@agent-lint/core";
import { clientMetricIds, type ClientAssessmentInput } from "@agent-lint/shared";
import { describe, expect, it } from "vitest";

import {
  executeAnalyzeArtifactTool,
  executeAnalyzeContextBundleTool,
  executeAnalyzeWorkspaceArtifactsTool,
  executeApplyPatchesTool,
  executePrepareArtifactFixContextTool,
  executeQualityGateArtifactTool,
  executeSubmitClientAssessmentTool,
  executeSuggestPatchTool,
  executeValidateExportTool,
} from "../src/tools/index.js";

function buildClientAssessment(): ClientAssessmentInput {
  return {
    repositoryScanSummary: "Scanned AGENTS.md and docs for policy evidence.",
    scannedPaths: ["AGENTS.md", "docs/great_plan.md"],
    metricScores: clientMetricIds.map((metric) => ({
      metric,
      score: 90,
    })),
    metricEvidence: clientMetricIds.map((metric) => ({
      metric,
      citations: [
        {
          filePath: "AGENTS.md",
          lineStart: 1,
          snippet: `Evidence for ${metric}`,
        },
      ],
    })),
    weightedScore: 90,
    confidence: 90,
    gaps: ["Tighten operational guardrails wording."],
    rewritePlan: "Refine directives and keep verification steps explicit.",
  };
}

describe("MCP tool handlers", () => {
  it("executes prepare_artifact_fix_context", () => {
    const output = executePrepareArtifactFixContextTool({
      type: "agents",
      targetScore: 92,
    });

    expect(output.targetScore).toBe(92);
    expect(output.requiredFlow.length).toBeGreaterThan(0);
    expect(output.assessmentTemplate.metricScores.length).toBe(clientMetricIds.length);
  });

  it("executes analyze_artifact", async () => {
    const output = await executeAnalyzeArtifactTool({
      type: "agents",
      content: "# AGENTS\n\n## Scope\n- Keep behavior deterministic.",
    });

    expect(typeof output.score).toBe("number");
    expect(Array.isArray(output.warnings)).toBe(true);
    expect(output.analysisMode).toBe("deterministic");
  });

  it("executes analyze_context_bundle", async () => {
    const output = await executeAnalyzeContextBundleTool({
      type: "agents",
      content: "# AGENTS\n\n- Primary policy.",
      contextDocuments: [
        {
          label: "Rules",
          path: "docs/rules.md",
          content: "# Rules\n\n- Verify all outputs.",
        },
      ],
      includeMergedContentPreview: true,
    });

    expect(typeof output.score).toBe("number");
    expect(output.contextSummary.provided).toBe(1);
    expect(typeof output.mergedContentPreview).toBe("string");
  });

  it("executes suggest_patch", () => {
    const output = executeSuggestPatchTool({
      originalContent: "line one\nline two\n",
      refinedContent: "line one\nline two updated\n",
    });

    expect(output.segmentCount).toBeGreaterThan(0);
    expect(output.suggestedContent).toContain("updated");
  });

  it("executes validate_export", () => {
    const output = executeValidateExportTool({
      content: "# Valid markdown\n\n- Item",
    });

    expect(output.valid).toBe(true);
    expect(output.reason).toBeNull();
  });

  it("executes submit_client_assessment", async () => {
    const output = await executeSubmitClientAssessmentTool({
      type: "agents",
      content: "# AGENTS\n\n## Execution\n- Always include verification.",
      assessment: buildClientAssessment(),
      targetScore: 85,
    });

    expect(typeof output.finalScore).toBe("number");
    expect(output.requiredFlow.length).toBeGreaterThan(0);
    expect(output.policyVersion.length).toBeGreaterThan(0);
  });

  it("executes quality_gate_artifact", async () => {
    const output = await executeQualityGateArtifactTool({
      type: "agents",
      content: "# AGENTS\n\n## Baseline\n- Keep responses concise.",
      candidateContent: "# AGENTS\n\n## Baseline\n- Keep responses concise.\n- Add explicit checks.",
      clientAssessment: buildClientAssessment(),
      targetScore: 80,
    });

    expect(typeof output.finalScore).toBe("number");
    expect(output.enforcement.clientAssessmentProvided).toBe(true);
    expect(output.scoreModel).toBe("client_weighted_hybrid");
  });

  it("executes analyze_workspace_artifacts", async () => {
    const output = await executeAnalyzeWorkspaceArtifactsTool({
      rootPath: process.cwd(),
      maxFiles: 5,
    });

    expect(output.rootPath.length).toBeGreaterThan(0);
    expect(output.analyzedCount).toBeGreaterThan(0);
    expect(Array.isArray(output.findings)).toBe(true);
  });

  it("executes apply_patches in dry-run mode", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "agentlint-mcp-tools-"));

    try {
      const original = "# AGENTS\n\n- baseline\n";
      const patched = "# AGENTS\n\n- baseline\n- improved\n";
      const fileName = "AGENTS.md";
      const filePath = path.join(tempDir, fileName);

      await writeFile(filePath, original, "utf8");

      const output = executeApplyPatchesTool({
        filePath: fileName,
        patchedContent: patched,
        expectedHash: computeSha256(original),
        workDir: tempDir,
        allowWrite: true,
        dryRun: true,
      });

      expect(output.success).toBe(true);
      expect(output.dryRun).toBe(true);
      expect(output.preview).toBeTruthy();

      const after = await readFile(filePath, "utf8");
      expect(after).toBe(original);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("executes apply_patches with write enabled", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "agentlint-mcp-tools-"));

    try {
      const original = "# Rules\n\n- rule a\n";
      const patched = "# Rules\n\n- rule a\n- rule b\n";
      const fileName = "rules.md";
      const filePath = path.join(tempDir, fileName);

      await writeFile(filePath, original, "utf8");

      const output = executeApplyPatchesTool({
        filePath: fileName,
        patchedContent: patched,
        expectedHash: computeSha256(original),
        workDir: tempDir,
        allowWrite: true,
        dryRun: false,
      });

      expect(output.success).toBe(true);
      expect(output.dryRun).toBe(false);
      expect(output.newHash).toBe(computeSha256(patched));
      expect(output.backupPath).toContain(".agentlint-backup");

      const after = await readFile(filePath, "utf8");
      expect(after).toBe(patched);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects apply_patches when allowWrite is false", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "agentlint-mcp-tools-"));

    try {
      const original = "# Plan\n\n- step 1\n";
      const fileName = "plan.md";
      const filePath = path.join(tempDir, fileName);

      await writeFile(filePath, original, "utf8");

      const output = executeApplyPatchesTool({
        filePath: fileName,
        patchedContent: "# Plan\n\n- step 1\n- step 2\n",
        expectedHash: computeSha256(original),
        workDir: tempDir,
        allowWrite: false,
      });

      expect(output.success).toBe(false);
      expect(output.errorCode).toBe("WRITE_NOT_ALLOWED");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
