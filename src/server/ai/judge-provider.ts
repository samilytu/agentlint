import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";

import type { ArtifactType } from "@/lib/artifacts";

const aiJudgeSchema = z.object({
  score: z.number().int().min(0).max(100),
  dimensions: z.object({
    clarity: z.number().int().min(0).max(100),
    safety: z.number().int().min(0).max(100),
    tokenEfficiency: z.number().int().min(0).max(100),
    completeness: z.number().int().min(0).max(100),
  }),
  rationale: z.string().min(1),
  warnings: z.array(z.string()).default([]),
  refinedContent: z.string().min(1),
});

export type AIJudgeResult = z.infer<typeof aiJudgeSchema>;

type ProviderInput = {
  type: ArtifactType;
  content: string;
  systemPrompt: string;
};

function parseJsonResult(raw: string): AIJudgeResult {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  return aiJudgeSchema.parse(parsed);
}

function buildUserPrompt(input: ProviderInput) {
  return [
    `Artifact Type: ${input.type}`,
    "Return only valid JSON.",
    "Input:",
    input.content,
  ].join("\n\n");
}

export async function runOpenAIJudge(input: ProviderInput): Promise<AIJudgeResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const response = await client.responses.create({
    model,
    temperature: 0.1,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: `${input.systemPrompt}\n\nReturn a JSON object with keys: score, dimensions, rationale, warnings, refinedContent.`,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildUserPrompt(input),
          },
        ],
      },
    ],
  });

  const raw = response.output_text ?? "";

  if (raw.trim().length === 0) {
    throw new Error("OpenAI returned empty output");
  }

  return parseJsonResult(raw);
}

export async function runAnthropicJudge(input: ProviderInput): Promise<AIJudgeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is missing");
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest";

  const response = await client.messages.create({
    model,
    max_tokens: 1400,
    system: `${input.systemPrompt}\n\nReturn only valid JSON with keys: score, dimensions, rationale, warnings, refinedContent.`,
    messages: [
      {
        role: "user",
        content: buildUserPrompt(input),
      },
    ],
  });

  const raw = response.content
    .map((block) => {
      if (block.type === "text") {
        return block.text;
      }

      return "";
    })
    .join("\n")
    .trim();

  if (raw.length === 0) {
    throw new Error("Anthropic returned empty output");
  }

  return parseJsonResult(raw);
}
