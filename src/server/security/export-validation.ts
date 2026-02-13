import matter from "gray-matter";

export type ExportValidationResult = {
  valid: boolean;
  reason: string | null;
};

export function validateMarkdownOrYaml(content: string): ExportValidationResult {
  const trimmed = content.trim();

  if (!trimmed) {
    return {
      valid: false,
      reason: "Output is empty.",
    };
  }

  const fenceCount = (trimmed.match(/```/g) ?? []).length;
  if (fenceCount % 2 !== 0) {
    return {
      valid: false,
      reason: "Unclosed code fence detected.",
    };
  }

  try {
    matter(trimmed);

    return {
      valid: true,
      reason: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid frontmatter";

    return {
      valid: false,
      reason: message,
    };
  }
}
