// @agent-lint/core — Custom Rule API + Plugin System
// Loads user-defined rules from .agentlint/rules/ and npm plugin packages.
// No LLM, no DB, no network. Pure static analysis extensions.

import type { ArtifactType } from "@agent-lint/shared";
import type { QualityStatus } from "@agent-lint/shared";

// ─── Public Types ────────────────────────────────────────────────

/**
 * A single rule check result — matches the internal RuleCheck shape
 * used by the core analyzer so custom rules integrate seamlessly
 * into checklist, missingItems, and metricExplanations pipelines.
 */
export type CustomRuleCheck = {
  id: string;
  label: string;
  metric: string;
  requirement: "mandatory" | "recommended";
  status: QualityStatus;
  description: string;
  recommendation: string;
  evidence: string | null;
};

/**
 * Context provided to custom rule functions.
 */
export type CustomRuleContext = {
  type: ArtifactType;
  content: string;
};

/**
 * A custom rule function. Receives artifact context, returns zero or more checks.
 * Must be a pure, synchronous function — no side effects, no file I/O.
 */
export type CustomRuleFunction = (context: CustomRuleContext) => CustomRuleCheck[];

/**
 * A loaded custom rule module. Each module exports a `rules` array.
 */
export type CustomRuleModule = {
  /** Source identifier: file path or package name */
  source: string;
  /** Array of rule functions from this module */
  rules: CustomRuleFunction[];
};

/**
 * Plugin manifest shape. npm packages exporting an `agentLintPlugin` object
 * conforming to this shape are loadable as plugins.
 */
export type AgentLintPlugin = {
  name: string;
  version?: string;
  rules: CustomRuleFunction[];
};

/**
 * Options for loading custom rules.
 */
export type LoadCustomRulesOptions = {
  /** Directory to search for .agentlint/rules/ (defaults to cwd) */
  rootDir?: string;
  /** npm plugin package names to load (e.g. ["@agent-lint/plugin-security"]) */
  plugins?: string[];
  /** If true, errors during loading are silently ignored (default: false) */
  silent?: boolean;
};

/**
 * Result of loading custom rules.
 */
export type LoadCustomRulesResult = {
  modules: CustomRuleModule[];
  errors: CustomRuleLoadError[];
};

export type CustomRuleLoadError = {
  source: string;
  message: string;
};

// ─── Validation ──────────────────────────────────────────────────

const VALID_METRICS = new Set([
  "clarity",
  "specificity",
  "scope-control",
  "completeness",
  "actionability",
  "verifiability",
  "safety",
  "injection-resistance",
  "secret-hygiene",
  "token-efficiency",
  "platform-fit",
  "maintainability",
]);

const VALID_STATUSES = new Set<string>(["pass", "improve", "fail"]);
const VALID_REQUIREMENTS = new Set<string>(["mandatory", "recommended"]);

/**
 * Validates a single CustomRuleCheck returned by a user rule.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateCustomRuleCheck(check: unknown): string | null {
  if (typeof check !== "object" || check === null) {
    return "Rule check must be a non-null object";
  }

  const obj = check as Record<string, unknown>;

  if (typeof obj.id !== "string" || obj.id.length === 0) {
    return "Rule check 'id' must be a non-empty string";
  }
  if (typeof obj.label !== "string" || obj.label.length === 0) {
    return "Rule check 'label' must be a non-empty string";
  }
  if (typeof obj.metric !== "string" || !VALID_METRICS.has(obj.metric)) {
    return `Rule check 'metric' must be one of: ${[...VALID_METRICS].join(", ")}`;
  }
  if (typeof obj.requirement !== "string" || !VALID_REQUIREMENTS.has(obj.requirement)) {
    return "Rule check 'requirement' must be 'mandatory' or 'recommended'";
  }
  if (typeof obj.status !== "string" || !VALID_STATUSES.has(obj.status)) {
    return "Rule check 'status' must be 'pass', 'improve', or 'fail'";
  }
  if (typeof obj.description !== "string" || obj.description.length === 0) {
    return "Rule check 'description' must be a non-empty string";
  }
  if (typeof obj.recommendation !== "string" || obj.recommendation.length === 0) {
    return "Rule check 'recommendation' must be a non-empty string";
  }
  if (obj.evidence !== null && typeof obj.evidence !== "string") {
    return "Rule check 'evidence' must be a string or null";
  }

  return null;
}

// ─── Rule ID Namespacing ─────────────────────────────────────────

const CUSTOM_RULE_PREFIX = "custom:";
const PLUGIN_RULE_PREFIX = "plugin:";

function namespaceCheckId(check: CustomRuleCheck, source: string, isPlugin: boolean): CustomRuleCheck {
  const prefix = isPlugin ? `${PLUGIN_RULE_PREFIX}${source}/` : `${CUSTOM_RULE_PREFIX}`;
  return {
    ...check,
    id: check.id.startsWith(prefix) ? check.id : `${prefix}${check.id}`,
  };
}

// ─── Safe Execution ──────────────────────────────────────────────

const MAX_CHECKS_PER_RULE = 50;

/**
 * Safely executes a custom rule function with validation and error boundary.
 * Returns validated checks with namespaced IDs, or empty array on failure.
 */
