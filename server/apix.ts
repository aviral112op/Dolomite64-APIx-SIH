import { and, desc, eq } from "drizzle-orm";
import {
  fareObservations,
  indexSnapshots,
  routeBasket,
  type FareObservation,
} from "../drizzle/schema";
import {
  completeCollectionRun,
  createCollectionRun,
  ensureApixSeedData,
  getApprovedSourcePolicies,
  getCollectionRun,
  getDb,
  getEnabledRoutes,
  insertFareObservations,
  insertIndexSnapshots,
} from "./db";

type TriggerType = "scheduled" | "manual" | "replay";
type QuoteInput = {
  sourceId: string;
  sourceQuoteId?: string;
  origin: string;
  destination: string;
  travelDate: string;
  leadDays: number;
  carrier: string;
  flightNumber?: string;
  fareFamily?: string;
  fareClass?: string;
  baseFare: number;
  taxes?: number;
  udf?: number;
  mandatoryCharges?: number;
  optionalCharges?: number;
  totalFare?: number;
  availabilityStatus?: "available" | "sold_out" | "cancelled" | "unknown";
  provenanceUri?: string;
};

const LEAD_WINDOWS = [1, 7, 15, 30, 45];
const FIXTURE_CARRIERS = ["IndiGo", "Air India", "Akasa Air", "SpiceJet"];
const BASE_FARES: Record<string, number> = {
  "DEL-BOM": 6100,
  "DEL-BLR": 5750,
  "BOM-BLR": 5200,
  "DEL-CCU": 6450,
  "BLR-HYD": 3900,
  "MAA-DEL": 6900,
  "BOM-CCU": 7200,
  "DEL-HYD": 5350,
  "BOM-GOI": 3400,
  "BLR-MAA": 3100,
};

function stableVariation(seed: string) {
  let value = 0;
  for (let i = 0; i < seed.length; i += 1) value = (value * 31 + seed.charCodeAt(i)) % 997;
  return (value % 17) - 8;
}

function isoTravelDate(leadDays: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + leadDays);
  return date.toISOString().slice(0, 10);
}

function buildFixtureQuotes(routes: Awaited<ReturnType<typeof getEnabledRoutes>>, collectedAt: Date): QuoteInput[] {
  const daySeed = collectedAt.toISOString().slice(0, 10);
  const quotes: QuoteInput[] = [];
  for (const route of routes) {
    const base = BASE_FARES[route.routeCode] ?? 5000;
    for (const leadDays of LEAD_WINDOWS) {
      for (const carrier of FIXTURE_CARRIERS) {
        const movement = stableVariation(`${daySeed}-${route.routeCode}-${leadDays}-${carrier}`);
        const leadPremium = Math.max(0, 45 - leadDays) * 16;
        const baseFare = Math.max(1900, base + leadPremium + movement * 23 + (carrier === "Air India" ? 170 : 0));
        const taxes = Math.round(baseFare * 0.18);
        const udf = 120;
        const mandatoryCharges = 99;
        quotes.push({
          sourceId: "fixture_demo",
          sourceQuoteId: `fixture-${route.routeCode}-${leadDays}-${carrier.replaceAll(" ", "-")}`,
          origin: route.origin,
          destination: route.destination,
          travelDate: isoTravelDate(leadDays),
          leadDays,
          carrier,
          flightNumber: `${carrier.slice(0, 2).toUpperCase()}${100 + Math.abs(movement)}`,
          fareFamily: "Economy standard",
          fareClass: "Y",
          baseFare,
          taxes,
          udf,
          mandatoryCharges,
          optionalCharges: 0,
          totalFare: baseFare + taxes + udf + mandatoryCharges,
          availabilityStatus: "available",
          provenanceUri: "fixture://apix/demo-feed",
        });
      }
    }
  }
  return quotes;
}

