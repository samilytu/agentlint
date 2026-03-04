import { resolvePromptHasReport } from "../src/app.js";

describe("resolvePromptHasReport", () => {
  it("returns true when session already has report", () => {
    expect(resolvePromptHasReport(true, false)).toBe(true);
  });

  it("returns true when prompt detects an existing report", () => {
    expect(resolvePromptHasReport(false, true)).toBe(true);
  });

  it("returns false only when neither source has report", () => {
    expect(resolvePromptHasReport(false, false)).toBe(false);
  });
});
