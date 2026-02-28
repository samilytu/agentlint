import { buildInstantLintSignals } from "@agent-lint/core";

describe("buildInstantLintSignals", () => {
  it("returns error when input exceeds max chars", () => {
    const signals = buildInstantLintSignals({
      content: "x".repeat(120_000),
      maxChars: 100_000,
    });

    expect(signals.some((signal) => signal.id === "over-limit" && signal.severity === "error")).toBe(true);
  });

  it("returns near-limit warning and heading/injection hints", () => {
    const signals = buildInstantLintSignals({
      content: "x".repeat(85),
      maxChars: 100,
    });

    expect(signals.some((signal) => signal.id === "near-limit" && signal.severity === "warn")).toBe(true);
    expect(signals.some((signal) => signal.id === "missing-headings")).toBe(true);
    expect(signals.some((signal) => signal.id === "injection-guard")).toBe(true);
  });

  it("warns on risky operations without guard phrase", () => {
    const signals = buildInstantLintSignals({
      content: "# Runbook\nrm -rf /tmp/cache",
      maxChars: 1000,
    });

    expect(signals.some((signal) => signal.id === "risky-operations")).toBe(true);
  });

  it("keeps at most four signals", () => {
    const signals = buildInstantLintSignals({
      content: `rm -rf /tmp\n${"x".repeat(200)}`,
      maxChars: 100,
    });

    expect(signals.length).toBeLessThanOrEqual(4);
  });

  it("handles empty and unicode input deterministically", () => {
    const emptySignals = buildInstantLintSignals({
      content: "",
      maxChars: 20,
    });
    const unicodeSignals = buildInstantLintSignals({
      content: "# Başlık\nGüvenli içerik ✅",
      maxChars: 500,
    });

    expect(emptySignals.length).toBeGreaterThan(0);
    expect(unicodeSignals.some((signal) => signal.id === "missing-headings")).toBe(false);
  });
});
