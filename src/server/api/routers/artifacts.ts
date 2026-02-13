import { TRPCError } from "@trpc/server";
import { desc } from "drizzle-orm";

import { artifactSubmissionSchema } from "@/lib/artifacts";
import { artifacts } from "@/server/db/schema";
import { db } from "@/server/db";
import { validateMarkdownOrYaml } from "@/server/security/export-validation";
import { checkRateLimit } from "@/server/security/rate-limit";
import { sanitizeUserInput } from "@/server/security/sanitize";
import { runJudgePipeline } from "@/server/services/judge-pipeline";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const artifactsRouter = createTRPCRouter({
  listRecent: publicProcedure.query(async () => {
    return db.select().from(artifacts).orderBy(desc(artifacts.id)).limit(20);
  }),

  analyze: publicProcedure.input(artifactSubmissionSchema).mutation(async ({ ctx, input }) => {
    const limit = checkRateLimit(
      `judge:${ctx.ip}`,
      Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 30),
      Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    );

    if (!limit.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Retry in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
      });
    }

    const sanitized = sanitizeUserInput(input.content);

    const judged = await runJudgePipeline({
      type: input.type,
      content: sanitized.sanitizedContent,
    });

    const exportValidation = validateMarkdownOrYaml(judged.result.refinedContent);
    const warnings = [...sanitized.warnings, ...judged.result.warnings];

    if (!exportValidation.valid && exportValidation.reason) {
      warnings.push(`Export validation failed: ${exportValidation.reason}`);
    }

    const refinedContent = exportValidation.valid
      ? judged.result.refinedContent
      : sanitized.sanitizedContent;

    const inserted = await db
      .insert(artifacts)
      .values({
        type: input.type,
        originalContent: sanitized.sanitizedContent,
        refinedContent,
        score: judged.result.score,
        userId: input.userId ?? null,
      })
      .returning({ id: artifacts.id });

    return {
      artifactId: inserted[0]?.id ?? null,
      provider: judged.provider,
      remainingRequests: limit.remaining,
      result: {
        ...judged.result,
        refinedContent,
        warnings,
      },
    };
  }),
});
