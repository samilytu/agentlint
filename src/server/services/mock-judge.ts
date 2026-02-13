import type { ArtifactType } from "@/lib/artifacts";
import type { JudgeResult } from "@/lib/judge";
import { parseArtifactContent } from "@/lib/parser";

import { judgeSystemPrompts } from "./prompt-templates";

type MockJudgeInput = {
  type: ArtifactType;
  content: string;
};

const dangerousPattern = /force\s+push|rm\s+-rf|del\s+\/f\s+\/q|--no-verify/gi;

function clampScore(score: number) {
  if (score < 0) {
    return 0;
  }

  if (score > 100) {
    return 100;
  }

  return Math.round(score);
}

export function runMockJudge(input: MockJudgeInput): JudgeResult {
  const parsed = parseArtifactContent(input.content);
  const warnings: string[] = [];

  if (parsed.parseError) {
    warnings.push(parsed.parseError);
  }

  if (dangerousPattern.test(input.content)) {
    warnings.push("Potential dangerous command path detected. Add an explicit confirmation gate.");
  }

  const contentLength = input.content.length;
  const hasHeaders = /(^|\n)#{1,4}\s+.+/m.test(input.content);

  const clarity = clampScore(hasHeaders ? 86 : 68);
  const safety = clampScore(warnings.length > 0 ? 55 : 86);
  const tokenEfficiency = clampScore(contentLength > 32_768 ? 40 : contentLength > 16_000 ? 62 : 88);
  const completeness = clampScore(parsed.body.length > 40 ? 82 : 60);
  const score = clampScore((clarity + safety + tokenEfficiency + completeness) / 4);

  const refinedContent = [
    "# Refined Artifact",
    "",
    `- Type: ${input.type}`,
    `- Score Target: ${score}`,
    "",
    "## Operational Guidance",
    judgeSystemPrompts[input.type],
    "",
    "## Source Content",
    parsed.body || "(empty)",
  ].join("\n");

  return {
    score,
    dimensions: {
      clarity,
      safety,
      tokenEfficiency,
      completeness,
    },
    rationale:
      "Mock Judge evaluated structure, safety hints, and context size. Replace this engine with provider-backed LLM scoring in Phase 4.",
    warnings,
    refinedContent,
  };
}
