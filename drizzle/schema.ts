import {
  date,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const sourcePolicies = mysqlTable(
  "source_policies",
  {
    id: int("id").autoincrement().primaryKey(),
    sourceId: varchar("sourceId", { length: 80 }).notNull().unique(),
    displayName: varchar("displayName", { length: 160 }).notNull(),
    accessMethod: mysqlEnum("accessMethod", ["licensed_api", "permitted_feed", "fixture"]).notNull(),
    status: mysqlEnum("status", ["approved", "pending", "blocked", "degraded"]).default("pending").notNull(),
    termsUrl: text("termsUrl"),
    robotsPolicy: varchar("robotsPolicy", { length: 80 }).default("review_required").notNull(),
    rateLimitPerMinute: int("rateLimitPerMinute").default(2).notNull(),
    endpointEnvKey: varchar("endpointEnvKey", { length: 120 }),
    lastCheckedAt: timestamp("lastCheckedAt"),
    lastSuccessAt: timestamp("lastSuccessAt"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("source_policy_status_idx").on(table.status)]
);

export const routeBasket = mysqlTable("route_basket", {
  id: int("id").autoincrement().primaryKey(),
  routeCode: varchar("routeCode", { length: 16 }).notNull().unique(),
  origin: varchar("origin", { length: 3 }).notNull(),
  destination: varchar("destination", { length: 3 }).notNull(),
  cityPair: varchar("cityPair", { length: 120 }).notNull(),
  trafficWeight: decimal("trafficWeight", { precision: 10, scale: 7 }).notNull(),
  basketVersion: varchar("basketVersion", { length: 32 }).default("v1.0").notNull(),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const collectionRuns = mysqlTable(
  "collection_runs",
  {
    id: int("id").autoincrement().primaryKey(),
    runKey: varchar("runKey", { length: 80 }).notNull().unique(),
    triggerType: mysqlEnum("triggerType", ["scheduled", "manual", "replay"]).notNull(),
    status: mysqlEnum("status", ["running", "completed", "partial", "failed"]).default("running").notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
    observationCount: int("observationCount").default(0).notNull(),
    sourceCount: int("sourceCount").default(0).notNull(),
    errorCount: int("errorCount").default(0).notNull(),
    coverageRatio: decimal("coverageRatio", { precision: 7, scale: 4 }).default("0").notNull(),
    errorSummary: text("errorSummary"),
  },
  (table) => [index("collection_runs_status_idx").on(table.status), index("collection_runs_started_idx").on(table.startedAt)]
);

export const fareObservations = mysqlTable(
  "fare_observations",
  {
    id: int("id").autoincrement().primaryKey(),
    runId: int("runId"),
    sourceId: varchar("sourceId", { length: 80 }).notNull(),
    sourceQuoteId: varchar("sourceQuoteId", { length: 160 }),
    origin: varchar("origin", { length: 3 }).notNull(),
    destination: varchar("destination", { length: 3 }).notNull(),
    travelDate: date("travelDate").notNull(),
    leadDays: int("leadDays").notNull(),
    carrier: varchar("carrier", { length: 80 }).notNull(),
    flightNumber: varchar("flightNumber", { length: 32 }),
    fareFamily: varchar("fareFamily", { length: 80 }),
    fareClass: varchar("fareClass", { length: 12 }),
    currency: varchar("currency", { length: 3 }).default("INR").notNull(),
    baseFare: decimal("baseFare", { precision: 10, scale: 2 }).notNull(),
    taxes: decimal("taxes", { precision: 10, scale: 2 }).default("0").notNull(),
    udf: decimal("udf", { precision: 10, scale: 2 }).default("0").notNull(),
    mandatoryCharges: decimal("mandatoryCharges", { precision: 10, scale: 2 }).default("0").notNull(),
    optionalCharges: decimal("optionalCharges", { precision: 10, scale: 2 }).default("0").notNull(),
    totalFare: decimal("totalFare", { precision: 10, scale: 2 }).notNull(),
    availabilityStatus: mysqlEnum("availabilityStatus", ["available", "sold_out", "cancelled", "unknown"]).default("available").notNull(),
    qualityStatus: mysqlEnum("qualityStatus", ["eligible", "outlier_candidate", "rejected", "insufficient_breakdown"]).default("eligible").notNull(),
    provenanceUri: text("provenanceUri"),
    parserVersion: varchar("parserVersion", { length: 32 }).default("collector-v1").notNull(),
    collectedAt: timestamp("collectedAt").defaultNow().notNull(),
  },
  (table) => [
    index("fare_route_date_idx").on(table.origin, table.destination, table.travelDate),
    index("fare_collected_idx").on(table.collectedAt),
    index("fare_source_idx").on(table.sourceId),
  ]
);

export const indexSnapshots = mysqlTable(
  "index_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    runId: int("runId"),
    frequency: mysqlEnum("frequency", ["daily", "weekly", "monthly"]).notNull(),
    routeCode: varchar("routeCode", { length: 16 }).notNull(),
    value: decimal("value", { precision: 10, scale: 4 }).notNull(),
    changePct: decimal("changePct", { precision: 10, scale: 4 }).default("0").notNull(),
    basePeriod: varchar("basePeriod", { length: 32 }).default("2026-01").notNull(),
    observationCount: int("observationCount").default(0).notNull(),
    coverageRatio: decimal("coverageRatio", { precision: 7, scale: 4 }).default("0").notNull(),
    qualityStatus: mysqlEnum("qualityStatus", ["provisional", "published", "unavailable"]).default("provisional").notNull(),
    calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
  },
  (table) => [index("index_snapshot_lookup_idx").on(table.frequency, table.routeCode, table.calculatedAt)]
);

export const backtestRuns = mysqlTable(
  "backtest_runs",
  {
    id: int("id").autoincrement().primaryKey(),
    runKey: varchar("runKey", { length: 80 }).notNull().unique(),
    referenceSource: text("referenceSource").notNull(),
    referenceStatus: mysqlEnum("referenceStatus", ["official", "licensed", "demo", "pending_review"]).notNull(),
    startDate: date("startDate").notNull(),
    endDate: date("endDate").notNull(),
    dayCount: int("dayCount").notNull(),
    routeCount: int("routeCount").notNull(),
    meanAbsolutePercentageError: decimal("meanAbsolutePercentageError", { precision: 10, scale: 4 }).notNull(),
    rootMeanSquareError: decimal("rootMeanSquareError", { precision: 10, scale: 4 }).notNull(),
    correlation: decimal("correlation", { precision: 10, scale: 6 }).notNull(),
    reportUri: text("reportUri"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("backtest_created_idx").on(table.createdAt)]
);

export const scheduledJobs = mysqlTable("scheduled_jobs", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  cronExpression: varchar("cronExpression", { length: 40 }).notNull(),
  enabled: int("enabled").default(1).notNull(),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type FareObservation = typeof fareObservations.$inferSelect;
export type IndexSnapshot = typeof indexSnapshots.$inferSelect;
