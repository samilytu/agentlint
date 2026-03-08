import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discoverWorkspaceArtifacts } from "@agent-lint/core";

describe("workspace-discovery", () => {
  const fixtureWorkspace = path.resolve(__dirname, "../../..", "fixtures", "workspace");

  it("discovers only canonical artifacts in fixture workspace", () => {
    const result = discoverWorkspaceArtifacts(fixtureWorkspace);
    const relativePaths = result.discovered.map((artifact) => artifact.relativePath).sort();

    expect(result.rootPath).toBe(fixtureWorkspace);
    expect(relativePaths).toEqual([
      ".cursor\\rules\\code-style.md",
      ".windsurf\\skills\\testing\\SKILL.md",
      "AGENTS.md",
      "docs\\plans\\roadmap.md",
      "docs\\workflows\\deploy.md",
    ]);
  });

  it("ignores noisy docs, reports, and nested sample workspaces", () => {
    const result = discoverWorkspaceArtifacts(fixtureWorkspace);
    const relativePaths = new Set(result.discovered.map((artifact) => artifact.relativePath));

    expect(relativePaths.has(".agentlint-report.md")).toBe(false);
    expect(relativePaths.has("README.md")).toBe(false);
    expect(relativePaths.has("docs\\deploy-workflow.md")).toBe(false);
    expect(relativePaths.has("docs\\roadmap.md")).toBe(false);
    expect(relativePaths.has("examples\\sample\\AGENTS.md")).toBe(false);
    expect(relativePaths.has("packages\\cli\\README.md")).toBe(false);
  });

  it("detects missing artifact types from canonical paths only", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-discovery-"));

    try {
      fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "# AGENTS\n");
      fs.mkdirSync(path.join(tmpDir, "docs"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "docs", "roadmap.md"), "# Not canonical\n");

      const result = discoverWorkspaceArtifacts(tmpDir);
      const foundTypes = new Set(result.discovered.map((artifact) => artifact.type));
      const missingTypes = result.missing.map((artifact) => artifact.type).sort();

      expect(foundTypes.has("agents")).toBe(true);
      expect(foundTypes.has("plans")).toBe(false);
      expect(missingTypes).toEqual(["plans", "rules", "skills", "workflows"]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("reports relative paths", () => {
    const result = discoverWorkspaceArtifacts(fixtureWorkspace);

    for (const artifact of result.discovered) {
      expect(path.isAbsolute(artifact.relativePath)).toBe(false);
    }
  });

  it("reports missing sections for incomplete artifacts", () => {
    const result = discoverWorkspaceArtifacts(fixtureWorkspace);
    const hasAnyMissingSections = result.discovered.some(
      (artifact) => artifact.missingSections.length > 0,
    );

    expect(hasAnyMissingSections).toBe(true);
  });
});
