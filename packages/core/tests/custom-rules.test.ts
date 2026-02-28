import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  validateCustomRuleCheck,
  executeCustomRule,
  loadCustomRulesFromDir,
  loadPlugins,
  loadCustomRules,
  runCustomRules,
  type CustomRuleFunction,
  type CustomRuleCheck,
  type CustomRuleContext,
  type CustomRuleModule,
} from "../src/custom-rules.js";

// ─── Fixtures ────────────────────────────────────────────────────

const VALID_CHECK: CustomRuleCheck = {
  id: "test-rule-1",
  label: "Test Rule",
  metric: "clarity",
  requirement: "recommended",
  status: "pass",
  description: "Test passes when content is clear",
  recommendation: "Keep content clear",
  evidence: null,
};

const SAMPLE_CONTEXT: CustomRuleContext = {
  type: "agents",
  content: "# AGENTS.md\n\nSome agent instructions here.",
};

const passingRule: CustomRuleFunction = (_ctx) => [
  {
    id: "always-pass",
    label: "Always Pass",
    metric: "clarity",
    requirement: "recommended",
    status: "pass",
    description: "This rule always passes",
    recommendation: "No action needed",
    evidence: null,
  },
];

const failingRule: CustomRuleFunction = (_ctx) => [
  {
    id: "always-fail",
    label: "Always Fail",
    metric: "safety",
    requirement: "mandatory",
    status: "fail",
    description: "This rule always fails",
    recommendation: "Fix the issue",
    evidence: "Found a problem",
  },
];

const throwingRule: CustomRuleFunction = (_ctx) => {
  throw new Error("Rule exploded");
};

const multiCheckRule: CustomRuleFunction = (ctx) => {
  const checks: CustomRuleCheck[] = [];
  if (ctx.content.length > 10) {
    checks.push({
      id: "has-content",
      label: "Has Content",
      metric: "completeness",
      requirement: "mandatory",
      status: "pass",
      description: "Content has sufficient length",
      recommendation: "Ensure content is not empty",
      evidence: `Content length: ${ctx.content.length}`,
    });
  }
  if (!ctx.content.includes("## ")) {
    checks.push({
      id: "missing-sections",
      label: "Missing Sections",
      metric: "completeness",
      requirement: "recommended",
      status: "improve",
      description: "Content lacks H2 sections",
      recommendation: "Add section headings with ##",
      evidence: null,
    });
  }
  return checks;
};

// ─── validateCustomRuleCheck ─────────────────────────────────────

describe("validateCustomRuleCheck", () => {
  it("accepts a valid check", () => {
    expect(validateCustomRuleCheck(VALID_CHECK)).toBeNull();
  });

  it("rejects null", () => {
    expect(validateCustomRuleCheck(null)).toBe("Rule check must be a non-null object");
  });

  it("rejects non-object", () => {
    expect(validateCustomRuleCheck("string")).toBe("Rule check must be a non-null object");
  });

  it("rejects missing id", () => {
    expect(validateCustomRuleCheck({ ...VALID_CHECK, id: "" })).toBe(
      "Rule check 'id' must be a non-empty string",
    );
  });

  it("rejects invalid metric", () => {
    expect(validateCustomRuleCheck({ ...VALID_CHECK, metric: "invalid" })).toMatch(
      /Rule check 'metric' must be one of/,
    );
  });

  it("rejects invalid status", () => {
    expect(validateCustomRuleCheck({ ...VALID_CHECK, status: "unknown" })).toBe(
      "Rule check 'status' must be 'pass', 'improve', or 'fail'",
    );
  });

  it("rejects invalid requirement", () => {
    expect(validateCustomRuleCheck({ ...VALID_CHECK, requirement: "optional" })).toBe(
      "Rule check 'requirement' must be 'mandatory' or 'recommended'",
    );
  });

  it("rejects empty description", () => {
    expect(validateCustomRuleCheck({ ...VALID_CHECK, description: "" })).toBe(
      "Rule check 'description' must be a non-empty string",
    );
  });

  it("rejects invalid evidence type", () => {
    expect(validateCustomRuleCheck({ ...VALID_CHECK, evidence: 123 })).toBe(
      "Rule check 'evidence' must be a string or null",
    );
  });

  it("accepts evidence as string", () => {
    expect(validateCustomRuleCheck({ ...VALID_CHECK, evidence: "found something" })).toBeNull();
  });

  it("accepts all 12 valid metric IDs", () => {
    const metrics = [
      "clarity", "specificity", "scope-control", "completeness",
      "actionability", "verifiability", "safety", "injection-resistance",
      "secret-hygiene", "token-efficiency", "platform-fit", "maintainability",
    ];
    for (const metric of metrics) {
      expect(validateCustomRuleCheck({ ...VALID_CHECK, metric })).toBeNull();
    }
  });
});