export function executeCustomRule(
  ruleFn: CustomRuleFunction,
  context: CustomRuleContext,
  source: string,
  isPlugin: boolean,
): { checks: CustomRuleCheck[]; errors: string[] } {
  const errors: string[] = [];
  let rawChecks: CustomRuleCheck[];

  try {
    rawChecks = ruleFn(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Rule from ${source} threw: ${message}`);
    return { checks: [], errors };
  }

  if (!Array.isArray(rawChecks)) {
    errors.push(`Rule from ${source} returned non-array: ${typeof rawChecks}`);
    return { checks: [], errors };
  }

  if (rawChecks.length > MAX_CHECKS_PER_RULE) {
    errors.push(
      `Rule from ${source} returned ${rawChecks.length} checks (max ${MAX_CHECKS_PER_RULE}). Truncating.`,
    );
    rawChecks = rawChecks.slice(0, MAX_CHECKS_PER_RULE);
  }

  const validChecks: CustomRuleCheck[] = [];
  for (const check of rawChecks) {
    const validationError = validateCustomRuleCheck(check);
    if (validationError) {
      errors.push(`Invalid check from ${source}: ${validationError}`);
      continue;
    }
    validChecks.push(namespaceCheckId(check as CustomRuleCheck, source, isPlugin));
  }

  return { checks: validChecks, errors };
}

// ─── File System Loader (.agentlint/rules/) ─────────────────────

/**
 * Attempts to load custom rule modules from .agentlint/rules/ directory.
 * Files must be .js or .mjs and export either:
 *   - A default export that is an array of CustomRuleFunction
 *   - A named `rules` export that is an array of CustomRuleFunction
 *   - A single default export function (treated as single rule)
 */
export async function loadCustomRulesFromDir(
  rootDir: string,
  silent: boolean,
): Promise<{ modules: CustomRuleModule[]; errors: CustomRuleLoadError[] }> {
  const { join } = await import("node:path");
  const { readdir } = await import("node:fs/promises");

  const rulesDir = join(rootDir, ".agentlint", "rules");
  const modules: CustomRuleModule[] = [];
  const errors: CustomRuleLoadError[] = [];

  let entries: string[];
  try {
    const dirEntries = await readdir(rulesDir, { withFileTypes: true });
    entries = dirEntries
      .filter((entry) => entry.isFile() && /\.(js|mjs)$/.test(entry.name))
      .map((entry) => join(rulesDir, entry.name));
  } catch {
    // No .agentlint/rules/ directory — not an error
    return { modules, errors };
  }

  for (const filePath of entries) {
    try {
      // Use file:// URL for Windows compatibility
      const fileUrl = new URL(`file:///${filePath.replace(/\\/g, "/")}`).href;
      const mod = await import(fileUrl);
      const rules = extractRulesFromModule(mod);

      if (rules.length === 0) {
        const err: CustomRuleLoadError = {
          source: filePath,
          message: "Module does not export any valid rule functions",
        };
        if (!silent) {
          errors.push(err);
        }
        continue;
      }

      modules.push({ source: filePath, rules });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const loadErr: CustomRuleLoadError = { source: filePath, message };
      if (!silent) {
        errors.push(loadErr);
      }
    }
  }

  return { modules, errors };
}

// ─── Plugin Loader (npm packages) ───────────────────────────────

/**
 * Attempts to load plugin packages by name via dynamic import.
 * Each plugin must export an `agentLintPlugin` object conforming to AgentLintPlugin.
 */
