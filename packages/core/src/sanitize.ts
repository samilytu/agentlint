/**
 * Input sanitization module.
 *
 * Handles: script tags, null bytes, control characters, prompt injection,
 * path injection patterns, shell injection patterns, and environment
 * variable interpolation detection.
 *
 * Per dikkat_edilecekler.md §3.3 and dos_and_donts.md:
 * - Never eval/exec artifact content
 * - Sanitize input to defense-in-depth
 * - Read-only guarantee maintained
 */

// ─── Removal patterns (content is actively stripped) ───

// Note: Use /g only with .replace(), NOT with .test() — avoids lastIndex mutation bug.
const SCRIPT_TAG_RE = /<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi;
const NULL_BYTE_RE = /\u0000/g;

// Control characters (C0 range except \t \n \r, plus DEL and C1 range)
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g;

// ─── Detection-only patterns (warn but don't strip — content is for analysis, not execution) ───

const INJECTION_PHRASE_PATTERNS: RegExp[] = [
  /ignore\s+all\s+previous\s+instructions/i,
  /reveal\s+system\s+prompt/i,
  /you\s+are\s+now\s+developer\s+mode/i,
  /disregard\s+(all\s+)?prior\s+(instructions|context)/i,
  /override\s+(safety|security)\s+(protocols?|measures?)/i,
  /act\s+as\s+(if\s+)?(you\s+(have\s+)?)?no\s+restrictions/i,
  /jailbreak/i,
  /DAN\s*mode/i,
];

const PATH_INJECTION_PATTERNS: RegExp[] = [
  /\.\.[/\\]/, // directory traversal: ../ or ..\
  /~[/\\]/, // home directory expansion: ~/
  /[/\\]etc[/\\](passwd|shadow|hosts)/i, // Linux sensitive paths
  /[A-Za-z]:\\(Windows|System32|Program\s*Files)/i, // Windows sensitive paths
];

const SHELL_INJECTION_PATTERNS: RegExp[] = [
  /\$\(/, // command substitution: $(...)
  /`[^`]+`/, // backtick execution: `cmd`
  /;\s*(rm|del|wget|curl|sh|bash|powershell|cmd)\b/i, // chained commands
  /\|\s*(sh|bash|cmd|powershell)\b/i, // pipe to shell
  />\s*\/dev\/null/i, // output redirection suppression
  /&&\s*(rm|del|wget|curl|sh|bash)\b/i, // && chained dangerous commands
];

const ENV_VAR_PATTERNS: RegExp[] = [
  /\$\{[A-Z_][A-Z0-9_]*\}/, // ${ENV_VAR}
  /\$[A-Z_][A-Z0-9_]*/,     // $ENV_VAR (uppercase only to reduce false positives)
  /%[A-Z_][A-Z0-9_]*%/,     // %ENV_VAR% (Windows)
];

// ─── Types ───

export type SanitizationResult = {
  sanitizedContent: string;
  warnings: string[];
};

// ─── Main Function ───

export function sanitizeUserInput(content: string): SanitizationResult {
  const warnings: string[] = [];

  let sanitized = content;

  // 1. Remove script tags
  if (SCRIPT_TAG_RE.test(sanitized)) {
    warnings.push("Script tags were removed from input.");
    // Reset lastIndex before replace (test() with /g mutates it)
    SCRIPT_TAG_RE.lastIndex = 0;
    sanitized = sanitized.replace(SCRIPT_TAG_RE, "");
  }
  SCRIPT_TAG_RE.lastIndex = 0;

  // 2. Remove null bytes
  if (NULL_BYTE_RE.test(sanitized)) {
    warnings.push("Null bytes were removed from input.");
    NULL_BYTE_RE.lastIndex = 0;
    sanitized = sanitized.replace(NULL_BYTE_RE, "");
  }
  NULL_BYTE_RE.lastIndex = 0;

  // 3. Strip control characters (except tabs, newlines, carriage returns)
  if (CONTROL_CHAR_RE.test(sanitized)) {
    warnings.push("Control characters were removed from input.");
    CONTROL_CHAR_RE.lastIndex = 0;
    sanitized = sanitized.replace(CONTROL_CHAR_RE, "");
  }
  CONTROL_CHAR_RE.lastIndex = 0;

  // 4. Detect prompt injection phrases (warn only — content kept for analysis)
  for (const pattern of INJECTION_PHRASE_PATTERNS) {
    if (pattern.test(sanitized)) {
      warnings.push("Potential prompt-injection phrase detected.");
      break;
    }
  }

  // 5. Detect path injection patterns (warn only)
  for (const pattern of PATH_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      warnings.push("Potential path injection pattern detected.");
      break;
    }
  }

  // 6. Detect shell injection patterns (warn only)
  for (const pattern of SHELL_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      warnings.push("Potential shell injection pattern detected.");
      break;
    }
  }

  // 7. Detect environment variable interpolation (warn only)
  for (const pattern of ENV_VAR_PATTERNS) {
    if (pattern.test(sanitized)) {
      warnings.push("Potential environment variable interpolation detected.");
      break;
    }
  }

  return {
    sanitizedContent: sanitized,
    warnings,
  };
}
