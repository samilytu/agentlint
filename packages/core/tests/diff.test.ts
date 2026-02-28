import { applySelectedSegments, buildDiffSegments } from "@agent-lint/core";

describe("diff helpers", () => {
  it("returns no segments when refined content is empty", () => {
    const segments = buildDiffSegments("alpha\nbeta\n", "");
    expect(segments).toEqual([]);
  });

  it("builds diff segments with kinds and indexes", () => {
    const segments = buildDiffSegments("alpha\nbeta\n", "alpha\nBETTER\nbeta\n");
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.every((segment) => segment.index >= 0)).toBe(true);
    expect(segments.some((segment) => segment.kind === "added")).toBe(true);
  });

  it("applies selected added segment and keeps removal behavior", () => {
    const original = "alpha\nbeta\ngamma\n";
    const refined = "alpha\nBETTER\ngamma\n";
    const segments = buildDiffSegments(original, refined);
    const addedSegment = segments.find((segment) => segment.kind === "added");
    const removedSegment = segments.find((segment) => segment.kind === "removed");

    expect(addedSegment).toBeDefined();
    expect(removedSegment).toBeDefined();

    const selected = new Set<number>([addedSegment?.index ?? -1, removedSegment?.index ?? -1]);
    const output = applySelectedSegments({
      original,
      refined,
      selectedSegmentIndexes: selected,
    });

    expect(output).toBe(refined);
  });

  it("returns original when no segments are selected", () => {
    const original = "line1\nline2\n";
    const refined = "line1\nline2 updated\n";

    const output = applySelectedSegments({
      original,
      refined,
      selectedSegmentIndexes: new Set<number>(),
    });

    expect(output).toBe(original);
  });
});
