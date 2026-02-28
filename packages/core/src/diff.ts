import { diffLines, type Change } from "diff";

export type DiffSegmentKind = "added" | "removed" | "unchanged";

export type DiffSegment = {
  index: number;
  kind: DiffSegmentKind;
  value: string;
  count: number;
};

function segmentKind(part: Change): DiffSegmentKind {
  if (part.added) {
    return "added";
  }
  if (part.removed) {
    return "removed";
  }
  return "unchanged";
}

export function buildDiffSegments(original: string, refined: string): DiffSegment[] {
  if (!refined) {
    return [];
  }

  return diffLines(original, refined).map((part, index) => ({
    index,
    kind: segmentKind(part),
    value: part.value,
    count: part.count ?? 0,
  }));
}

export function applySelectedSegments(input: {
  original: string;
  refined: string;
  selectedSegmentIndexes: Set<number>;
}): string {
  const segments = buildDiffSegments(input.original, input.refined);
  if (segments.length === 0) {
    return input.original;
  }

  const outputParts: string[] = [];

  for (const segment of segments) {
    if (segment.kind === "unchanged") {
      outputParts.push(segment.value);
      continue;
    }

    if (segment.kind === "added") {
      if (input.selectedSegmentIndexes.has(segment.index)) {
        outputParts.push(segment.value);
      }
      continue;
    }

    if (input.selectedSegmentIndexes.has(segment.index)) {
      continue;
    }

    outputParts.push(segment.value);
  }

  return outputParts.join("");
}
