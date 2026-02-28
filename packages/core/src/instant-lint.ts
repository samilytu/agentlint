export type InstantLintSeverity = "info" | "warn" | "error";

export type InstantLintSignal = {
  id: string;
  severity: InstantLintSeverity;
  message: string;
};

const riskyPattern = /(force\s+push|rm\s+-rf|--no-verify|deploy\s+prod|del\s+\/f\s+\/q)/i;
const negationPattern = /(do\s+not|don't|never|avoid|forbid|yasak|yapma)/i;

export function buildInstantLintSignals(input: {
  content: string;
  maxChars: number;
}): InstantLintSignal[] {
  const content = input.content;
  const signals: InstantLintSignal[] = [];

  if (content.length > input.maxChars) {
    signals.push({
      id: "over-limit",
      severity: "error",
      message: `Input is above the ${input.maxChars.toLocaleString()} character budget.`,
    });
  } else if (content.length > input.maxChars * 0.8) {
    signals.push({
      id: "near-limit",
      severity: "warn",
      message: "Input is close to size limit; consider trimming for better judge quality.",
    });
  }

  if (!/(^|\n)#{1,4}\s+/m.test(content)) {
    signals.push({
      id: "missing-headings",
      severity: "info",
      message: "No markdown heading detected yet. Add structure for better clarity scoring.",
    });
  }

  const riskyMentions = content
    .split("\n")
    .filter((line) => riskyPattern.test(line) && !negationPattern.test(line));
  if (riskyMentions.length > 0) {
    signals.push({
      id: "risky-operations",
      severity: "warn",
      message: "Potentially destructive command detected without an obvious guard phrase.",
    });
  }

  if (!/(prompt\s+injection|untrusted\s+content|ignore\s+external\s+instructions)/i.test(content)) {
    signals.push({
      id: "injection-guard",
      severity: "info",
      message: "No explicit prompt-injection guard phrase found yet.",
    });
  }

  return signals.slice(0, 4);
}
