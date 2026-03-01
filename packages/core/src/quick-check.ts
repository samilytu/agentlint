import path from "node:path";

export type QuickCheckSignal = {
  trigger: string;
  affectedArtifacts: string[];
  action: string;
};

export type QuickCheckResult = {
  signals: QuickCheckSignal[];
  markdown: string;
};

const PATH_SIGNALS: Array<{
  test: (p: string) => boolean;
  trigger: string;
  affectedArtifacts: string[];
  action: string;
}> = [
  {
    test: (p) => /package\.json$/i.test(p),
    trigger: "package.json changed",
    affectedArtifacts: ["agents", "rules"],
    action:
      "Update Quick Commands section in AGENTS.md if scripts changed. Update rules if new dependencies require constraints.",
  },
  {
    test: (p) => /tsconfig/i.test(p),
    trigger: "TypeScript config changed",
    affectedArtifacts: ["agents", "rules"],
    action: "Review verification commands and TypeScript-specific rules for alignment.",
  },
  {
    test: (p) =>
      /\.(github|gitlab)\/.*\.(yml|yaml)$/i.test(p) || /\.circleci/i.test(p),
    trigger: "CI/CD configuration changed",
    affectedArtifacts: ["agents", "workflows"],
    action:
      "Update verification steps in AGENTS.md. Review workflow artifacts for new CI pipeline alignment.",
  },
  {
    test: (p) => /dockerfile|docker-compose|\.dockerignore/i.test(p),
    trigger: "Docker configuration changed",
    affectedArtifacts: ["agents", "workflows"],
    action:
      "Update deployment-related commands in AGENTS.md and workflow artifacts.",
  },
  {
    test: (p) => /\.env/i.test(p) && !/\.env\.example/i.test(p),
    trigger: "Environment file changed",
    affectedArtifacts: ["agents", "rules"],
    action:
      "Verify security boundaries in AGENTS.md. Ensure rules prohibit secret hardcoding.",
  },
  {
    test: (p) => {
      const dir = path.dirname(p).replace(/\\/g, "/");
      const parts = dir.split("/").filter(Boolean);
      return parts.length >= 2 && !parts.some((d) => d === "node_modules");
    },
    trigger: "New directory or module structure",
    affectedArtifacts: ["agents"],
    action:
      "Update the Repo Map section in AGENTS.md to reflect the new directory structure.",
  },
  {
    test: (p) =>
      /\.(cursor|windsurf|claude|vscode)\//i.test(p.replace(/\\/g, "/")),
    trigger: "IDE config changed",
    affectedArtifacts: ["rules"],
    action:
      "Review rules artifacts to ensure they align with updated IDE configuration.",
  },
  {
    test: (p) => /readme\.md$/i.test(p),
    trigger: "README changed",
    affectedArtifacts: ["agents"],
    action:
      "Check AGENTS.md is not duplicating README content. Update references if needed.",
  },
];

const DESCRIPTION_SIGNALS: Array<{
  test: (d: string) => boolean;
  trigger: string;
  affectedArtifacts: string[];
  action: string;
}> = [
  {
    test: (d) => /new\b.*\b(module|feature|component|service|package)\b/i.test(d),
    trigger: "New module/feature added",
    affectedArtifacts: ["agents", "plans"],
    action:
      "Update Repo Map in AGENTS.md. If this is part of an ongoing plan, update plan progress.",
  },
  {
    test: (d) => /refactor|restructur|reorganiz/i.test(d),
    trigger: "Codebase restructuring",
    affectedArtifacts: ["agents", "rules", "workflows"],
    action:
      "Review all context artifacts for stale path references and outdated structure descriptions.",
  },
  {
    test: (d) => /security|auth|permission|access control/i.test(d),
    trigger: "Security-related change",
    affectedArtifacts: ["agents", "rules"],
    action:
      "Update Security Boundaries in AGENTS.md and Security block in rules.",
  },
  {
    test: (d) => /deploy|release|publish/i.test(d),
    trigger: "Deployment-related change",
    affectedArtifacts: ["workflows", "plans"],
    action:
      "Review deployment workflows and plan progress for alignment.",
  },
  {
    test: (d) => /depend|upgrade|migrat/i.test(d),
    trigger: "Dependency change",
    affectedArtifacts: ["agents", "rules"],
    action:
      "Update Quick Commands if install steps changed. Update rules if new constraints apply.",
  },
];

export function runQuickCheck(
  changedPaths?: string[],
  changeDescription?: string,
): QuickCheckResult {
  const signals: QuickCheckSignal[] = [];
  const seen = new Set<string>();

  if (changedPaths) {
    for (const p of changedPaths) {
      for (const rule of PATH_SIGNALS) {
        if (rule.test(p) && !seen.has(rule.trigger)) {
          seen.add(rule.trigger);
          signals.push({
            trigger: rule.trigger,
            affectedArtifacts: rule.affectedArtifacts,
            action: rule.action,
          });
        }
      }
    }
  }

  if (changeDescription) {
    for (const rule of DESCRIPTION_SIGNALS) {
      if (rule.test(changeDescription) && !seen.has(rule.trigger)) {
        seen.add(rule.trigger);
        signals.push({
          trigger: rule.trigger,
          affectedArtifacts: rule.affectedArtifacts,
          action: rule.action,
        });
      }
    }
  }

  const markdown = buildQuickCheckMarkdown(signals, changedPaths, changeDescription);

  return { signals, markdown };
}

function buildQuickCheckMarkdown(
  signals: QuickCheckSignal[],
  changedPaths?: string[],
  changeDescription?: string,
): string {
  const lines = [
    "# Quick Check Results",
    "",
  ];

  if (changedPaths && changedPaths.length > 0) {
    lines.push(`Checked ${changedPaths.length} changed path(s).`);
  }
  if (changeDescription) {
    lines.push(`Change description: ${changeDescription}`);
  }
  lines.push("");

  if (signals.length === 0) {
    lines.push(
      "No context artifact updates appear necessary for these changes.",
      "",
      "If you made structural changes not captured by file paths, consider running",
      "`agentlint_plan_workspace_autofix` for a full workspace scan.",
    );
    return lines.join("\n");
  }

  lines.push(`Found **${signals.length}** signal(s) that may require context updates:`, "");

  for (const signal of signals) {
    lines.push(
      `### ${signal.trigger}`,
      "",
      `- **Affected artifacts:** ${signal.affectedArtifacts.join(", ")}`,
      `- **Recommended action:** ${signal.action}`,
      "",
    );
  }

  lines.push(
    "---",
    "",
    "## Next steps",
    "",
    "1. Review each signal above and determine if the action applies to your project.",
    "2. For affected artifact types, call `agentlint_get_guidelines` to get the latest specification.",
    "3. Edit the artifact files accordingly using your file editing capabilities.",
    "4. Ask the user for confirmation before saving.",
  );

  return lines.join("\n");
}
