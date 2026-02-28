import type { ArtifactType } from "@agent-lint/shared";
import { parseArtifactContent } from "@agent-lint/shared";
import type {
  AnalyzerSignal,
  BestPracticeHint,
  ChecklistItem,
  JudgeAnalysis,
  JudgeDimensionScores,
  MetricExplanation,
  MissingItem,
  MissingSeverity,
  QualityStatus,
  ValidatedFinding,
  ValidatedFindingDecision,
} from "@agent-lint/shared";

import { getPromptPack } from "./prompt-pack.js";

type RequirementLevel = "mandatory" | "recommended";

export type RuleCheck = {
  id: string;
  label: string;
  metric: string;
  requirement: RequirementLevel;
  status: QualityStatus;
  description: string;
  recommendation: string;
  evidence: string | null;
};

type MetricMeta = {
  id: string;
  label: string;
  definition: string;
};

const commandPattern = /\b(npm|pnpm|yarn|bun|vitest|playwright|eslint|next|drizzle-kit|turbo)\b/i;
const verificationPattern = /(test|lint|typecheck|build|verification|evidence)/i;
const injectionGuardPattern = /(ignore\s+external\s+instructions|prompt\s+injection|untrusted\s+content)/i;
const secretGuardPattern = /(secret|token|\.env|api[_\s-]?key)/i;
const numberedStepsPattern = /(^|\n)\s*\d+[.)]\s+/m;
const dangerousOperationPattern =
  /(force\s+push|rm\s+-rf|--no-verify|del\s+\/f\s+\/q|deploy\s+prod)/i;
const negationGuardPattern =
  /(do\s+not|don't|never|avoid|forbid|forbidden|prohibit|yasak|yapma|engelle)/i;
const confirmationGatePattern =
  /(confirm|confirmation|explicit\s+approval|manual\s+approval|user\s+approval|ask\s+(the\s+)?user|human\s+approval|onay)/i;

type AnalyzableLine = {
  lineNumber: number;
  text: string;
};

type SafetyAssessment = {
  signals: AnalyzerSignal[];
  finding: ValidatedFinding;
  status: QualityStatus;
  description: string;
  evidence: string | null;
  confidence: number;
};

function collectAnalyzableLines(content: string): AnalyzableLine[] {
  const lines = content.split("\n");
  const analyzable: AnalyzableLine[] = [];
  let insideCodeFence = false;

  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index] ?? "";
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("```")) {
      insideCodeFence = !insideCodeFence;
      continue;
    }

    if (insideCodeFence) {
      continue;
    }

    analyzable.push({
      lineNumber: index + 1,
      text: rawLine,
    });
  }

  return analyzable;
}

function findingDecisionToStatus(decision: ValidatedFindingDecision): QualityStatus {
  if (decision === "pass") {
    return "pass";
  }
  if (decision === "warn") {
    return "improve";
  }
  return "fail";
}