function normalizeRemoteQuotes(sourceId: string, payload: unknown): QuoteInput[] {
  const items = Array.isArray(payload) ? payload : (payload as { quotes?: unknown[] } | null)?.quotes;
  if (!Array.isArray(items)) throw new Error(`${sourceId} response must be an array or { quotes: [] }`);
  return items.map((item, index) => {
    const raw = item as Record<string, unknown>;
    const baseFare = Number(raw.baseFare ?? raw.base_fare ?? 0);
    const taxes = Number(raw.taxes ?? 0);
    const udf = Number(raw.udf ?? 0);
    const mandatoryCharges = Number(raw.mandatoryCharges ?? raw.mandatory_charges ?? 0);
    const optionalCharges = Number(raw.optionalCharges ?? raw.optional_charges ?? 0);
    const totalFare = Number(raw.totalFare ?? raw.total_fare ?? baseFare + taxes + udf + mandatoryCharges);
    if (!raw.origin || !raw.destination || !raw.travelDate || !raw.carrier || !Number.isFinite(totalFare)) {
      throw new Error(`${sourceId} quote ${index} is missing required fare fields`);
    }
    return {
      sourceId,
      sourceQuoteId: String(raw.sourceQuoteId ?? raw.source_quote_id ?? `${sourceId}-${index}`),
      origin: String(raw.origin),
      destination: String(raw.destination),
      travelDate: String(raw.travelDate),
      leadDays: Number(raw.leadDays ?? raw.lead_days),
      carrier: String(raw.carrier),
      flightNumber: raw.flightNumber ? String(raw.flightNumber) : undefined,
      fareFamily: raw.fareFamily ? String(raw.fareFamily) : undefined,
      fareClass: raw.fareClass ? String(raw.fareClass) : undefined,
      baseFare,
      taxes,
      udf,
      mandatoryCharges,
      optionalCharges,
      totalFare,
      availabilityStatus: "available",
      provenanceUri: raw.provenanceUri ? String(raw.provenanceUri) : undefined,
    };
  });
}

