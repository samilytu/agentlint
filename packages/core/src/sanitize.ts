const scriptTagPattern = /<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi;
const nullBytePattern = /\u0000/g;
const injectionSignals = [
  /ignore\s+all\s+previous\s+instructions/gi,
  /reveal\s+system\s+prompt/gi,
  /you\s+are\s+now\s+developer\s+mode/gi,
];

export type SanitizationResult = {
  sanitizedContent: string;
  warnings: string[];
};

export function sanitizeUserInput(content: string): SanitizationResult {
  const warnings: string[] = [];

  let sanitized = content;

  if (scriptTagPattern.test(sanitized)) {
    warnings.push("Script tags were removed from input.");
    sanitized = sanitized.replace(scriptTagPattern, "");
  }

  if (nullBytePattern.test(sanitized)) {
    warnings.push("Null bytes were removed from input.");
    sanitized = sanitized.replace(nullBytePattern, "");
  }

  for (const signal of injectionSignals) {
    if (signal.test(sanitized)) {
      warnings.push("Potential prompt-injection phrase detected.");
      break;
    }
  }

  return {
    sanitizedContent: sanitized,
    warnings,
  };
}
