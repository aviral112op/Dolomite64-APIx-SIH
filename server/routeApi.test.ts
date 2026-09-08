import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("route-level API contract", () => {
  const ctx = { user: undefined, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } satisfies TrpcContext;

  it("rejects malformed route codes before database access", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(caller.apix.route.metadata({ routeCode: "DEL" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects malformed lead-time route requests", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(caller.apix.route.leadTime({ routeCode: "DEL-BOM-EXTRA" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
