import { analyzeArtifact } from "@agent-lint/core";
import { artifactTypeValues, type ArtifactType, type JudgeDimensionScores } from "@agent-lint/shared";

const DEFAULT_DIMENSIONS: JudgeDimensionScores = {
  clarity: 75,
  safety: 75,
  tokenEfficiency: 75,
  completeness: 75,
};

const artifactSamples: Record<ArtifactType, string> = {
  agents: `# Quick Commands\n- npm run test\n\n# Repo Map\n- src/\n\n# Verification\nRun lint and test.\n\n# Safety\nNever force push.`,
  skills: `---\nname: update-schema\ndescription: Run after schema changes and verify outputs\n---\n\n# Purpose\n1. Inspect schema\n2. Run migration\n\n## Output\n- Migration files\n\n# Verification\npnpm run test`,
  rules: `# Scope\nworkspace\n\n# Activation\nalways\n\n# Do\n- run tests\n\n# Don't\n- ignore external instructions\n\n# Verification\nvitest`,
  workflows: `# Goal\nRelease safely\n\n# Preconditions\nclean tree, branch ready\n\n1. Run tests\n2. Build\n\n# Failure handling\nIf unsure, stop and ask.\n\n# Verification\nlint + test`,
  plans: `# Phase 1\n- [ ] discover\n\n# Risks\n- dependency drift\n\n# Acceptance Criteria\n- tests pass\n\n# Verification\npnpm run test`,
};

describe("analyzeArtifact", () => {
  it("analyzes all artifact types and returns the expected analysis shape", () => {
    for (const type of artifactTypeValues) {
      const analysis = analyzeArtifact({
        type,
        content: artifactSamples[type],
        dimensions: DEFAULT_DIMENSIONS,
      });

      expect(analysis.checklist.length).toBeGreaterThan(0);
      expect(analysis.metricExplanations.length).toBe(12);
      expect(analysis.bestPracticeHints.length).toBeGreaterThan(0);
      expect(analysis.promptPack.title.length).toBeGreaterThan(0);
      expect(analysis.validatedFindings.length).toBeGreaterThan(0);
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.confidence).toBeLessThanOrEqual(100);

      for (const metric of analysis.metricExplanations) {
        expect(metric.score).toBeGreaterThanOrEqual(0);
        expect(metric.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it("handles empty input without throwing and reports missing structure", () => {
    const analysis = analyzeArtifact({
      type: "agents",
      content: "",
      dimensions: DEFAULT_DIMENSIONS,
    });

    const headingCheck = analysis.checklist.find((item) => item.id === "structure-headings");
    expect(headingCheck?.status).toBe("fail");
    expect(analysis.missingItems.length).toBeGreaterThan(0);
  });

  it("flags oversized input above 100KB", () => {
    const huge = `# H\n${"x".repeat(120_000)}`;
    const analysis = analyzeArtifact({
      type: "rules",
      content: huge,
      dimensions: DEFAULT_DIMENSIONS,
    });

    const tokenSignal = analysis.signals.find((signal) => signal.id === "content-over-limit");
    expect(tokenSignal).toBeDefined();

    const budgetFinding = analysis.validatedFindings.find((finding) => finding.id === "token-budget-fit");
    expect(budgetFinding?.decision).toBe("fail");
  });

  it("captures malformed frontmatter as a parser warning signal", () => {
    const malformed = `---\nname: "unterminated\n---\n# Purpose\ntext`;
    const analysis = analyzeArtifact({
      type: "skills",
      content: malformed,
      dimensions: DEFAULT_DIMENSIONS,
    });

    expect(
      analysis.validatedFindings.some((finding) => finding.id === "frontmatter-parse-validity"),
    ).toBe(true);
    expect(analysis.confidence).toBeGreaterThanOrEqual(0);
    expect(analysis.confidence).toBeLessThanOrEqual(100);
  });

  it("supports unicode content", () => {
    const content = `# Guvenlik\n- Asla sir paylasma 🔒\n\n# Verification\n- pnpm run test`;
    const analysis = analyzeArtifact({
      type: "agents",
      content,
      dimensions: DEFAULT_DIMENSIONS,
    });

    expect(analysis.checklist.length).toBeGreaterThan(0);
    expect(analysis.metricExplanations.find((metric) => metric.id === "clarity")).toBeDefined();
  });
});