function deduplicateQuotes(quotes: QuoteInput[]) {
  const seen = new Set<string>();
  return quotes.filter((quote) => {
    if (quote.totalFare === undefined || quote.totalFare <= 0) return false;
    if (!LEAD_WINDOWS.includes(quote.leadDays)) return false;
    const key = [quote.sourceId, quote.origin, quote.destination, quote.travelDate, quote.carrier, quote.fareFamily, quote.totalFare].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function median(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  if (!ordered.length) return 0;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0 ? (ordered[middle - 1] + ordered[middle]) / 2 : ordered[middle];
}

async function previousValue(routeCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ value: indexSnapshots.value }).from(indexSnapshots).where(and(eq(indexSnapshots.frequency, "daily"), eq(indexSnapshots.routeCode, routeCode))).orderBy(desc(indexSnapshots.calculatedAt)).limit(1);
  return rows[0] ? Number(rows[0].value) : undefined;
}

async function calculateAndStore(runId: number, routes: Awaited<ReturnType<typeof getEnabledRoutes>>, rows: typeof fareObservations.$inferInsert[], expectedCount: number) {
  const snapshots: typeof indexSnapshots.$inferInsert[] = [];
  const routeValues: { routeCode: string; value: number; weight: number }[] = [];
  for (const route of routes) {
    const routeRows = rows.filter((row) => row.origin === route.origin && row.destination === route.destination && row.qualityStatus === "eligible");
    const fare = median(routeRows.map((row) => Number(row.totalFare)));
    const baseline = BASE_FARES[route.routeCode] ?? 5000;
    const value = fare > 0 ? (fare / baseline) * 100 : 0;
    const previous = await previousValue(route.routeCode);
    const changePct = previous ? ((value - previous) / previous) * 100 : 0;
    const coverage = expectedCount ? routeRows.length / Math.max(1, expectedCount / routes.length) : 0;
    routeValues.push({ routeCode: route.routeCode, value, weight: Number(route.trafficWeight) });
    snapshots.push({ runId, frequency: "daily", routeCode: route.routeCode, value: value.toFixed(4), changePct: changePct.toFixed(4), observationCount: routeRows.length, coverageRatio: Math.min(1, coverage).toFixed(4), qualityStatus: coverage >= 0.75 ? "published" : "provisional" });
  }
  const weightSum = routeValues.reduce((sum, item) => sum + item.weight, 0) || 1;
  const aggregate = routeValues.reduce((sum, item) => sum + item.value * (item.weight / weightSum), 0);
  const previousAggregate = await previousValue("ALL");
  const aggregateChange = previousAggregate ? ((aggregate - previousAggregate) / previousAggregate) * 100 : 0;
  snapshots.push({ runId, frequency: "daily", routeCode: "ALL", value: aggregate.toFixed(4), changePct: aggregateChange.toFixed(4), observationCount: rows.length, coverageRatio: Math.min(1, rows.length / Math.max(1, expectedCount)).toFixed(4), qualityStatus: rows.length / Math.max(1, expectedCount) >= 0.75 ? "published" : "provisional" });
  await insertIndexSnapshots(snapshots);
  return snapshots;
}

export async function runApixCollection(triggerType: TriggerType = "scheduled", requestedRunKey?: string) {
  const started = new Date();
  const runKey = requestedRunKey ?? `apix-${started.toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;
  await ensureApixSeedData();
  const existing = await getCollectionRun(runKey);
  if (existing?.status === "completed" || existing?.status === "partial") return { run: existing, deduplicated: true };
  const run = await createCollectionRun(runKey, triggerType);
  if (!run) throw new Error("Database is not configured");
  const routes = await getEnabledRoutes();
  const policies = await getApprovedSourcePolicies();
  const collectedAt = new Date();
  const rawQuotes: QuoteInput[] = [];
  const errors: string[] = [];
  for (const policy of policies) {
    try {
      if (policy.sourceId === "fixture_demo") {
        rawQuotes.push(...buildFixtureQuotes(routes, collectedAt));
        continue;
      }
      const endpointKey = policy.endpointEnvKey;
      const endpoint = endpointKey ? process.env[endpointKey] : undefined;
      if (!endpoint) {
        errors.push(`${policy.sourceId}: approved policy has no configured endpoint`);
        continue;
      }
      const response = await fetch(endpoint, { headers: { accept: "application/json", "user-agent": "APIx-Research/1.0 (contact required)" }, signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      rawQuotes.push(...normalizeRemoteQuotes(policy.sourceId, await response.json()));
    } catch (error) {
      errors.push(`${policy.sourceId}: ${String(error)}`);
    }
  }
  const cleanQuotes = deduplicateQuotes(rawQuotes);
  const rows: typeof fareObservations.$inferInsert[] = cleanQuotes.map((quote) => ({ ...quote, runId: run.id, travelDate: new Date(`${quote.travelDate}T00:00:00Z`), currency: "INR", baseFare: quote.baseFare!.toFixed(2), taxes: (quote.taxes ?? 0).toFixed(2), udf: (quote.udf ?? 0).toFixed(2), mandatoryCharges: (quote.mandatoryCharges ?? 0).toFixed(2), optionalCharges: (quote.optionalCharges ?? 0).toFixed(2), totalFare: quote.totalFare!.toFixed(2), qualityStatus: "eligible" as const, parserVersion: "collector-v1", collectedAt }));
  await insertFareObservations(rows);
  const expectedCount = Math.max(1, routes.length * LEAD_WINDOWS.length * Math.max(1, policies.length));
  await calculateAndStore(run.id, routes, rows, expectedCount);
  await completeCollectionRun(run.id, { status: errors.length ? "partial" : "completed", observationCount: rows.length, sourceCount: policies.length, errorCount: errors.length, coverageRatio: Math.min(1, rows.length / expectedCount).toFixed(4), errorSummary: errors.length ? errors.join("\n") : undefined });
  return { run: await getCollectionRun(runKey), deduplicated: false, observationCount: rows.length, errors };
}
