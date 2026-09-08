import type { Express, Request, Response } from "express";
import { ensureApixSeedData, getRouteMetadata, getRouteObservations, getRouteSeries, getRouteLeadTimeProfile, getBasketLeadTimeProfile } from "./db";

const routePattern = /^[A-Z]{3}-[A-Z]{3}$/;

function routeCodeFrom(req: Request) {
  return String(req.params.routeCode || "").toUpperCase();
}

function boundedInt(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(parsed)));
}

function assertRoute(routeCode: string, res: Response) {
  if (!routePattern.test(routeCode)) {
    res.status(400).json({ error: "routeCode must use IATA format ORG-DST, for example DEL-BOM" });
    return false;
  }
  return true;
}

export function registerRouteApi(app: Express) {
  app.get("/api/v1/basket/lead-time", async (_req, res) => {
    await ensureApixSeedData();
    const rows = await getBasketLeadTimeProfile();
    return res.json({ data: rows.map((row) => ({ leadDays: row.leadDays, averageFare: Number(row.averageFare), observationCount: Number(row.observationCount) })), meta: { leadWindows: [1, 7, 15, 30, 45], generatedAt: new Date().toISOString(), apiVersion: "v1" } });
  });

  app.get("/api/v1/routes/:routeCode", async (req, res) => {
    const routeCode = routeCodeFrom(req);
    if (!assertRoute(routeCode, res)) return;
    await ensureApixSeedData();
    const route = await getRouteMetadata(routeCode);
    if (!route) return res.status(404).json({ error: "route_not_in_basket", routeCode });
    return res.json({ data: { routeCode: route.routeCode, origin: route.origin, destination: route.destination, cityPair: route.cityPair, trafficWeight: Number(route.trafficWeight), basketVersion: route.basketVersion, enabled: Boolean(route.enabled) }, meta: { generatedAt: new Date().toISOString(), apiVersion: "v1" } });
  });

  app.get("/api/v1/routes/:routeCode/series", async (req, res) => {
    const routeCode = routeCodeFrom(req);
    if (!assertRoute(routeCode, res)) return;
    await ensureApixSeedData();
    const route = await getRouteMetadata(routeCode);
    if (!route) return res.status(404).json({ error: "route_not_in_basket", routeCode });
    const frequency = req.query.frequency === "weekly" || req.query.frequency === "monthly" ? req.query.frequency : "daily";
    const limit = boundedInt(req.query.limit, 90, 365);
    const rows = await getRouteSeries(routeCode, frequency, limit);
    return res.json({ data: rows.reverse().map((row) => ({ value: Number(row.value), changePct: Number(row.changePct), observationCount: row.observationCount, coverageRatio: Number(row.coverageRatio), qualityStatus: row.qualityStatus, calculatedAt: row.calculatedAt })), meta: { routeCode, frequency, limit, basePeriod: rows[0]?.basePeriod ?? "2026-01", generatedAt: new Date().toISOString(), apiVersion: "v1" } });
  });

  app.get("/api/v1/routes/:routeCode/observations", async (req, res) => {
    const routeCode = routeCodeFrom(req);
    if (!assertRoute(routeCode, res)) return;
    await ensureApixSeedData();
    const route = await getRouteMetadata(routeCode);
    if (!route) return res.status(404).json({ error: "route_not_in_basket", routeCode });
    const limit = boundedInt(req.query.limit, 50, 200);
    const rows = await getRouteObservations(routeCode, limit);
    return res.json({ data: rows.map((row) => ({ ...row, baseFare: Number(row.baseFare), taxes: Number(row.taxes), mandatoryCharges: Number(row.mandatoryCharges), totalFare: Number(row.totalFare) })), meta: { routeCode, limit, count: rows.length, generatedAt: new Date().toISOString(), apiVersion: "v1" } });
  });

  app.get("/api/v1/routes/:routeCode/lead-time", async (req, res) => {
    const routeCode = routeCodeFrom(req);
    if (!assertRoute(routeCode, res)) return;
    await ensureApixSeedData();
    const route = await getRouteMetadata(routeCode);
    if (!route) return res.status(404).json({ error: "route_not_in_basket", routeCode });
    const rows = await getRouteLeadTimeProfile(routeCode);
    return res.json({ data: rows.map((row) => ({ leadDays: row.leadDays, averageFare: Number(row.averageFare), observationCount: Number(row.observationCount) })), meta: { routeCode, leadWindows: [1, 7, 15, 30, 45], generatedAt: new Date().toISOString(), apiVersion: "v1" } });
  });
}