// ─── executeCustomRule ───────────────────────────────────────────

describe("executeCustomRule", () => {
  it("executes a passing rule and returns namespaced checks", () => {
    const result = executeCustomRule(passingRule, SAMPLE_CONTEXT, "test.js", false);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0].id).toBe("custom:always-pass");
    expect(result.errors).toHaveLength(0);
  });

  it("executes a failing rule and returns namespaced checks", () => {
    const result = executeCustomRule(failingRule, SAMPLE_CONTEXT, "test.js", false);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0].id).toBe("custom:always-fail");
    expect(result.checks[0].status).toBe("fail");
  });

  it("namespaces plugin rules differently", () => {
    const result = executeCustomRule(passingRule, SAMPLE_CONTEXT, "my-plugin", true);
    expect(result.checks[0].id).toBe("plugin:my-plugin/always-pass");
  });

  it("catches thrown errors gracefully", () => {
    const result = executeCustomRule(throwingRule, SAMPLE_CONTEXT, "broken.js", false);
    expect(result.checks).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Rule from broken.js threw: Rule exploded/);
  });

  it("rejects non-array return values", () => {
    const badRule = (() => "not an array") as unknown as CustomRuleFunction;
    const result = executeCustomRule(badRule, SAMPLE_CONTEXT, "bad.js", false);
    expect(result.checks).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/non-array/);
  });

  it("truncates if too many checks returned", () => {
    const manyChecks: CustomRuleFunction = () =>
      Array.from({ length: 60 }, (_, i) => ({
        ...VALID_CHECK,
        id: `check-${i}`,
      }));
    const result = executeCustomRule(manyChecks, SAMPLE_CONTEXT, "many.js", false);
    expect(result.checks).toHaveLength(50);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/60 checks.*max 50/);
  });

  it("filters out invalid checks from mixed results", () => {
    const mixedRule: CustomRuleFunction = () => [
      VALID_CHECK,
      { ...VALID_CHECK, id: "", label: "bad" }, // invalid: empty id
    ];
    const result = executeCustomRule(mixedRule, SAMPLE_CONTEXT, "mixed.js", false);
    expect(result.checks).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });
});

// ─── runCustomRules ──────────────────────────────────────────────

