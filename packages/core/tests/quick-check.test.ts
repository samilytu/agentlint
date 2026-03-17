import { runQuickCheck } from "@agent-lint/core";
import { describe, expect, it } from "vitest";

describe("quick-check", () => {
  it("returns no signals for empty input", () => {
    const result = runQuickCheck();
    expect(result.signals).toHaveLength(0);
    expect(result.markdown).toContain("No context artifact updates");
  });

  it("detects package and lockfile changes", () => {
    const result = runQuickCheck(["package.json"]);
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.signals[0].trigger).toContain("Package manifest");
    expect(result.signals[0].affectedArtifacts).toContain("agents");

    const lockfileResult = runQuickCheck(["pnpm-lock.yaml"]);
    expect(lockfileResult.signals.some((s) => s.trigger.includes("lockfile"))).toBe(true);
  });

  it("detects CI config changes", () => {
    const result = runQuickCheck([".github/workflows/ci.yml"]);
    expect(result.signals.some((s) => s.trigger.includes("CI"))).toBe(true);
  });

  it("detects env file changes", () => {
    const result = runQuickCheck([".env.local"]);
    expect(result.signals.some((s) => s.trigger.includes("Security-sensitive"))).toBe(true);
  });

  it("detects IDE config changes", () => {
    const result = runQuickCheck([".cursor/rules/new-rule.md"]);
    expect(result.signals.some((s) => s.trigger.includes("instruction file"))).toBe(true);
  });

  it("detects Cursor rule changes with a specific maintenance signal", () => {
    const result = runQuickCheck([".cursor/rules/new-rule.mdc"]);
    expect(result.signals.some((s) => s.trigger === "Cursor rule file changed")).toBe(true);
  });

  it("detects Copilot instruction changes with a specific maintenance signal", () => {
    const result = runQuickCheck([".github/copilot-instructions.md"]);
    expect(result.signals.some((s) => s.trigger === "Copilot instruction file changed")).toBe(true);
  });

  it("detects root context baseline changes", () => {
    const result = runQuickCheck(["AGENTS.md"]);
    expect(result.signals.some((s) => s.trigger === "Root context baseline changed")).toBe(true);
  });

  it("detects doctor, prompt, and core planning files as public maintenance surface changes", () => {
    const result = runQuickCheck([
      "packages/cli/src/commands/doctor.tsx",
      "packages/cli/src/commands/prompt.tsx",
      "packages/core/src/plan-builder.ts",
      "packages/core/src/workspace-discovery.ts",
    ]);

    expect(
      result.signals.some((s) => s.trigger === "Agent Lint public maintenance surface changed"),
    ).toBe(true);
  });

  it("detects description-based signals for new feature", () => {
    const result = runQuickCheck(undefined, "Added new feature for payments");
    expect(result.signals.some((s) => s.trigger.includes("New module or feature"))).toBe(true);
  });

  it("detects description-based signals for security", () => {
    const result = runQuickCheck(undefined, "Updated authentication logic");
    expect(result.signals.some((s) => s.trigger.includes("Security-related"))).toBe(true);
  });

  it("does not over-trigger on an ordinary source file change", () => {
    const result = runQuickCheck(["packages/core/src/index.ts"]);
    expect(result.signals).toHaveLength(0);
  });

  it("does not treat Dockerfile or top-level metadata files as directory changes", () => {
    expect(runQuickCheck(["Dockerfile"]).signals).toHaveLength(0);
    expect(runQuickCheck(["LICENSE"]).signals).toHaveLength(0);
  });

  it("does not misclassify unrelated paths as security-sensitive", () => {
    const result = runQuickCheck(["packages/authoring/src/index.ts"]);
    expect(result.signals.some((s) => s.trigger.includes("Security-sensitive"))).toBe(false);
  });

  it("detects explicit directory or module boundary changes", () => {
    const result = runQuickCheck(["packages/new-module"]);
    expect(result.signals.some((s) => s.trigger.includes("Directory or module boundary"))).toBe(true);
  });

  it("deduplicates signals", () => {
    const result = runQuickCheck(
      ["package.json", "package.json"],
    );
    const packageTriggers = result.signals.filter((s) =>
      s.trigger.includes("Package manifest"),
    );
    expect(packageTriggers).toHaveLength(1);
  });

  it("markdown output includes next steps", () => {
    const result = runQuickCheck(["package.json"]);
    expect(result.markdown).toContain("## Next steps");
    expect(result.markdown).toContain("## Agent Lint default guidance");
    expect(result.markdown).toContain("If the user explicitly asks for a different context outcome");
  });
});
