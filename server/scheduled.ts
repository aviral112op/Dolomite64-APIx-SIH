import type { Request, Response } from "express";
import { getScheduledJobByTaskUid, markScheduledJobTriggered } from "./db";
import { runApixCollection } from "./apix";
import { sdk } from "./_core/sdk";

export async function runApixScheduledHandler(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  try {
    const configuredSecret = process.env.CRON_SECRET;
    const suppliedSecret = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const vercelCronAuthorized = Boolean(configuredSecret && suppliedSecret && suppliedSecret === configuredSecret);
    const user = vercelCronAuthorized ? null : await sdk.authenticateRequest(req);
    const taskUid = user?.isCron && user.taskUid ? user.taskUid : vercelCronAuthorized ? process.env.APX_SCHEDULED_TASK_UID : undefined;
    if (!taskUid) return res.status(403).json({ error: "cron-only", startedAt });
    const job = await getScheduledJobByTaskUid(taskUid);
    if (!job) return res.json({ ok: true, skipped: "orphan", taskUid });
    if (!job.enabled) return res.json({ ok: true, skipped: "disabled", taskUid });
    const timeBucket = Math.floor(Date.now() / (30 * 60 * 1000));
    const result = await runApixCollection("scheduled", `scheduled-${timeBucket}`);
    await markScheduledJobTriggered(job.id);
    return res.json({ ok: true, taskUid, result });
  } catch (error) {
    return res.status(500).json({ error: String(error), stack: error instanceof Error ? error.stack : undefined, context: { url: req.originalUrl }, timestamp: startedAt });
  }
}