export async function loadPlugins(
  packageNames: string[],
  silent: boolean,
): Promise<{ modules: CustomRuleModule[]; errors: CustomRuleLoadError[] }> {
  const modules: CustomRuleModule[] = [];
  const errors: CustomRuleLoadError[] = [];

  for (const packageName of packageNames) {
    try {
      const mod = await import(packageName);
      const plugin = mod.agentLintPlugin ?? mod.default?.agentLintPlugin;

      if (!plugin || typeof plugin !== "object") {
        const err: CustomRuleLoadError = {
          source: packageName,
          message: "Package does not export an 'agentLintPlugin' object",
        };
        if (!silent) {
          errors.push(err);
        }
        continue;
      }

      if (!Array.isArray(plugin.rules)) {
        const err: CustomRuleLoadError = {
          source: packageName,
          message: "Plugin 'rules' must be an array of functions",
        };
        if (!silent) {
          errors.push(err);
        }
        continue;
      }

      const validRules = plugin.rules.filter(
        (rule: unknown) => typeof rule === "function",
      ) as CustomRuleFunction[];

      if (validRules.length === 0) {
        const err: CustomRuleLoadError = {
          source: packageName,
          message: "Plugin has no valid rule functions",
        };
        if (!silent) {
          errors.push(err);
        }
        continue;
      }

      modules.push({ source: packageName, rules: validRules });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const loadErr: CustomRuleLoadError = { source: packageName, message };
      if (!silent) {
        errors.push(loadErr);
      }
    }
  }

  return { modules, errors };
}

// ─── Module Extraction Helper ────────────────────────────────────

function extractRulesFromModule(mod: Record<string, unknown>): CustomRuleFunction[] {
  // Option 1: named export `rules` as array of functions
  if (Array.isArray(mod.rules)) {
    return mod.rules.filter((item) => typeof item === "function") as CustomRuleFunction[];
  }

  // Option 2: default export is an array of functions
  if (Array.isArray(mod.default)) {
    return mod.default.filter((item) => typeof item === "function") as CustomRuleFunction[];
  }

  // Option 3: default export is a single function
  if (typeof mod.default === "function") {
    return [mod.default as CustomRuleFunction];
  }

  // Option 4: named export `rules` on default export object
  const defaultObj = mod.default as Record<string, unknown> | undefined;
  if (defaultObj && Array.isArray(defaultObj.rules)) {
    return defaultObj.rules.filter((item) => typeof item === "function") as CustomRuleFunction[];
  }

  return [];
}

// ─── Main Loader ─────────────────────────────────────────────────

/**
 * Loads all custom rules from both .agentlint/rules/ directory and npm plugins.
 * Returns loaded modules and any errors encountered during loading.
 */
export async function loadCustomRules(
  options: LoadCustomRulesOptions = {},
): Promise<LoadCustomRulesResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const plugins = options.plugins ?? [];
  const silent = options.silent ?? false;

  const [dirResult, pluginResult] = await Promise.all([
    loadCustomRulesFromDir(rootDir, silent),
    plugins.length > 0 ? loadPlugins(plugins, silent) : { modules: [], errors: [] },
  ]);

  return {
    modules: [...dirResult.modules, ...pluginResult.modules],
    errors: [...dirResult.errors, ...pluginResult.errors],
  };
}

/**
 * Runs all loaded custom rule modules against the given artifact context.
 * Returns all validated, namespaced checks and any execution errors.
 */
export function runCustomRules(
  modules: CustomRuleModule[],
  context: CustomRuleContext,
): { checks: CustomRuleCheck[]; errors: string[] } {
  const allChecks: CustomRuleCheck[] = [];
  const allErrors: string[] = [];

  for (const mod of modules) {
    // Determine if this is a plugin (npm package) or file-based rule
    // Scoped packages like @org/pkg contain '/' but are still npm packages
    const isPlugin = mod.source.startsWith("@") || (!mod.source.includes("/") && !mod.source.includes("\\"));

    for (const ruleFn of mod.rules) {
      const { checks, errors } = executeCustomRule(ruleFn, context, mod.source, isPlugin);
      allChecks.push(...checks);
      allErrors.push(...errors);
    }
  }

  return { checks: allChecks, errors: allErrors };
}
