import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { registerRouteApi } from "./routeApi";
import { runApixScheduledHandler } from "./scheduled";
import { createContext } from "./_core/context";

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerRouteApi(app);
  app.post("/api/scheduled/apix-collection", runApixScheduledHandler);
  app.get("/api/scheduled/apix-collection", runApixScheduledHandler);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );
  return app;
}
