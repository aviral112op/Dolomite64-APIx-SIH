import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { getLatestAggregate, getLatestRouteIndices, getRecentRuns, getSourceHealth, ensureApixSeedData, getRouteMetadata, getRouteSeries, getRouteObservations } from "./db";
import { runApixCollection } from "./apix";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

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
    route: router({
      metadata: publicProcedure.input(z.object({ routeCode: z.string().regex(/^[A-Z]{3}-[A-Z]{3}$/) })).query(async ({ input }) => {
        await ensureApixSeedData();
        const route = await getRouteMetadata(input.routeCode);
        if (!route) throw new TRPCError({ code: "NOT_FOUND", message: `Route ${input.routeCode} is not in the APIx basket` });
        return { routeCode: route.routeCode, origin: route.origin, destination: route.destination, cityPair: route.cityPair, trafficWeight: Number(route.trafficWeight), basketVersion: route.basketVersion, enabled: Boolean(route.enabled) };
      }),
      series: publicProcedure.input(z.object({ routeCode: z.string().regex(/^[A-Z]{3}-[A-Z]{3}$/), frequency: z.enum(["daily", "weekly", "monthly"]).default("daily"), limit: z.number().int().min(1).max(365).default(90) })).query(async ({ input }) => {
        await ensureApixSeedData();
        const route = await getRouteMetadata(input.routeCode);
        if (!route) throw new TRPCError({ code: "NOT_FOUND", message: `Route ${input.routeCode} is not in the APIx basket` });
        const rows = await getRouteSeries(input.routeCode, input.frequency, input.limit);
        return { route: { routeCode: route.routeCode, cityPair: route.cityPair, trafficWeight: Number(route.trafficWeight) }, frequency: input.frequency, basePeriod: rows[0]?.basePeriod ?? "2026-01", data: rows.reverse().map((row) => ({ value: Number(row.value), changePct: Number(row.changePct), observationCount: row.observationCount, coverageRatio: Number(row.coverageRatio), qualityStatus: row.qualityStatus, calculatedAt: row.calculatedAt })) };
      }),
      observations: publicProcedure.input(z.object({ routeCode: z.string().regex(/^[A-Z]{3}-[A-Z]{3}$/), limit: z.number().int().min(1).max(200).default(50) })).query(async ({ input }) => {
        await ensureApixSeedData();
        const route = await getRouteMetadata(input.routeCode);
        if (!route) throw new TRPCError({ code: "NOT_FOUND", message: `Route ${input.routeCode} is not in the APIx basket` });
        const rows = await getRouteObservations(input.routeCode, input.limit);
        return { routeCode: input.routeCode, count: rows.length, data: rows.map((row) => ({ ...row, baseFare: Number(row.baseFare), taxes: Number(row.taxes), mandatoryCharges: Number(row.mandatoryCharges), totalFare: Number(row.totalFare) })) };
      }),
    }),
    runNow: adminProcedure.mutation(async () => runApixCollection("manual")),
  }),
});

export type AppRouter = typeof appRouter;