function buildSafetyAssessment(content: string): SafetyAssessment {
  const lines = collectAnalyzableLines(content);
  const riskyMentions = lines.filter((line) => dangerousOperationPattern.test(line.text));

  const signals: AnalyzerSignal[] = riskyMentions.map((line, index) => ({
    id: `risky-operation-${index + 1}`,
    category: "safety",
    severity: "critical",
    message: `Potentially destructive operation reference on line ${line.lineNumber}.`,
    evidence: line.text.trim().slice(0, 220),
  }));

  if (signals.length === 0) {
    const finding: ValidatedFinding = {
      id: "dangerous-operations-semantic",
      decision: "pass",
      rationale: "No destructive command references were detected outside code fences.",
      relatedSignalIds: [],
      confidence: 94,
    };

    return {
      signals,
      finding,
      status: "pass",
      description: "No destructive command pattern detected.",
      evidence: null,
      confidence: finding.confidence,
    };
  }

  const unguardedSignals = signals.filter((signal) => !negationGuardPattern.test(signal.evidence));
  const hasConfirmationGate = confirmationGatePattern.test(content);

  let finding: ValidatedFinding;

  if (unguardedSignals.length === 0) {
    finding = {
      id: "dangerous-operations-semantic",
      decision: "pass",
      rationale:
        "Destructive command mentions appear in prohibitive language (for example: do not / never), so they are treated as guardrails.",
      relatedSignalIds: signals.map((signal) => signal.id),
      confidence: 88,
    };
  } else if (hasConfirmationGate) {
    finding = {
      id: "dangerous-operations-semantic",
      decision: "warn",
      rationale:
        "Destructive commands appear in actionable form, but the document contains explicit confirmation gates. Keep and tighten gating language.",
      relatedSignalIds: unguardedSignals.map((signal) => signal.id),
      confidence: 74,
    };
  } else {
    finding = {
      id: "dangerous-operations-semantic",
      decision: "fail",
      rationale:
        "Destructive commands appear without explicit manual confirmation requirements.",
      relatedSignalIds: unguardedSignals.map((signal) => signal.id),
      confidence: 91,
    };
  }

  const evidence = riskyMentions
    .slice(0, 3)
    .map((line) => `L${line.lineNumber}: ${line.text.trim()}`)
    .join(" | ");

  return {
    signals,
    finding,
    status: findingDecisionToStatus(finding.decision),
    description: finding.rationale,
    evidence,
    confidence: finding.confidence,
  };
}

const metrics: MetricMeta[] = [
  {
    id: "clarity",
    label: "Clarity",
    definition: "Instructions are unambiguous, readable, and easy to follow.",
  },
  {
    id: "specificity",
    label: "Specificity",
    definition: "Guidance includes concrete commands, files, and explicit actions.",
  },
  {
    id: "scope-control",
    label: "Scope Control",
    definition: "Document clearly defines what is in scope and out of scope.",
  },
  {
    id: "completeness",
    label: "Completeness",
    definition: "Required sections exist for the selected artifact type.",
  },
  {
    id: "actionability",
    label: "Actionability",
    definition: "A model or engineer can execute steps without guessing.",
  },
  {
    id: "verifiability",
    label: "Verifiability",
    definition: "Output includes validation commands and evidence expectations.",
  },
  {
    id: "safety",
    label: "Safety",
    definition: "Potentially destructive behaviors are gated and constrained.",
  },
  {
    id: "injection-resistance",
    label: "Injection Resistance",
    definition: "Document explicitly resists untrusted external instructions.",
  },
  {
    id: "secret-hygiene",
    label: "Secret Hygiene",
    definition: "Secret handling policy is explicit and prohibits leakage.",
  },
  {
    id: "token-efficiency",
    label: "Token Efficiency",
    definition: "Content is concise and respects known platform size constraints.",
  },
  {
    id: "platform-fit",
    label: "Platform Fit",
    definition: "Format matches conventions of the selected artifact/platform.",
  },
  {
    id: "maintainability",
    label: "Maintainability",
    definition: "Document is structured for easy updates and long-term consistency.",
  },
];

function statusFromBoolean(ok: boolean): QualityStatus {
  return ok ? "pass" : "fail";
}

function clampScore(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return Math.round(value);
}

function statusForScore(score: number): QualityStatus {
  if (score >= 80) {
    return "pass";
  }
  if (score >= 55) {
    return "improve";
  }
  return "fail";
}

function includesHeading(content: string, heading: string): boolean {
  return new RegExp(`(^|\\n)#{1,4}\\s+${heading}`, "i").test(content);
}

function detectScopeSignal(content: string): boolean {
  return /(scope|kapsam|include|exclude|hari[cç])/i.test(content);
}

function tokenLimitForType(type: ArtifactType): number {
  if (type === "agents") {
    return 32_768;
  }
  if (type === "rules" || type === "workflows") {
    return 12_000;
  }
  return 20_000;
}

