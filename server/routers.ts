import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { getLatestAggregate, getLatestRouteIndices, getRecentRuns, getSourceHealth, ensureApixSeedData } from "./db";
import { runApixCollection } from "./apix";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  apix: router({
    latest: publicProcedure.query(async () => {
      await ensureApixSeedData();
      const [aggregate, routes, recentRuns, sourceHealth] = await Promise.all([
        getLatestAggregate(),
        getLatestRouteIndices(),
        getRecentRuns(8),
        getSourceHealth(),
      ]);
      return {
        aggregate: aggregate ? { value: Number(aggregate.value), changePct: Number(aggregate.changePct), coverageRatio: Number(aggregate.coverageRatio), calculatedAt: aggregate.calculatedAt, qualityStatus: aggregate.qualityStatus, observationCount: aggregate.observationCount } : null,
        routes: routes.map((row) => ({ routeCode: row.routeCode, value: Number(row.value), changePct: Number(row.changePct), coverageRatio: Number(row.coverageRatio), observationCount: row.observationCount, qualityStatus: row.qualityStatus, calculatedAt: row.calculatedAt })),
        recentRuns: recentRuns.map((run) => ({ runKey: run.runKey, status: run.status, observationCount: run.observationCount, coverageRatio: Number(run.coverageRatio), startedAt: run.startedAt, completedAt: run.completedAt, errorCount: run.errorCount })),
        sourceHealth,
      };
    }),
    health: publicProcedure.query(async () => {
      await ensureApixSeedData();
      const [sourceHealth, recentRuns] = await Promise.all([getSourceHealth(), getRecentRuns(12)]);
      return { sourceHealth, recentRuns };
    }),
    runNow: adminProcedure.mutation(async () => runApixCollection("manual")),
  }),
});

export type AppRouter = typeof appRouter;
