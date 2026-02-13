import { initTRPC } from "@trpc/server";

export async function createTRPCContext(opts: { headers: Headers }) {
  const forwardedFor = opts.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? "local";

  return {
    headers: opts.headers,
    ip,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create();

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