function makeCommonChecks(type: ArtifactType, content: string): RuleCheck[] {
  const checks: RuleCheck[] = [];
  const hasHeadings = /(^|\n)#{1,4}\s+/m.test(content);
  const hasCommand = commandPattern.test(content);
  const hasVerification = verificationPattern.test(content);
  const hasInjectionGuard = injectionGuardPattern.test(content);
  const hasSecretGuard = secretGuardPattern.test(content);
  const safetyAssessment = buildSafetyAssessment(content);
  const tokenLimit = tokenLimitForType(type);
  const overLimit = content.length > tokenLimit;

  checks.push({
    id: "structure-headings",
    label: "Structured headings",
    metric: "clarity",
    requirement: "mandatory",
    status: statusFromBoolean(hasHeadings),
    description: hasHeadings
      ? "Document uses markdown headings for navigation."
      : "Document lacks heading hierarchy.",
    recommendation: "Add clear headings for purpose, rules, and verification sections.",
    evidence: hasHeadings ? "Heading markers detected." : null,
  });

  checks.push({
    id: "specific-commands",
    label: "Concrete commands",
    metric: "specificity",
    requirement: "recommended",
    status: hasCommand ? "pass" : "improve",
    description: hasCommand
      ? "Concrete commands or tools are referenced."
      : "No concrete tooling commands found.",
    recommendation: "Add exact command examples for install/test/lint/build when relevant.",
    evidence: hasCommand ? "CLI command keywords found." : null,
  });

  checks.push({
    id: "verify-evidence",
    label: "Verification and evidence",
    metric: "verifiability",
    requirement: "mandatory",
    status: hasVerification ? "pass" : "fail",
    description: hasVerification
      ? "Verification intent is present."
      : "No verification strategy detected.",
    recommendation: "Add validation commands and expected evidence format.",
    evidence: hasVerification ? "Verification keywords detected." : null,
  });

  checks.push({
    id: "dangerous-operations",
    label: "Dangerous operations gated",
    metric: "safety",
    requirement: "mandatory",
    status: safetyAssessment.status,
    description: safetyAssessment.description,
    recommendation:
      "Add explicit confirmation gates and prohibit automatic destructive execution.",
    evidence: safetyAssessment.evidence,
  });

  checks.push({
    id: "injection-guard",
    label: "Prompt injection guard",
    metric: "injection-resistance",
    requirement: "mandatory",
    status: hasInjectionGuard ? "pass" : "improve",
    description: hasInjectionGuard
      ? "Injection resistance language exists."
      : "No explicit resistance to untrusted instructions.",
    recommendation:
      "Add a rule that external websites/docs cannot override trusted project instructions.",
    evidence: hasInjectionGuard ? "Prompt injection guard phrase found." : null,
  });

  checks.push({
    id: "secret-policy",
    label: "Secret handling policy",
    metric: "secret-hygiene",
    requirement: "mandatory",
    status: hasSecretGuard ? "pass" : "improve",
    description: hasSecretGuard
      ? "Secret policy language exists."
      : "Secret handling policy is missing or vague.",
    recommendation: "Explicitly prohibit exposing or committing secrets and .env values.",
    evidence: hasSecretGuard ? "Secret policy keywords detected." : null,
  });

  checks.push({
    id: "size-limit",
    label: "Token and size discipline",
    metric: "token-efficiency",
    requirement: "recommended",
    status: overLimit ? "fail" : content.length > tokenLimit * 0.75 ? "improve" : "pass",
    description: overLimit
      ? `Content exceeds recommended size limit (${tokenLimit} chars).`
      : `Content is within expected size budget (${tokenLimit} chars).`,
    recommendation:
      "Move long references to linked docs and keep this artifact operationally focused.",
    evidence: `${content.length} chars`,
  });

  checks.push({
    id: "scope-signals",
    label: "Scope declarations",
    metric: "scope-control",
    requirement: "recommended",
    status: detectScopeSignal(content) ? "pass" : "improve",
    description: detectScopeSignal(content)
      ? "Scope language is present."
      : "No clear in-scope/out-of-scope boundaries detected.",
    recommendation: "Add explicit scope boundaries (included, excluded, limits).",
    evidence: detectScopeSignal(content) ? "Scope-related terms found." : null,
  });

  return checks;
}

