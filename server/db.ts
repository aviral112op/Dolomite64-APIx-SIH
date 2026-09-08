import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  collectionRuns,
  fareObservations,
  indexSnapshots,
  routeBasket,
  scheduledJobs,
  sourcePolicies,
  type InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  } else {
    values.lastSignedIn = new Date();
    updateSet.lastSignedIn = values.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function ensureApixSeedData() {
  const db = await getDb();
  if (!db) return false;
  const routes = [
    ["DEL-BOM", "DEL", "BOM", "Delhi — Mumbai", "0.18"],
    ["DEL-BLR", "DEL", "BLR", "Delhi — Bengaluru", "0.16"],
    ["BOM-BLR", "BOM", "BLR", "Mumbai — Bengaluru", "0.14"],
    ["DEL-CCU", "DEL", "CCU", "Delhi — Kolkata", "0.11"],
    ["BLR-HYD", "BLR", "HYD", "Bengaluru — Hyderabad", "0.09"],
    ["MAA-DEL", "MAA", "DEL", "Chennai — Delhi", "0.08"],
    ["BOM-CCU", "BOM", "CCU", "Mumbai — Kolkata", "0.07"],
    ["DEL-HYD", "DEL", "HYD", "Delhi — Hyderabad", "0.07"],
    ["BOM-GOI", "BOM", "GOI", "Mumbai — Goa", "0.05"],
    ["BLR-MAA", "BLR", "MAA", "Bengaluru — Chennai", "0.05"],
  ] as const;
  for (const [routeCode, origin, destination, cityPair, trafficWeight] of routes) {
    await db.insert(routeBasket).values({ routeCode, origin, destination, cityPair, trafficWeight }).onDuplicateKeyUpdate({ set: { trafficWeight } });
  }
  const policies = [
    { sourceId: "fixture_demo", displayName: "APIx demo feed", accessMethod: "fixture" as const, status: "approved" as const, robotsPolicy: "not_applicable", rateLimitPerMinute: 2, notes: "Clearly labelled deterministic fixture data for development and QA; not a market quote." },
    { sourceId: "indigo_approved_feed", displayName: "IndiGo approved feed", accessMethod: "licensed_api" as const, status: "pending" as const, endpointEnvKey: "APX_INDIGO_ENDPOINT", notes: "Enable only after API agreement or written permission is recorded." },
    { sourceId: "air_india_approved_feed", displayName: "Air India approved feed", accessMethod: "licensed_api" as const, status: "pending" as const, endpointEnvKey: "APX_AIR_INDIA_ENDPOINT", notes: "Enable only after API agreement or written permission is recorded." },
    { sourceId: "air_india_express_approved_feed", displayName: "Air India Express approved feed", accessMethod: "licensed_api" as const, status: "pending" as const, endpointEnvKey: "APX_AIR_INDIA_EXPRESS_ENDPOINT", notes: "Enable only after API agreement or written permission is recorded." },
    { sourceId: "akasa_approved_feed", displayName: "Akasa Air approved feed", accessMethod: "licensed_api" as const, status: "pending" as const, endpointEnvKey: "APX_AKASA_ENDPOINT", notes: "Enable only after API agreement or written permission is recorded." },
    { sourceId: "spicejet_approved_feed", displayName: "SpiceJet approved feed", accessMethod: "licensed_api" as const, status: "pending" as const, endpointEnvKey: "APX_SPICEJET_ENDPOINT", notes: "Enable only after API agreement or written permission is recorded." },
    { sourceId: "ota_approved_feed", displayName: "OTA approved feed", accessMethod: "licensed_api" as const, status: "pending" as const, endpointEnvKey: "APX_OTA_ENDPOINT", notes: "Enable only after API agreement or written permission is recorded." },
  ];
  for (const policy of policies) {
    await db.insert(sourcePolicies).values(policy).onDuplicateKeyUpdate({ set: { displayName: policy.displayName, endpointEnvKey: policy.endpointEnvKey, notes: policy.notes } });
  }
  await db.insert(scheduledJobs).values({ name: "apix-collection-30m", cronExpression: "0 */30 * * * *", enabled: 1 }).onDuplicateKeyUpdate({ set: { cronExpression: "0 */30 * * * *" } });
  return true;
}

export async function getCollectionRun(runKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(collectionRuns).where(eq(collectionRuns.runKey, runKey)).limit(1);
  return rows[0];
}

export async function createCollectionRun(runKey: string, triggerType: "scheduled" | "manual" | "replay") {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(collectionRuns).values({ runKey, triggerType, status: "running" }).onDuplicateKeyUpdate({ set: { runKey } });
  return getCollectionRun(runKey);
}

export async function completeCollectionRun(id: number, values: { status: "completed" | "partial" | "failed"; observationCount: number; sourceCount: number; errorCount: number; coverageRatio: string; errorSummary?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(collectionRuns).set({ ...values, completedAt: new Date() }).where(eq(collectionRuns.id, id));
}

export async function insertFareObservations(rows: typeof fareObservations.$inferInsert[]) {
  const db = await getDb();
  if (!db || rows.length === 0) return;
  await db.insert(fareObservations).values(rows);
}

export async function getEnabledRoutes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(routeBasket).where(eq(routeBasket.enabled, 1));
}

export async function insertIndexSnapshots(rows: typeof indexSnapshots.$inferInsert[]) {
  const db = await getDb();
  if (!db || rows.length === 0) return;
  await db.insert(indexSnapshots).values(rows);
}

export async function getLatestAggregate() {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(indexSnapshots).where(and(eq(indexSnapshots.frequency, "daily"), eq(indexSnapshots.routeCode, "ALL"))).orderBy(desc(indexSnapshots.calculatedAt)).limit(1);
  return rows[0];
}

export async function getLatestRouteIndices() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(indexSnapshots).where(and(eq(indexSnapshots.frequency, "daily"), sql`${indexSnapshots.routeCode} <> 'ALL'`)).orderBy(desc(indexSnapshots.calculatedAt)).limit(10);
  return rows;
}

export async function getRecentRuns(limit = 8) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(collectionRuns).orderBy(desc(collectionRuns.startedAt)).limit(limit);
}

export async function getSourceHealth() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ sourceId: sourcePolicies.sourceId, displayName: sourcePolicies.displayName, status: sourcePolicies.status, lastSuccessAt: sourcePolicies.lastSuccessAt, notes: sourcePolicies.notes }).from(sourcePolicies).orderBy(sourcePolicies.displayName);
}

export async function getApprovedSourcePolicies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sourcePolicies).where(eq(sourcePolicies.status, "approved"));
}

export async function getScheduledJobByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(scheduledJobs).where(eq(scheduledJobs.scheduleCronTaskUid, taskUid)).limit(1);
  return rows[0];
}

export async function markScheduledJobTriggered(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(scheduledJobs).set({ lastTriggeredAt: new Date() }).where(eq(scheduledJobs.id, id));
}
