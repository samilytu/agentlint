import {
  DEFAULT_CONTEXT_BUNDLE_CHAR_BUDGET,
  buildContextBundle,
  getContextBundleCharBudget,
} from "@agent-lint/core";

describe("context bundle", () => {
  it("builds merged content with priority ordering and deduplication", () => {
    const result = buildContextBundle({
      primaryContent: "# Primary\nMain",
      contextDocuments: [
        { label: "Low", content: "same-content", priority: 1 },
        { label: "High", content: "high-content", priority: 10, path: "docs/high.md" },
        { label: "Dup", content: "same-content", priority: 8 },
      ],
      charBudget: 10000,
    });

    expect(result.summary.provided).toBe(3);
    expect(result.summary.included).toBe(2);
    expect(result.summary.truncated).toBe(0);
    expect(result.mergedContent).toContain("# Primary Artifact");
    expect(result.mergedContent.indexOf("high-content")).toBeLessThan(result.mergedContent.indexOf("same-content"));
  });

  it("truncates context documents when budget is exceeded", () => {
    const result = buildContextBundle({
      primaryContent: "# Primary\nMain",
      contextDocuments: [
        { label: "Doc1", content: "A".repeat(120), priority: 5 },
        { label: "Doc2", content: "B".repeat(120), priority: 4 },
      ],
      charBudget: 170,
    });

    expect(result.summary.provided).toBe(2);
    expect(result.summary.truncated).toBeGreaterThan(0);
    expect(result.warnings.some((warning) => warning.includes("Context bundle truncated"))).toBe(true);
  });

  it("returns default budget when env var is absent", () => {
    const previous = process.env.CONTEXT_BUNDLE_CHAR_BUDGET;
    delete process.env.CONTEXT_BUNDLE_CHAR_BUDGET;

    const budget = getContextBundleCharBudget();
    expect(budget).toBe(DEFAULT_CONTEXT_BUNDLE_CHAR_BUDGET);

    if (previous === undefined) {
      delete process.env.CONTEXT_BUNDLE_CHAR_BUDGET;
    } else {
      process.env.CONTEXT_BUNDLE_CHAR_BUDGET = previous;
    }
  });

  it("reads budget from env var", () => {
    const previous = process.env.CONTEXT_BUNDLE_CHAR_BUDGET;
    process.env.CONTEXT_BUNDLE_CHAR_BUDGET = "54321";

    const budget = getContextBundleCharBudget();
    expect(budget).toBe(54321);

    if (previous === undefined) {
      delete process.env.CONTEXT_BUNDLE_CHAR_BUDGET;
    } else {
      process.env.CONTEXT_BUNDLE_CHAR_BUDGET = previous;
    }
  });
});
