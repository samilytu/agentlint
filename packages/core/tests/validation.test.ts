import { validateMarkdownOrYaml } from "@agent-lint/core";

describe("validateMarkdownOrYaml", () => {
  it("accepts valid markdown", () => {
    const result = validateMarkdownOrYaml("# Title\n\nSome content");
    expect(result).toEqual({ valid: true, reason: null });
  });

  it("returns invalid for empty content", () => {
    const result = validateMarkdownOrYaml("   ");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Output is empty.");
  });

  it("returns invalid for unclosed code fences", () => {
    const result = validateMarkdownOrYaml("```ts\nconst a = 1;\n");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Unclosed code fence detected.");
  });

  it("returns invalid for malformed frontmatter", () => {
    const result = validateMarkdownOrYaml("---\nname: [broken\n---\n# x");
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("accepts unicode markdown", () => {
    const result = validateMarkdownOrYaml("# Başlık\nİçerik ✅");
    expect(result.valid).toBe(true);
    expect(result.reason).toBeNull();
  });
});