describe("runCustomRules", () => {
  it("runs all rules from multiple modules", () => {
    const modules: CustomRuleModule[] = [
      { source: "rules/a.js", rules: [passingRule] },
      { source: "rules/b.js", rules: [failingRule, multiCheckRule] },
    ];
    const result = runCustomRules(modules, SAMPLE_CONTEXT);
    // passingRule: 1 check, failingRule: 1 check, multiCheckRule: 2 checks (has-content + missing-sections)
    expect(result.checks.length).toBeGreaterThanOrEqual(3);
    expect(result.errors).toHaveLength(0);
  });

  it("collects errors from failing rules", () => {
    const modules: CustomRuleModule[] = [
      { source: "rules/bad.js", rules: [throwingRule, passingRule] },
    ];
    const result = runCustomRules(modules, SAMPLE_CONTEXT);
    expect(result.checks).toHaveLength(1); // passingRule still runs
    expect(result.errors).toHaveLength(1); // throwingRule error
  });

  it("returns empty for no modules", () => {
    const result = runCustomRules([], SAMPLE_CONTEXT);
    expect(result.checks).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("detects plugin modules by source path format", () => {
    const modules: CustomRuleModule[] = [
      { source: "@agent-lint/plugin-security", rules: [passingRule] },
    ];
    const result = runCustomRules(modules, SAMPLE_CONTEXT);
    expect(result.checks[0].id).toMatch(/^plugin:/);
  });

  it("detects file-based modules by source path format", () => {
    const modules: CustomRuleModule[] = [
      { source: "/home/user/.agentlint/rules/my-rule.js", rules: [passingRule] },
    ];
    const result = runCustomRules(modules, SAMPLE_CONTEXT);
    expect(result.checks[0].id).toMatch(/^custom:/);
  });
});

// ─── loadCustomRulesFromDir ──────────────────────────────────────

describe("loadCustomRulesFromDir", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `agentlint-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(tempDir, ".agentlint", "rules"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("loads .mjs rule files from .agentlint/rules/", async () => {
    const ruleContent = `
export const rules = [
  (ctx) => [{
    id: "file-rule",
    label: "File Rule",
    metric: "clarity",
    requirement: "recommended",
    status: "pass",
    description: "Loaded from file",
    recommendation: "None",
    evidence: null,
  }]
];
`;
    await writeFile(join(tempDir, ".agentlint", "rules", "my-rule.mjs"), ruleContent, "utf8");

    const result = await loadCustomRulesFromDir(tempDir, false);
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0].rules).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("returns empty when .agentlint/rules/ does not exist", async () => {
    const emptyDir = join(tmpdir(), `agentlint-empty-${Date.now()}`);
    await mkdir(emptyDir, { recursive: true });
    try {
      const result = await loadCustomRulesFromDir(emptyDir, false);
      expect(result.modules).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });

  it("reports errors for invalid rule files", async () => {
    await writeFile(
      join(tempDir, ".agentlint", "rules", "bad.mjs"),
      "export const rules = 'not an array';",
      "utf8",
    );

    const result = await loadCustomRulesFromDir(tempDir, false);
    expect(result.modules).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/does not export any valid rule functions/);
  });

  it("suppresses errors in silent mode", async () => {
    await writeFile(
      join(tempDir, ".agentlint", "rules", "bad.mjs"),
      "export const rules = 'not an array';",
      "utf8",
    );

    const result = await loadCustomRulesFromDir(tempDir, true);
    expect(result.modules).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("ignores non-.js/.mjs files", async () => {
    await writeFile(join(tempDir, ".agentlint", "rules", "notes.txt"), "just notes", "utf8");
    await writeFile(join(tempDir, ".agentlint", "rules", "config.json"), "{}", "utf8");

    const result = await loadCustomRulesFromDir(tempDir, false);
    expect(result.modules).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("loads default export function as single rule", async () => {
    const ruleContent = `
export default function(ctx) {
  return [{
    id: "default-fn",
    label: "Default Function Rule",
    metric: "safety",
    requirement: "mandatory",
    status: ctx.content.includes("safe") ? "pass" : "fail",
    description: "Checks for safe keyword",
    recommendation: "Add safe keyword",
    evidence: null,
  }];
}
`;
    await writeFile(join(tempDir, ".agentlint", "rules", "default-rule.mjs"), ruleContent, "utf8");

    const result = await loadCustomRulesFromDir(tempDir, false);
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0].rules).toHaveLength(1);
  });
});

// ─── loadPlugins ─────────────────────────────────────────────────

describe("loadPlugins", () => {
  it("reports error for non-existent packages", async () => {
    const result = await loadPlugins(["@agent-lint/nonexistent-plugin-xyz-123"], false);
    expect(result.modules).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].source).toBe("@agent-lint/nonexistent-plugin-xyz-123");
  });

  it("returns empty for empty package list", async () => {
    const result = await loadPlugins([], false);
    expect(result.modules).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("suppresses errors in silent mode", async () => {
    const result = await loadPlugins(["@agent-lint/nonexistent-plugin-xyz-123"], true);
    expect(result.modules).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── loadCustomRules (combined loader) ───────────────────────────

describe("loadCustomRules", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `agentlint-combined-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(tempDir, ".agentlint", "rules"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("loads from directory when no plugins specified", async () => {
    const ruleContent = `
export const rules = [
  (ctx) => [{
    id: "combined-test",
    label: "Combined Test",
    metric: "clarity",
    requirement: "recommended",
    status: "pass",
    description: "Test",
    recommendation: "None",
    evidence: null,
  }]
];
`;
    await writeFile(join(tempDir, ".agentlint", "rules", "rule.mjs"), ruleContent, "utf8");

    const result = await loadCustomRules({ rootDir: tempDir });
    expect(result.modules).toHaveLength(1);
  });

  it("reports plugin errors alongside directory results", async () => {
    const result = await loadCustomRules({
      rootDir: tempDir,
      plugins: ["@agent-lint/nonexistent-xyz-456"],
    });
    expect(result.errors).toHaveLength(1);
  });

  it("uses cwd as default rootDir", async () => {
    // Should not throw — just searches cwd
    const result = await loadCustomRules({ silent: true });
    expect(result).toHaveProperty("modules");
    expect(result).toHaveProperty("errors");
  });
});

// ─── Integration: custom checks flow through analyzer ────────────

describe("custom rules integration with analyzeArtifact", () => {
  it("accepts customChecks in analyzeArtifact and includes them in results", async () => {
    // Dynamic import to test the actual integration
    const { analyzeArtifact } = await import("../src/analyzer.js");

    const customChecks = [
      {
        id: "custom:my-rule",
        label: "My Custom Rule",
        metric: "clarity",
        requirement: "recommended" as const,
        status: "fail" as const,
        description: "Custom rule detected an issue",
        recommendation: "Fix the issue",
        evidence: "Found on line 5",
      },
    ];

    const result = analyzeArtifact({
      type: "agents",
      content: "# AGENTS.md\n\nSome content here for testing.\n\n## Rules\n\n- Do this\n- Don't do that",
      dimensions: { clarity: 75, safety: 75, tokenEfficiency: 75, completeness: 75 },
      customChecks,
    });

    // Custom check should appear in checklist
    const customItem = result.checklist.find((item) => item.id === "custom:my-rule");
    expect(customItem).toBeDefined();
    expect(customItem?.status).toBe("fail");
    expect(customItem?.description).toBe("Custom rule detected an issue");

    // Custom check should create a missing item (since it's not "pass")
    const missingItem = result.missingItems.find((item) => item.id === "custom:my-rule");
    expect(missingItem).toBeDefined();
  });

  it("works with empty customChecks", async () => {
    const { analyzeArtifact } = await import("../src/analyzer.js");

    const result = analyzeArtifact({
      type: "agents",
      content: "# AGENTS.md\n\nTest content.",
      dimensions: { clarity: 75, safety: 75, tokenEfficiency: 75, completeness: 75 },
      customChecks: [],
    });

    // Should work exactly like before
    expect(result.checklist.length).toBeGreaterThan(0);
  });

  it("works without customChecks parameter (backwards compatible)", async () => {
    const { analyzeArtifact } = await import("../src/analyzer.js");

    const result = analyzeArtifact({
      type: "agents",
      content: "# AGENTS.md\n\nTest content.",
      dimensions: { clarity: 75, safety: 75, tokenEfficiency: 75, completeness: 75 },
    });

    expect(result.checklist.length).toBeGreaterThan(0);
    expect(result.missingItems).toBeDefined();
    expect(result.metricExplanations).toBeDefined();
  });
});
