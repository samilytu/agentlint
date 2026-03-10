import { describe, expect, it } from "vitest";
import {
  affectsPublishedPackage,
  getImpactfulFiles,
  isChangesetFile,
  isReleaseArtifactOnly,
} from "../../../scripts/lib/changeset-impact.mjs";

describe("changeset impact detection", () => {
  it("treats package source changes as release impacting", () => {
    expect(affectsPublishedPackage("packages/cli/src/commands/init.tsx")).toBe(true);
    expect(affectsPublishedPackage("packages/mcp/src/server.ts")).toBe(true);
  });

  it("treats published package docs as release impacting", () => {
    expect(affectsPublishedPackage("packages/cli/README.md")).toBe(true);
    expect(affectsPublishedPackage("packages/mcp/LICENSE")).toBe(true);
  });

  it("ignores package-local agent context artifacts", () => {
    expect(affectsPublishedPackage("packages/cli/AGENTS.md")).toBe(false);
    expect(affectsPublishedPackage("packages/mcp/AGENTS.md")).toBe(false);
  });

  it("ignores tests and release bookkeeping files", () => {
    expect(affectsPublishedPackage("packages/cli/tests/clients.test.ts")).toBe(false);
    expect(affectsPublishedPackage("packages/mcp/CHANGELOG.md")).toBe(false);
    expect(isReleaseArtifactOnly("packages/mcp/CHANGELOG.md")).toBe(true);
  });

  it("identifies changeset files separately from impactful package files", () => {
    expect(isChangesetFile(".changeset/internal-docs.md")).toBe(true);
    expect(isReleaseArtifactOnly(".changeset/internal-docs.md")).toBe(true);
    expect(
      getImpactfulFiles([
        ".changeset/internal-docs.md",
        "packages/cli/AGENTS.md",
        "packages/cli/src/index.tsx",
      ]),
    ).toEqual(["packages/cli/src/index.tsx"]);
  });
});