function makeTypeChecks(type: ArtifactType, content: string): RuleCheck[] {
  const parsed = parseArtifactContent(content);

  if (type === "skills") {
    const frontmatter = parsed.frontmatter;
    const hasName = Boolean(frontmatter && typeof frontmatter.name === "string");
    const hasDescription = Boolean(
      frontmatter && typeof frontmatter.description === "string",
    );

    return [
      {
        id: "skills-frontmatter-name",
        label: "Frontmatter name",
        metric: "platform-fit",
        requirement: "mandatory",
        status: statusFromBoolean(hasName),
        description: hasName ? "Frontmatter includes name." : "Frontmatter name is missing.",
        recommendation: "Add YAML frontmatter with a kebab-case name field.",
        evidence: hasName ? `name: ${String(frontmatter?.name)}` : null,
      },
      {
        id: "skills-frontmatter-description",
        label: "Frontmatter description",
        metric: "platform-fit",
        requirement: "mandatory",
        status: statusFromBoolean(hasDescription),
        description: hasDescription
          ? "Frontmatter includes description trigger guidance."
          : "Frontmatter description is missing.",
        recommendation: "Add a concise description that explains when to invoke the skill.",
        evidence: hasDescription ? "description field detected." : null,
      },
      {
        id: "skills-steps",
        label: "Execution steps",
        metric: "actionability",
        requirement: "mandatory",
        status: numberedStepsPattern.test(content) ? "pass" : "improve",
        description: numberedStepsPattern.test(content)
          ? "Numbered execution steps are present."
          : "Execution flow is not clearly step-by-step.",
        recommendation: "Add an ordered execution plan with discovery/change/verify phases.",
        evidence: numberedStepsPattern.test(content) ? "Numbered steps detected." : null,
      },
      {
        id: "skills-output-format",
        label: "Output contract",
        metric: "completeness",
        requirement: "recommended",
        status: includesHeading(content, "output") ? "pass" : "improve",
        description: includesHeading(content, "output")
          ? "Output section exists."
          : "Output format is not explicitly defined.",
        recommendation: "Add an output section with summary, files changed, and verification data.",
        evidence: includesHeading(content, "output") ? "Output heading found." : null,
      },
    ];
  }

  if (type === "agents") {
    const hasQuickCommands = /(install|dev|test|lint|build)/i.test(content);
    const hasDoNot = /(do not|bunu yapma|never)/i.test(content);
    const hasRepoMap = /(repo map|klas|directory|src\/|docs\/)/i.test(content);

    return [
      {
        id: "agents-quick-commands",
        label: "Quick command reference",
        metric: "completeness",
        requirement: "mandatory",
        status: hasQuickCommands ? "pass" : "fail",
        description: hasQuickCommands
          ? "Core commands are present."
          : "No quick command block for dev/test/lint/build.",
        recommendation: "Add quick reference commands for install, dev, test, lint, and build.",
        evidence: hasQuickCommands ? "Core command keywords detected." : null,
      },
      {
        id: "agents-repo-map",
        label: "Repo map",
        metric: "maintainability",
        requirement: "recommended",
        status: hasRepoMap ? "pass" : "improve",
        description: hasRepoMap
          ? "Critical repository paths are documented."
          : "No concise repo map detected.",
        recommendation: "Document only key directories and avoid duplicating full README content.",
        evidence: hasRepoMap ? "Path-like signals detected." : null,
      },
      {
        id: "agents-do-not",
        label: "Explicit prohibited actions",
        metric: "safety",
        requirement: "mandatory",
        status: hasDoNot ? "pass" : "improve",
        description: hasDoNot
          ? "Prohibited actions are documented."
          : "No explicit do-not list detected.",
        recommendation: "Add force-push/deploy/secrets restrictions in a dedicated section.",
        evidence: hasDoNot ? "Do-not language detected." : null,
      },
    ];
  }

  if (type === "rules") {
    const hasScope = /(scope|global|workspace|dir|glob)/i.test(content);
    const hasActivation = /(activation|always|manual|model decision)/i.test(content);
    const hasDoDont = /(<do>|<dont>|\bdo\b|\bdon't\b|\bnever\b)/i.test(content);

    return [
      {
        id: "rules-scope",
        label: "Scope declaration",
        metric: "scope-control",
        requirement: "mandatory",
        status: hasScope ? "pass" : "fail",
        description: hasScope ? "Scope is declared." : "Scope declaration is missing.",
        recommendation: "Add scope fields: global/workspace/directory and optional glob targets.",
        evidence: hasScope ? "Scope signal detected." : null,
      },
      {
        id: "rules-activation",
        label: "Activation mode",
        metric: "platform-fit",
        requirement: "mandatory",
        status: hasActivation ? "pass" : "improve",
        description: hasActivation
          ? "Activation mode is documented."
          : "Activation mode not specified.",
        recommendation: "State activation mode (always, manual, model decision, glob).",
        evidence: hasActivation ? "Activation term detected." : null,
      },
      {
        id: "rules-do-dont",
        label: "Do and Don't blocks",
        metric: "actionability",
        requirement: "recommended",
        status: hasDoDont ? "pass" : "improve",
        description: hasDoDont
          ? "Rule intent contains positive and negative boundaries."
          : "No explicit do/don't framing found.",
        recommendation: "Add clear Do/Don't sections with concrete bullets.",
        evidence: hasDoDont ? "Do/Don't language found." : null,
      },
    ];
  }

  if (type === "workflows") {
    const hasPreconditions = /(precondition|önkoşul|prerequisite|clean tree|branch)/i.test(content);
    const hasFailureHandling = /(if unsure|failure|hata|retry|stop and ask)/i.test(content);

    return [
      {
        id: "workflow-preconditions",
        label: "Preconditions",
        metric: "completeness",
        requirement: "mandatory",
        status: hasPreconditions ? "pass" : "fail",
        description: hasPreconditions
          ? "Preconditions are documented."
          : "Preconditions are missing.",
        recommendation: "Add branch, clean-tree, tool availability prerequisites.",
        evidence: hasPreconditions ? "Precondition language found." : null,
      },
      {
        id: "workflow-ordered-steps",
        label: "Ordered execution steps",
        metric: "actionability",
        requirement: "mandatory",
        status: numberedStepsPattern.test(content) ? "pass" : "improve",
        description: numberedStepsPattern.test(content)
          ? "Ordered steps are present."
          : "Workflow is not clearly sequenced.",
        recommendation: "Write the workflow as a numbered, deterministic sequence.",
        evidence: numberedStepsPattern.test(content) ? "Numbered steps found." : null,
      },
      {
        id: "workflow-failure-handling",
        label: "Failure handling",
        metric: "maintainability",
        requirement: "recommended",
        status: hasFailureHandling ? "pass" : "improve",
        description: hasFailureHandling
          ? "Failure branch is documented."
          : "Failure handling branch is missing.",
        recommendation: "Add a clear fallback: stop, ask, and recover minimally.",
        evidence: hasFailureHandling ? "Failure-handling terms found." : null,
      },
    ];
  }

  const hasPhases = /(phase|faz\s+\d|###\s+phase|###\s+faz)/i.test(content);
  const hasRisk = /(risk|dependency|mitigation|bağımlılık)/i.test(content);
  const hasAcceptance = /(acceptance|başarı|exit criteria|quality gate)/i.test(content);

  return [
    {
      id: "plan-phases",
      label: "Phased execution",
      metric: "completeness",
      requirement: "mandatory",
      status: hasPhases ? "pass" : "fail",
      description: hasPhases
        ? "Plan is phase-oriented."
        : "No phase structure found.",
      recommendation: "Split plan into clear phases with checkbox tasks.",
      evidence: hasPhases ? "Phase indicators detected." : null,
    },
    {
      id: "plan-risks",
      label: "Risk and dependency analysis",
      metric: "scope-control",
      requirement: "mandatory",
      status: hasRisk ? "pass" : "improve",
      description: hasRisk
        ? "Risk/dependency section exists."
        : "Risk and dependency considerations are missing.",
      recommendation: "Add explicit risk list with mitigations and dependencies.",
      evidence: hasRisk ? "Risk/dependency keywords found." : null,
    },
    {
      id: "plan-acceptance",
      label: "Acceptance criteria",
      metric: "verifiability",
      requirement: "mandatory",
      status: hasAcceptance ? "pass" : "improve",
      description: hasAcceptance
        ? "Acceptance criteria are defined."
        : "Acceptance criteria are not explicit.",
      recommendation: "Add measurable success criteria and verification commands.",
      evidence: hasAcceptance ? "Acceptance terms detected." : null,
    },
  ];
}

function checksToMissingItems(checks: RuleCheck[]): MissingItem[] {
  const missing: MissingItem[] = [];

  for (const check of checks) {
    if (check.status === "pass") {
      continue;
    }

    let severity: MissingSeverity;
    if (check.requirement === "mandatory" && check.status === "fail") {
      severity = "blocking";
    } else if (check.requirement === "mandatory") {
      severity = "important";
    } else if (check.status === "fail") {
      severity = "important";
    } else {
      severity = "nice_to_have";
    }

    missing.push({
      id: check.id,
      severity,
      title: check.label,
      description: check.description,
      recommendation: check.recommendation,
    });
  }

  return missing;
}

function checksToMetricExplanations(
  checks: RuleCheck[],
  dimensions: JudgeDimensionScores,
): MetricExplanation[] {
  const metricScores = new Map<string, number[]>();
  const metricAssessments = new Map<string, string[]>();
  const metricRecommendations = new Map<string, string[]>();

  for (const check of checks) {
    const base =
      check.status === "pass" ? 100 : check.status === "improve" ? 65 : 25;
    const list = metricScores.get(check.metric) ?? [];
    list.push(base);
    metricScores.set(check.metric, list);

    const assessments = metricAssessments.get(check.metric) ?? [];
    assessments.push(check.description);
    metricAssessments.set(check.metric, assessments);

    if (check.status !== "pass") {
      const recs = metricRecommendations.get(check.metric) ?? [];
      recs.push(check.recommendation);
      metricRecommendations.set(check.metric, recs);
    }
  }

  const dimensionBridge: Record<string, number> = {
    clarity: dimensions.clarity,
    safety: dimensions.safety,
    "token-efficiency": dimensions.tokenEfficiency,
    completeness: dimensions.completeness,
  };

  return metrics.map((metric) => {
    const rawScores = metricScores.get(metric.id) ?? [];
    const deterministicScore =
      rawScores.length > 0
        ? rawScores.reduce((sum, current) => sum + current, 0) / rawScores.length
        : 70;

    const bridge = dimensionBridge[metric.id];
    const finalScore = clampScore(
      typeof bridge === "number" ? deterministicScore * 0.55 + bridge * 0.45 : deterministicScore,
    );

    const assessment = (metricAssessments.get(metric.id) ?? ["No strong signal detected."])
      .slice(0, 2)
      .join(" ");

    const improvement =
      (metricRecommendations.get(metric.id) ?? ["Keep this metric stable while expanding coverage."])
        .slice(0, 2)
        .join(" ");

    return {
      id: metric.id,
      label: metric.label,
      status: statusForScore(finalScore),
      score: finalScore,
      definition: metric.definition,
      assessment,
      improvement,
    };
  });
}

function getBestPracticeHints(type: ArtifactType): BestPracticeHint[] {
  if (type === "skills") {
    return [
      {
        id: "skills-hint-trigger",
        title: "Use trigger-ready descriptions",
        why: "Ambiguous descriptions lead to wrong auto-invocation.",
        goodExample:
          "description: 'Run after schema changes to update Drizzle migration files and verification steps.'",
        avoidExample: "description: 'Database helper skill.'",
      },
      {
        id: "skills-hint-gating",
        title: "Gate side effects",
        why: "Deploy/commit skills should require explicit human confirmation.",
        goodExample: "Add 'disable-model-invocation: true' and a manual confirmation step.",
        avoidExample: "Auto-run deploy in every build workflow.",
      },
      {
        id: "skills-hint-evidence",
        title: "Demand evidence output",
        why: "Skills are safer when they include verification proof requirements.",
        goodExample: "Output test command, status, and changed-file summary.",
        avoidExample: "Finish silently without validation.",
      },
    ];
  }

  if (type === "agents") {
    return [
      {
        id: "agents-hint-minimal",
        title: "Keep AGENTS.md operational and short",
        why: "Large, narrative files increase token cost and reduce instruction compliance.",
        goodExample: "Commands + constraints + verify checklist + safety boundaries.",
        avoidExample: "Copying full architecture docs into AGENTS.md.",
      },
      {
        id: "agents-hint-commands",
        title: "Pin exact commands",
        why: "Concrete command references reduce ambiguity.",
        goodExample: "`npm run test`, `npm run lint`, `npm run build`",
        avoidExample: "'Run tests if needed.'",
      },
      {
        id: "agents-hint-safety",
        title: "Document non-negotiable safety boundaries",
        why: "Persistent context should always include do-not rules.",
        goodExample: "No force push, no prod deploy, no secret logging.",
        avoidExample: "No explicit prohibited actions.",
      },
    ];
  }

  if (type === "rules") {
    return [
      {
        id: "rules-hint-scope",
        title: "Always define scope and activation",
        why: "Without scope, rules over-apply and create conflicts.",
        goodExample: "Scope: workspace, Activation: model decision, Glob: src/**/*.ts",
        avoidExample: "Single always-on mega-rule for entire repo.",
      },
      {
        id: "rules-hint-split",
        title: "Split broad rules",
        why: "Smaller, focused rules are easier for agents to follow.",
        goodExample: "Separate security, testing, and style rule files.",
        avoidExample: "One long rule with unrelated policies.",
      },
      {
        id: "rules-hint-verify",
        title: "Attach verification commands",
        why: "Rules are enforceable only when they can be checked.",
        goodExample: "`npm run lint && npm run test`",
        avoidExample: "Quality rules without enforcement commands.",
      },
    ];
  }

  if (type === "workflows") {
    return [
      {
        id: "workflow-hint-steps",
        title: "Use deterministic numbered steps",
        why: "Sequence ambiguity causes inconsistent execution.",
        goodExample: "1) Discover 2) Implement 3) Verify 4) Report",
        avoidExample: "Loose bullet points with no order.",
      },
      {
        id: "workflow-hint-failures",
        title: "Include failure branch",
        why: "Agents need stop-and-ask behavior when uncertain.",
        goodExample: "If unclear, pause and ask one targeted question.",
        avoidExample: "Continue despite failed tests.",
      },
      {
        id: "workflow-hint-gates",
        title: "Gate destructive actions",
        why: "Release workflows must remain human-controlled for safety.",
        goodExample: "Explicit confirmation before deploy or push.",
        avoidExample: "Automatic production actions.",
      },
    ];
  }

  return [
    {
      id: "plan-hint-phases",
      title: "Plan in phases with checkboxes",
      why: "Phased planning improves tracking and reduces scope drift.",
      goodExample: "Phase 1 discovery, Phase 2 implementation, Phase 3 verification.",
      avoidExample: "Single paragraph with no task decomposition.",
    },
    {
      id: "plan-hint-risks",
      title: "Track risks and dependencies",
      why: "Risk visibility prevents late surprises.",
      goodExample: "List dependencies and mitigations per phase.",
      avoidExample: "No risk section.",
    },
    {
      id: "plan-hint-criteria",
      title: "Define acceptance criteria",
      why: "Plans need measurable completion signals.",
      goodExample: "Tests pass, lint clean, key scenario validated.",
      avoidExample: "'Done when looks good.'",
    },
  ];
}

function collectStaticSignals(type: ArtifactType, content: string): AnalyzerSignal[] {
  const signals: AnalyzerSignal[] = [];
  const parsed = parseArtifactContent(content);
  const tokenLimit = tokenLimitForType(type);
  const safety = buildSafetyAssessment(content);

  if (parsed.parseError) {
    signals.push({
      id: "frontmatter-parse-error",
      category: "structure",
      severity: "warning",
      message: "Frontmatter parsing failed. Analyzer is using raw body fallback.",
      evidence: parsed.parseError,
    });
  }

  if (content.length > tokenLimit) {
    signals.push({
      id: "content-over-limit",
      category: "token",
      severity: "critical",
      message: `Content exceeds platform-oriented limit (${tokenLimit} chars).`,
      evidence: `${content.length} chars`,
    });
  } else if (content.length > tokenLimit * 0.75) {
    signals.push({
      id: "content-near-limit",
      category: "token",
      severity: "warning",
      message: `Content is approaching platform-oriented limit (${tokenLimit} chars).`,
      evidence: `${content.length} chars`,
    });
  }

  if (!injectionGuardPattern.test(content)) {
    signals.push({
      id: "missing-injection-guard",
      category: "compatibility",
      severity: "warning",
      message: "No explicit prompt-injection guard phrase detected.",
      evidence: "Expected terms: ignore external instructions, untrusted content.",
    });
  }

  return [...safety.signals, ...signals];
}

function buildValidatedFindings(type: ArtifactType, content: string): {
  findings: ValidatedFinding[];
  confidence: number;
} {
  const parsed = parseArtifactContent(content);
  const safety = buildSafetyAssessment(content);
  const tokenLimit = tokenLimitForType(type);
  const findings: ValidatedFinding[] = [safety.finding];

  if (parsed.parseError) {
    findings.push({
      id: "frontmatter-parse-validity",
      decision: "warn",
      rationale: "Frontmatter parse failed; schema-sensitive checks may be less reliable.",
      relatedSignalIds: ["frontmatter-parse-error"],
      confidence: 68,
    });
  } else {
    findings.push({
      id: "frontmatter-parse-validity",
      decision: "pass",
      rationale: "Frontmatter parse completed without errors.",
      relatedSignalIds: [],
      confidence: 92,
    });
  }

  if (content.length > tokenLimit) {
    findings.push({
      id: "token-budget-fit",
      decision: "fail",
      rationale: "Content exceeds the expected platform size budget and may be truncated.",
      relatedSignalIds: ["content-over-limit"],
      confidence: 95,
    });
  } else if (content.length > tokenLimit * 0.75) {
    findings.push({
      id: "token-budget-fit",
      decision: "warn",
      rationale: "Content is near the limit; splitting and reduction are recommended.",
      relatedSignalIds: ["content-near-limit"],
      confidence: 82,
    });
  } else {
    findings.push({
      id: "token-budget-fit",
      decision: "pass",
      rationale: "Content is within expected token/size budget.",
      relatedSignalIds: [],
      confidence: 90,
    });
  }

  const averageConfidence =
    findings.reduce((sum, finding) => sum + finding.confidence, 0) / findings.length;

  return {
    findings,
    confidence: clampScore(averageConfidence),
  };
}

export function analyzeArtifact(input: {
  type: ArtifactType;
  content: string;
  dimensions: JudgeDimensionScores;
  customChecks?: RuleCheck[];
}): JudgeAnalysis {
  const commonChecks = makeCommonChecks(input.type, input.content);
  const typeChecks = makeTypeChecks(input.type, input.content);
  const externalChecks: RuleCheck[] = input.customChecks ?? [];
  const allChecks = [...commonChecks, ...typeChecks, ...externalChecks];
  const checklist: ChecklistItem[] = allChecks.map((check) => ({
    id: check.id,
    label: check.label,
    status: check.status,
    description: check.description,
    recommendation: check.recommendation,
    evidence: check.evidence,
    metric: check.metric,
  }));

  const missingItems = checksToMissingItems(allChecks);
  const metricExplanations = checksToMetricExplanations(
    allChecks,
    input.dimensions,
  );
  const bestPracticeHints = getBestPracticeHints(input.type);
  const promptPack = getPromptPack(input.type);
  const signals = collectStaticSignals(input.type, input.content);
  const validated = buildValidatedFindings(input.type, input.content);

  return {
    checklist,
    missingItems,
    metricExplanations,
    bestPracticeHints,
    promptPack,
    signals,
    validatedFindings: validated.findings,
    confidence: validated.confidence,
  };
}
