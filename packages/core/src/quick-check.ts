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

type SignalRule = {
  test: (value: string) => boolean;
  trigger: string;
  affectedArtifacts: string[];
  action: string;
};

function normalizeChangedPath(input: string): string {
  return input.replace(/\\/g, "/").replace(/^\.\//, "");
}

function isDirectoryLikePath(input: string): boolean {
  const normalized = normalizeChangedPath(input).replace(/\/$/, "");
  const base = path.posix.basename(normalized);
  return normalized.includes("/") && normalized.length > 0 && !base.includes(".");
}

const PATH_SIGNALS: readonly SignalRule[] = [
  {
    test: (p) => /(^|\/)\.cursor\/rules\/.+\.(md|mdc)$/i.test(p),
    trigger: "Cursor rule file changed",
    affectedArtifacts: ["rules", "agents", "plans"],
    action:
      "Review Cursor-managed rules for scope drift, wrong-tool guidance, and maintenance parity with the root context artifacts.",
  },
  {
    test: (p) => /(^|\/)\.github\/copilot-instructions\.md$/i.test(p),
    trigger: "Copilot instruction file changed",
    affectedArtifacts: ["agents", "rules", "plans"],
    action:
      "Review Copilot-specific instructions for cross-tool leakage, maintenance parity, and whether the root guidance still matches the managed file.",
  },
  {
    test: (p) => /(^|\/)(AGENTS\.md|CLAUDE\.md)$/i.test(p),
    trigger: "Root context baseline changed",
    affectedArtifacts: ["agents", "rules", "workflows", "plans"],
    action:
      "Treat the root context file as the baseline truth source. Re-check managed client files, maintenance snippets, and related docs/tests for drift.",
  },
  {
    test: (p) => /(^|\/)(package\.json|pnpm-lock\.ya?ml|package-lock\.json|yarn\.lock)$/i.test(p),
    trigger: "Package manifest or lockfile changed",
    affectedArtifacts: ["agents", "rules"],
    action:
      "Review quick commands, dependency constraints, and maintenance rules. If the change affects repository structure or tooling, run `agentlint_quick_check` first and then use `agentlint_get_guidelines` for the affected artifact types.",
  },
  {
    test: (p) => /(tsconfig|vitest\.config|eslint|prettier|turbo\.json|pnpm-workspace\.yaml|components\.json)$/i.test(p),
    trigger: "Build, lint, or workspace config changed",
    affectedArtifacts: ["agents", "rules"],
    action:
      "Review verification commands, tooling notes, and rule constraints so context artifacts still match the live repository configuration.",
  },
  {
    test: (p) =>
      /(^|\/)(\.github\/workflows\/.*\.(yml|yaml)|\.gitlab-ci\.ya?ml|\.circleci\/|PUBLISH\.md|CONTRIBUTING\.md)$/i.test(p),
    trigger: "CI, release, or contribution flow changed",
    affectedArtifacts: ["agents", "workflows", "plans"],
    action:
      "Review verification steps, release workflows, and planning docs for stale commands, changed release flow, or new process constraints.",
  },
  {
    test: (p) => {
      const normalized = normalizeChangedPath(p);
      const base = path.posix.basename(normalized);
      if (/^\.env(?:\.|$)/i.test(base) && !/^\.env\.example$/i.test(base)) {
        return true;
      }

      return /(^|\/)(security|auth|permissions?)(\/|$)/i.test(normalized);
    },
    trigger: "Security-sensitive path changed",
    affectedArtifacts: ["agents", "rules"],
    action:
      "Review security boundaries and maintenance rules to ensure the updated behavior, secrets policy, and refusal boundaries remain accurate.",
  },
  {
    test: (p) =>
      /(^|\/)(AGENTS\.md|CLAUDE\.md|\.cursor\/rules\/|\.windsurf\/rules\/|\.github\/copilot-instructions\.md|\.claude\/commands\/|\.codex\/rules\/)/i.test(p),
    trigger: "Context artifact or client instruction file changed",
    affectedArtifacts: ["agents", "rules", "workflows", "plans"],
    action:
      "Treat this as active context maintenance work. Re-check related artifacts for drift, and tell the user if an update was driven by Agent Lint guidance.",
  },
  {
    test: (p) => /(^|\/)(skills\/|\.claude\/skills\/|\.windsurf\/skills\/)/i.test(p),
    trigger: "Skill file or directory changed",
    affectedArtifacts: ["skills", "agents"],
    action:
      "Review skill description for trigger keywords, ensure Gotchas section is updated, and check if a large skill needs progressive disclosure (moving details to references/).",
  },
  {
    test: (p) =>
      /packages\/(cli\/src\/commands\/clients\.ts|cli\/src\/commands\/maintenance-writer\.ts|cli\/src\/commands\/doctor\.tsx|cli\/src\/commands\/prompt\.tsx|mcp\/src\/catalog\.ts|mcp\/src\/server\.ts|core\/src\/maintenance-snippet\.ts|core\/src\/plan-builder\.ts|core\/src\/workspace-discovery\.ts|core\/src\/quick-check\.ts)$/i.test(p),
    trigger: "Agent Lint public maintenance surface changed",
    affectedArtifacts: ["agents", "rules", "plans"],
    action:
      "Review root guidance, managed maintenance artifacts, doctor/prompt wording, and public docs/tests together so clients, prompts, and instructions stay aligned.",
  },
  {
    test: (p) => isDirectoryLikePath(p),
    trigger: "Directory or module boundary changed",
    affectedArtifacts: ["agents", "plans"],
    action:
      "Review repo map, package-level overlays, and planning artifacts for stale structure descriptions or missing new-module guidance.",
  },
];

const DESCRIPTION_SIGNALS: readonly SignalRule[] = [
  {
    test: (d) => /new\b.*\b(module|feature|component|service|package|directory)\b/i.test(d),
    trigger: "New module or feature described",
    affectedArtifacts: ["agents", "plans"],
    action:
      "Review repo-map, scope, and plan sections so the new module or feature is reflected in the active context artifacts.",
  },
  {
    test: (d) => /refactor|restructur|reorganiz|rename|move\b/i.test(d),
    trigger: "Repository restructuring described",
    affectedArtifacts: ["agents", "rules", "workflows", "plans"],
    action:
      "Treat this as a structural maintenance signal. Check for stale paths, obsolete repo-map entries, and rules that still describe the old layout.",
  },
  {
    test: (d) => /security|auth|permission|access control|secret/i.test(d),
    trigger: "Security-related change described",
    affectedArtifacts: ["agents", "rules"],
    action:
      "Review security boundaries, refusal rules, and secret-hygiene language in the affected context artifacts.",
  },
  {
    test: (d) => /deploy|release|publish|packaging|distribution/i.test(d),
    trigger: "Release or deployment change described",
    affectedArtifacts: ["workflows", "plans", "agents"],
    action:
      "Review release workflows, verification commands, and any plan sections that track release behavior or package outputs.",
  },
  {
    test: (d) => /depend|upgrade|migrat|tooling|typescript|lint|test/i.test(d),
    trigger: "Tooling or dependency change described",
    affectedArtifacts: ["agents", "rules"],
    action:
      "Review quick commands, tooling notes, and rule constraints so context artifacts still match the current stack and verification flow.",
  },
  {
    test: (d) => /client|cursor|windsurf|copilot|claude|codex|opencode|kiro|zed/i.test(d),
    trigger: "Client support or instruction behavior described",
    affectedArtifacts: ["agents", "rules", "plans"],
    action:
      "Review client-specific maintenance instructions, fallback behavior, and docs/tests that describe supported clients.",
  },
];

export function runQuickCheck(
  changedPaths?: string[],
  changeDescription?: string,
): QuickCheckResult {
  const signals: QuickCheckSignal[] = [];
  const seen = new Set<string>();
  const normalizedPaths = changedPaths?.map((changedPath) => normalizeChangedPath(changedPath));

  if (normalizedPaths) {
    for (const changedPath of normalizedPaths) {
      for (const rule of PATH_SIGNALS) {
        if (rule.test(changedPath) && !seen.has(rule.trigger)) {
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

  const markdown = buildQuickCheckMarkdown(signals, normalizedPaths, changeDescription);

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
    "## Agent Lint default guidance",
    "",
    "Treat the signals above as the default Agent Lint recommendation for context maintenance.",
    "If the user explicitly asks for a different context outcome, follow the user and note the override.",
    "If you update an artifact because of these signals, tell the user the change was prompted by Agent Lint guidance.",
    "",
    "## Next steps",
    "",
    "1. If the change looks broad or structural, run `agentlint_plan_workspace_autofix` for a workspace-wide scan.",
    "2. If the change is targeted, use the signals above to decide which artifact types need `agentlint_get_guidelines` before editing.",
    "3. Apply safe context-artifact updates directly, but do not expand the work to unrelated code or docs unless the user explicitly asks.",
  );

  return lines.join("\n");
}
