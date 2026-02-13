import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { z } from "zod";

import type { ArtifactType } from "@/lib/artifacts";

const aiJudgeSchema = z.object({
  score: z.number().min(0).max(100).transform((value) => Math.round(value)),
  dimensions: z.object({
    clarity: z.number().min(0).max(100).transform((value) => Math.round(value)),
    safety: z.number().min(0).max(100).transform((value) => Math.round(value)),
    tokenEfficiency: z.number().min(0).max(100).transform((value) => Math.round(value)),
    completeness: z.number().min(0).max(100).transform((value) => Math.round(value)),
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

  const firstBraceIndex = cleaned.indexOf("{");
  const lastBraceIndex = cleaned.lastIndexOf("}");

  const candidates = [cleaned];
  if (firstBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
    candidates.push(cleaned.slice(firstBraceIndex, lastBraceIndex + 1));
  }

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return aiJudgeSchema.parse(parsed);
    } catch (error) {
      lastError = error;
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : "Unknown JSON parsing error";
  throw new Error(`Failed to parse judge JSON response: ${message}`);
}

const GEMINI_MAX_RETRIES = 3;
const GEMINI_INITIAL_DELAY_MS = 2_000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "status" in error) {
    return (error as { status: number }).status === 429;
  }
  if (error instanceof Error && error.message.includes("429")) {
    return true;
  }
  return false;
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

export async function runGeminiJudge(input: ProviderInput): Promise<AIJudgeResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const client = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  const prompt = [
    "System Instructions:",
    input.systemPrompt,
    "",
    "Return only valid JSON with keys: score, dimensions, rationale, warnings, refinedContent.",
    "",
    buildUserPrompt(input),
  ].join("\n");

  let raw = "";
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      });

      raw = response.text ?? "";
      lastError = null;
      break;
    } catch (error) {
      lastError = error;

      if (isRateLimitError(error) && attempt < GEMINI_MAX_RETRIES) {
        const delayMs = GEMINI_INITIAL_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `Gemini 429 rate-limited (attempt ${attempt + 1}/${GEMINI_MAX_RETRIES + 1}), retrying in ${delayMs}ms...`,
        );
        await sleep(delayMs);
        continue;
      }

      const status =
        typeof error === "object" && error !== null && "status" in error
          ? ` [${(error as { status: number }).status}]`
          : "";
      const message = error instanceof Error ? error.message : "Unknown Gemini error";
      throw new Error(`Gemini judge request failed${status}: ${message}`);
    }
  }

  if (lastError) {
    const message = lastError instanceof Error ? lastError.message : "Unknown Gemini error";
    throw new Error(`Gemini judge request failed after retries: ${message}`);
  }

  if (raw.trim().length === 0) {
    throw new Error("Gemini returned empty output");
  }

  return parseJsonResult(raw);
}
