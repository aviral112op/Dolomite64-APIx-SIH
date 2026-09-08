import type { Request, Response } from "express";
import { getScheduledJobByTaskUid, markScheduledJobTriggered } from "./db";
import { runApixCollection } from "./apix";
import { sdk } from "./_core/sdk";

export async function runApixScheduledHandler(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only", startedAt });
    const job = await getScheduledJobByTaskUid(user.taskUid);
    if (!job) return res.json({ ok: true, skipped: "orphan", taskUid: user.taskUid });
    if (!job.enabled) return res.json({ ok: true, skipped: "disabled", taskUid: user.taskUid });
    const timeBucket = Math.floor(Date.now() / (30 * 60 * 1000));
    const result = await runApixCollection("scheduled", `scheduled-${timeBucket}`);
    await markScheduledJobTriggered(job.id);
    return res.json({ ok: true, taskUid: user.taskUid, result });
  } catch (error) {
    return res.status(500).json({ error: String(error), stack: error instanceof Error ? error.stack : undefined, context: { url: req.originalUrl }, timestamp: startedAt });
  }
}
