import { artifactsRouter } from "@/server/api/routers/artifacts";
import { createTRPCRouter } from "@/server/api/trpc";
import { healthRouter } from "@/server/api/routers/health";

export const appRouter = createTRPCRouter({
  artifacts: artifactsRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
