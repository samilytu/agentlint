import { parseArtifactContent } from "@agent-lint/shared";

describe("parseArtifactContent", () => {
  it("parses valid markdown with frontmatter", () => {
    const input = [
      "---",
      "title: Agent Guide",
      "type: agents",
      "priority: 2",
      "---",
      "",
      "# Hello",
      "Body content",
    ].join("\n");

    const result = parseArtifactContent(input);

    expect(result.parseError).toBeNull();
    expect(result.frontmatter).toEqual({
      title: "Agent Guide",
      type: "agents",
      priority: 2,
    });
    expect(result.body).toBe("# Hello\nBody content");
  });

  it("parses markdown with no frontmatter", () => {
    const result = parseArtifactContent("# Plain document\nNo frontmatter");

    expect(result.parseError).toBeNull();
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe("# Plain document\nNo frontmatter");
  });

  it("returns parse error for malformed frontmatter", () => {
    const malformed = ["---", "title: [broken", "---", "Body"].join("\n");

    const result = parseArtifactContent(malformed);

    expect(result.frontmatter).toBeNull();
    expect(result.body).toBe(malformed);
    expect(result.parseError).toMatch(/^Frontmatter parse failed:/);
  });

  it("returns empty payload for empty input", () => {
    const result = parseArtifactContent("   \n\n");

    expect(result).toEqual({
      frontmatter: null,
      body: "",
      parseError: null,
    });
  });
});
