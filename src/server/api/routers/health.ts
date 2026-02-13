import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const healthRouter = createTRPCRouter({
  ping: publicProcedure
    .input(
      z
        .object({
          name: z.string().min(1).optional(),
        })
        .optional(),
    )
    .query(({ input }) => {
      return {
        message: input?.name ? `pong, ${input.name}` : "pong",
        timestamp: new Date().toISOString(),
      };
    }),
});
