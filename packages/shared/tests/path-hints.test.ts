import {
  buildArtifactPathHintsMarkdown,
  getArtifactDiscoveryPatterns,
  getArtifactPathHints,
} from "@agent-lint/shared";

describe("path hints conventions", () => {
  it("returns non-empty path hints for every artifact type", () => {
    const artifactTypes = ["agents", "skills", "rules", "workflows", "plans"] as const;

    for (const artifactType of artifactTypes) {
      const hints = getArtifactPathHints(artifactType);

      expect(hints.length).toBeGreaterThan(0);
      for (const hint of hints) {
        expect(hint.ecosystem.length).toBeGreaterThan(0);
        expect(hint.patterns.length).toBeGreaterThan(0);
        expect(hint.examples.length).toBeGreaterThan(0);
        expect(["canonical", "fallback"]).toContain(hint.discoveryTier);
      }

      const canonicalPatterns = getArtifactDiscoveryPatterns(artifactType);
      expect(canonicalPatterns.length).toBeGreaterThan(0);
    }
  });

  it("builds markdown with guidance sections", () => {
    const markdown = buildArtifactPathHintsMarkdown("agents");

    expect(markdown).toContain("# Artifact Path Hints: agents");
    expect(markdown).toContain("## Recommended discovery flow");
    expect(markdown).toContain("## Project signals to inspect before rewriting");
    expect(markdown).toContain("Discovery tier: canonical");
    expect(markdown).toContain("AGENTS.md");
  });
});
