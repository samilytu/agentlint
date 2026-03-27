import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CLIENT_REGISTRY,
  getAvailableScopes,
} from "../src/commands/clients.js";

const cliReadme = readFileSync(
  new URL("../README.md", import.meta.url),
  "utf-8",
);
const rootReadme = readFileSync(new URL("../../../README.md", import.meta.url), "utf-8");

const publicDocs = [
  rootReadme,
  readFileSync(new URL("../../../CHANGELOG.md", import.meta.url), "utf-8"),
  readFileSync(new URL("../../../CONTRIBUTING.md", import.meta.url), "utf-8"),
  readFileSync(new URL("../../../PUBLISH.md", import.meta.url), "utf-8"),
  cliReadme,
  readFileSync(new URL("../../mcp/README.md", import.meta.url), "utf-8"),
];

function formatScopes(client: (typeof CLIENT_REGISTRY)[number]): string {
  return getAvailableScopes(client)
    .map((scope) => (scope === "workspace" ? "Workspace" : "Global"))
    .join(" / ");
}

describe("CLI README consistency", () => {
  it("documents the current command surface", () => {
    expect(cliReadme).toContain("`agent-lint init`");
    expect(cliReadme).toContain("`agent-lint scan`");
    expect(cliReadme).toContain("`agent-lint prompt`");
    expect(cliReadme).toContain("`Enter` selects the focused client");
    expect(cliReadme).toContain("missing types, incomplete files, stale, conflicting, and weak findings");
    expect(cliReadme).toContain("broad-scan or targeted-maintenance");
    expect(cliReadme).toContain("local git change signals");
  });

  it("keeps the supported IDE table aligned with CLIENT_REGISTRY", () => {
    for (const client of CLIENT_REGISTRY) {
      expect(cliReadme).toContain(
        `| ${client.name} | ${client.configFormat.toUpperCase()} | ${formatScopes(client)} |`,
      );
    }
  });

  it("keeps the supported IDE table in registry order", () => {
    let previousIndex = -1;

    for (const client of CLIENT_REGISTRY) {
      const row = `| ${client.name} | ${client.configFormat.toUpperCase()} | ${formatScopes(client)} |`;
      const currentIndex = cliReadme.indexOf(row);

      expect(currentIndex).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }
  });

  it("documents the maintenance target fallback behavior", () => {
    expect(cliReadme).toContain(".github/copilot-instructions.md");
    expect(cliReadme).toContain("`CLAUDE.md`");
    expect(cliReadme).toContain("`AGENTS.md`");
  });

  it("keeps the root README client list aligned with registry order", () => {
    let previousIndex = -1;

    for (const client of CLIENT_REGISTRY) {
      const token = `<kbd>${client.name}</kbd>`;
      const currentIndex = rootReadme.indexOf(token);

      expect(currentIndex).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }
  });

  it("documents the grouped scan and prompt behavior in the root README", () => {
    expect(rootReadme).toContain("missing types, incomplete files, stale references, conflicting guidance, and weak-but-present");
    expect(rootReadme).toContain("broad workspace scan or a targeted maintenance handoff");
    expect(rootReadme).toContain("local change signals");
  });
});

describe("public docs surface", () => {
  it("does not mention removed CLI or legacy MCP commands", () => {
    const removedPatterns = [
      /\bagent-lint analyze\b/,
      /\banalyze_artifact\b/,
      /\banalyze_workspace_artifacts\b/,
      /\banalyze_context_bundle\b/,
      /\bprepare_artifact_fix_context\b/,
      /\bsubmit_client_assessment\b/,
      /\bquality_gate_artifact\b/,
      /\bsuggest_patch\b/,
      /\bapply_patches\b/,
      /\bvalidate_export\b/,
    ];

    for (const doc of publicDocs) {
      for (const pattern of removedPatterns) {
        expect(doc).not.toMatch(pattern);
      }
    }
  });
});
