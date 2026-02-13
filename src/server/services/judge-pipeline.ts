import type { ArtifactType } from "@/lib/artifacts";
import type { JudgeResult } from "@/lib/judge";
import {
  runAnthropicJudge,
  runGeminiJudge,
  runOpenAIJudge,
} from "@/server/ai/judge-provider";

import { runMockJudge } from "./mock-judge";
import { judgeSystemPrompts } from "./prompt-templates";

type JudgePipelineInput = {
  type: ArtifactType;
  content: string;
};

type JudgeProviderName = "mock" | "openai" | "anthropic" | "gemini";

export type JudgePipelineOutput = {
  provider: JudgeProviderName;
  systemPrompt: string;
  result: JudgeResult;
};

export async function runJudgePipeline(
  input: JudgePipelineInput,
): Promise<JudgePipelineOutput> {
  const systemPrompt = judgeSystemPrompts[input.type];
  const provider = (process.env.LLM_PROVIDER ?? "gemini").toLowerCase();

  if (provider === "openai") {
    try {
      const result = await runOpenAIJudge({
        type: input.type,
        content: input.content,
        systemPrompt,
      });

      return {
        provider: "openai",
        systemPrompt,
        result,
      };
    } catch (error) {
      console.error("OpenAI judge failed, falling back to mock", error);
      const fallback = runMockJudge(input);

      return {
        provider: "mock",
        systemPrompt,
        result: {
          ...fallback,
          warnings: [
            "OpenAI judge failed. Falling back to Mock Judge.",
            ...fallback.warnings,
          ],
        },
      };
    }
  }

  if (provider === "anthropic") {
    try {
      const result = await runAnthropicJudge({
        type: input.type,
        content: input.content,
        systemPrompt,
      });

      return {
        provider: "anthropic",
        systemPrompt,
        result,
      };
    } catch (error) {
      console.error("Anthropic judge failed, falling back to mock", error);
      const fallback = runMockJudge(input);

      return {
        provider: "mock",
        systemPrompt,
        result: {
          ...fallback,
          warnings: [
            "Anthropic judge failed. Falling back to Mock Judge.",
            ...fallback.warnings,
          ],
        },
      };
    }
  }

  if (provider === "gemini") {
    try {
      const result = await runGeminiJudge({
        type: input.type,
        content: input.content,
        systemPrompt,
      });

      return {
        provider: "gemini",
        systemPrompt,
        result,
      };
    } catch (error) {
      console.error("Gemini judge failed, falling back to mock", error);
      const fallback = runMockJudge(input);

      return {
        provider: "mock",
        systemPrompt,
        result: {
          ...fallback,
          warnings: [
            "Gemini judge failed. Falling back to Mock Judge.",
            ...fallback.warnings,
          ],
        },
      };
    }
  }

  return {
    provider: "mock",
    systemPrompt,
    result: runMockJudge(input),
  };
}
