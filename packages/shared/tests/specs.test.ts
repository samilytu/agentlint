import { buildArtifactSpecMarkdown } from "@agent-lint/shared";

describe("artifact spec conventions", () => {
  it("builds a full artifact spec markdown for each artifact type", () => {
    const artifactTypes = ["agents", "skills", "rules", "workflows", "plans"] as const;

    for (const artifactType of artifactTypes) {
      const markdown = buildArtifactSpecMarkdown(artifactType);

      expect(markdown).toContain(`# Artifact Spec: ${artifactType}`);
      expect(markdown).toContain("## Mandatory sections");
      expect(markdown).toContain("## Quality checks");
      expect(markdown).toContain("## Anti-patterns to avoid");
      expect(markdown).toContain("## Validation loop");
      expect(markdown).toContain("## Path hints");
      expect(markdown).toContain(`# Artifact Path Hints: ${artifactType}`);
    }
  });

  it("includes known quality metrics in the generated spec", () => {
    const markdown = buildArtifactSpecMarkdown("skills");

    expect(markdown).toContain("- clarity");
    expect(markdown).toContain("- safety");
    expect(markdown).toContain("- scope-control");
    expect(markdown).toContain("- maintainability");
  });
});
