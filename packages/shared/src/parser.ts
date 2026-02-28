import matter from "gray-matter";

export type ParsedArtifactContent = {
  frontmatter: Record<string, unknown> | null;
  body: string;
  parseError: string | null;
};

export function parseArtifactContent(input: string): ParsedArtifactContent {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return {
      frontmatter: null,
      body: "",
      parseError: null,
    };
  }

  try {
    const parsed = matter(trimmed);

    return {
      frontmatter: (parsed.data as Record<string, unknown>) ?? null,
      body: parsed.content.trim(),
      parseError: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error";

    return {
      frontmatter: null,
      body: trimmed,
      parseError: `Frontmatter parse failed: ${message}`,
    };
  }
}
