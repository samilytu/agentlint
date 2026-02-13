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
const GEMINI_MODEL_CACHE_TTL_MS = 10 * 60 * 1000;
const GEMINI_DEFAULT_MODEL_CHAIN = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.0-flash-001",
] as const;

let geminiModelCache:
  | {
      expiresAt: number;
      models: Set<string>;
    }
  | null = null;

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

function normalizeModelName(model: string): string {
  return model
    .replace(/^models\//, "")
    .replace(/^google\//, "")
    .replace(/^publishers\/google\/models\//, "")
    .trim()
    .toLowerCase();
}

function uniqueModels(models: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const model of models) {
    const normalized = normalizeModelName(model);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(model.trim());
  }

  return unique;
}

function getGeminiModelChain(): string[] {
  const configuredPrimary = process.env.GEMINI_MODEL?.trim();
  const configuredFallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const configuredGemma = process.env.GEMINI_GEMMA_MODEL?.trim();

  return uniqueModels([
    configuredPrimary ?? GEMINI_DEFAULT_MODEL_CHAIN[0],
    ...GEMINI_DEFAULT_MODEL_CHAIN,
    ...configuredFallbacks,
    ...(configuredGemma ? [configuredGemma] : []),
  ]);
}

async function getGeminiAvailableModels(client: GoogleGenAI): Promise<Set<string> | null> {
  if (geminiModelCache && geminiModelCache.expiresAt > Date.now()) {
    return geminiModelCache.models;
  }

  try {
    const modelNames = new Set<string>();
    const listed = await client.models.list();
    for await (const entry of listed) {
      if (entry && typeof entry.name === "string") {
        modelNames.add(normalizeModelName(entry.name));
      }
    }

    geminiModelCache = {
      expiresAt: Date.now() + GEMINI_MODEL_CACHE_TTL_MS,
      models: modelNames,
    };

    return modelNames;
  } catch (error) {
    console.warn("Gemini models.list failed; skipping availability filtering.", error);
    return null;
  }
}

function isModelAvailable(model: string, available: Set<string> | null): boolean {
  if (!available) {
    return true;
  }

  const normalized = normalizeModelName(model);
  if (available.has(normalized)) {
    return true;
  }

  return Array.from(available).some((name) => name.endsWith(`/${normalized}`));
}

async function generateGeminiWithRetry(input: {
  client: GoogleGenAI;
  model: string;
  prompt: string;
}): Promise<string> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    try {
      const response = await input.client.models.generateContent({
        model: input.model,
        contents: input.prompt,
        config: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      });

      return response.text ?? "";
    } catch (error) {
      lastError = error;

      if (isRateLimitError(error) && attempt < GEMINI_MAX_RETRIES) {
        const delayMs = GEMINI_INITIAL_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `Gemini 429 for model ${input.model} (attempt ${attempt + 1}/${
            GEMINI_MAX_RETRIES + 1
          }), retrying in ${delayMs}ms...`,
        );
        await sleep(delayMs);
        continue;
      }

      const status =
        typeof error === "object" && error !== null && "status" in error
          ? ` [${(error as { status: number }).status}]`
          : "";
      const message = error instanceof Error ? error.message : "Unknown Gemini error";
      throw new Error(`Gemini model ${input.model} failed${status}: ${message}`);
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Unknown Gemini error";
  throw new Error(`Gemini model ${input.model} failed after retries: ${message}`);
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
  const candidateChain = getGeminiModelChain();
  const availableModels = await getGeminiAvailableModels(client);
  const modelsToTry = candidateChain.filter((model) => isModelAvailable(model, availableModels));

  if (modelsToTry.length === 0) {
    throw new Error("No Gemini models available after capability filtering.");
  }

  const prompt = [
    "System Instructions:",
    input.systemPrompt,
    "",
    "Return only valid JSON with keys: score, dimensions, rationale, warnings, refinedContent.",
    "",
    buildUserPrompt(input),
  ].join("\n");

  const errors: string[] = [];

  for (let index = 0; index < modelsToTry.length; index++) {
    const model = modelsToTry[index];
    console.info(`[Judge][Gemini] Attempting model: ${model}`);

    try {
      const raw = await generateGeminiWithRetry({
        client,
        model,
        prompt,
      });

      if (raw.trim().length === 0) {
        throw new Error("Gemini returned empty output");
      }

      const parsed = parseJsonResult(raw);
      if (index > 0) {
        parsed.warnings = [
          `Primary Gemini model unavailable. Fallback model used: ${model}.`,
          ...parsed.warnings,
        ];
      }

      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Gemini error";
      errors.push(message);
      console.warn(`[Judge][Gemini] Model ${model} failed: ${message}`);
    }
  }

  throw new Error(
    `Gemini judge request failed for all candidate models: ${errors.join(" | ")}`,
  );
}
