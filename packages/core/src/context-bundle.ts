import type { ContextDocumentInput } from "@agent-lint/shared";

export const DEFAULT_CONTEXT_BUNDLE_CHAR_BUDGET = 120_000;

export type ContextBundleSummary = {
  provided: number;
  included: number;
  truncated: number;
  mergedChars: number;
};

export type ContextBundleResult = {
  mergedContent: string;
  summary: ContextBundleSummary;
  warnings: string[];
};

export function getContextBundleCharBudget(): number {
  return Number(process.env.CONTEXT_BUNDLE_CHAR_BUDGET ?? DEFAULT_CONTEXT_BUNDLE_CHAR_BUDGET);
}

export function buildContextBundle(input: {
  primaryContent: string;
  contextDocuments: ContextDocumentInput[];
  charBudget?: number;
}): ContextBundleResult {
  const charBudget = input.charBudget ?? getContextBundleCharBudget();
  const warnings: string[] = [];
  const deduped = new Set<string>();
  const sortedDocuments = [...input.contextDocuments].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  );

  const sections: string[] = ["# Primary Artifact", input.primaryContent];

  let consumedChars = sections.join("\n\n").length;
  let included = 0;
  let truncated = 0;

  for (const doc of sortedDocuments) {
    const normalized = doc.content.trim();
    if (!normalized) {
      continue;
    }

    if (deduped.has(normalized)) {
      continue;
    }

    deduped.add(normalized);

    const titleBits = [doc.label.trim()];
    if (doc.path) {
      titleBits.push(doc.path.trim());
    }
    if (doc.type) {
      titleBits.push(doc.type);
    }

    const block = [`## Context Document ${included + 1}: ${titleBits.join(" | ")}`, normalized].join(
      "\n",
    );
    const candidateSize = consumedChars + block.length + 2;

    if (candidateSize > charBudget) {
      truncated += 1;
      continue;
    }

    sections.push(block);
    consumedChars = candidateSize;
    included += 1;
  }

  if (truncated > 0) {
    warnings.push(`Context bundle truncated: ${truncated} document(s) excluded by size budget.`);
  }

  return {
    mergedContent: sections.join("\n\n"),
    summary: {
      provided: input.contextDocuments.length,
      included,
      truncated,
      mergedChars: consumedChars,
    },
    warnings,
  };
}
