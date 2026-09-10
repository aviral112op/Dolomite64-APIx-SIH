# Deploy APIx to Vercel

## Repository setup

Push the repository root (`apix-airfare-index`) to GitHub. Do not commit `.env` files, database credentials, OAuth secrets, or airline feed credentials. The repository now contains:

- `vercel.json` with Vite output, API rewrites, SPA fallback, serverless function limits, and a 30-minute cron declaration.
- `api/index.ts` as the Vercel serverless entrypoint.
- `server/app.ts` as the shared Express application factory used locally and on Vercel.
- `pnpm vercel-build` as the deployment build command.

## Vercel project settings

Create a new Vercel project from the GitHub repository and keep the project root at the repository root. The checked-in configuration sets the following values automatically:

| Setting | Value |
|---|---|
| Framework | Vite |
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm vercel-build` |
| Output directory | `dist/public` |
| API function | `api/index.ts` |

## Environment variables

Add these in Vercel Project Settings → Environment Variables for Preview and Production as appropriate:

- `DATABASE_URL` — production MySQL/TiDB connection string.
- `JWT_SECRET` — session signing secret.
- `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, and `OWNER_NAME` — only when Manus OAuth is enabled.
- `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` — only when storage or other built-in services are enabled.
- `CRON_SECRET` — a long random value used by Vercel Cron.
- `APX_SCHEDULED_TASK_UID` — the enabled `scheduled_jobs.taskUid` row that Vercel Cron should trigger.
- `APX_*_ENDPOINT` variables — only for approved airline or OTA feeds. Keep these blank until the relevant access agreement, robots decision, and terms review have been recorded.

Vercel Cron sends `Authorization: Bearer $CRON_SECRET` to the scheduled endpoint. The handler also continues to support the existing Manus-signed cron request path.

## Database

Run the generated migrations against the production database before the first production deployment. The migration files are in `drizzle/` and include the fare observations, route basket, source policies, index snapshots, scheduled jobs, and back-test tables. Do not run destructive SQL against production without reviewing the migration first.

## Local verification

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm vercel-build
```

To test the production server locally after building:

```bash
NODE_ENV=production pnpm start
```

The web application is served from `dist/public`; API requests are handled by the Express app behind `api/index.ts`.

## Important deployment note

Vercel functions are request-driven and are not suitable for long-running Playwright browser sessions or persistent worker queues. Keep collection work bounded and use approved APIs or licensed feeds. If a source requires a long-lived browser worker, Redis queue, IP allow-list, or persistent scheduler, run that collector on a worker service and let Vercel serve the dashboard and API.
