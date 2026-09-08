# APIx implementation and compliance guide

## Delivered prototype capabilities

APIx now maintains a 20-route representative domestic basket, five advance-purchase windows (T+1, T+7, T+15, T+30, and T+45), normalized fare observations, source governance records, collection runs, route-weighted index snapshots, route-level APIs, source-health metadata, analytical dashboard views, and automated tests.

Each observation records its source, quote identifier, origin, destination, travel date, lead time, carrier, flight number, fare family, fare class, currency, base fare, taxes, user-development fee, mandatory charges, optional charges, total fare, availability status, quality status, provenance URI, parser version, and collection timestamp.

## Collection and ethical access

The collector supports two safe modes. The development mode uses a clearly labelled deterministic fixture feed to demonstrate scheduling, normalization, indexing, and testing. Production mode reads only source policies marked `approved` and calls an endpoint configured through the corresponding environment variable, such as `APX_INDIGO_ENDPOINT` or `APX_AIR_INDIA_ENDPOINT`.

The prototype deliberately does not bypass CAPTCHAs, defeat anti-bot controls, rotate residential IPs, harvest sessions, access private pages, or scrape a source after a block. A source remains `pending` until an official API, licensed feed, or written permission is recorded. Each check records a last-checked timestamp, last-success timestamp, rate limit, terms/robots review state, and notes. Failed sources are isolated and the collection run is marked partial rather than silently substituting a price.

## Cleaning and quality pipeline

The pipeline rejects missing or invalid routes, identical origin/destination pairs, invalid lead windows, non-positive fares, non-finite values, non-INR conversion gaps, sold-out/cancelled/unknown availability, and fare-component totals that differ from the reported total beyond tolerance. Exact duplicates are removed using source, route, travel date, carrier, fare family, and total fare. Robust median/MAD screening flags extreme observations as `outlier_candidate`; records are retained for audit but excluded from the eligible index cohort.

## Index construction

The route index uses a base-period price relative with January 2026 equal to 100. Route values use the median of eligible all-in fares and the aggregate uses normalized traffic weights from the route basket. Every completed run publishes daily, weekly, and monthly snapshot rows with observation count, coverage ratio, quality status, calculation timestamp, and run identifier.

## APIs

Versioned REST endpoints are available at:

- `GET /api/v1/routes/{routeCode}` — route metadata and basket weight.
- `GET /api/v1/routes/{routeCode}/series?frequency=daily|weekly|monthly&limit=90` — index history and quality metadata.
- `GET /api/v1/routes/{routeCode}/observations?limit=50` — recent normalized fare observations.
- `GET /api/v1/routes/{routeCode}/lead-time` — T+1/T+7/T+15/T+30/T+45 lead-time fare profile.
- `GET /api/v1/basket/lead-time` — basket-wide lead-time fare profile for elasticity analysis.

Equivalent typed tRPC procedures are available under `apix.route.metadata`, `apix.route.series`, `apix.route.observations`, and `apix.route.leadTime`. All responses include freshness, coverage, quality, and API version metadata where applicable.

## Dashboard

The dashboard provides the headline index, daily/weekly/monthly controls, route watch, sector heatmap, lead-time elasticity view, source governance language, and 30-day back-test status. Selecting a route loads its lead-time profile and route-level index context.

## Back-testing

The back-test runner stores a reproducible 30-day replay with MAPE, RMSE, correlation, route count, date window, and reference provenance. The currently stored run is explicitly marked `demo` because the public DGCA material found for this prototype reports an aggregate comparison but does not publish the route-by-day panel required for a genuine route-level validation. Replace the reference input with an official DGCA route-level export to promote the result to `official`; the schema and metrics are already in place.

## Scheduled execution

The scheduled callback is mounted at `POST /api/scheduled/apix-collection`. It accepts only the platform’s authenticated cron request, is idempotent by 30-minute time bucket, and records completion, partial failures, source count, observation count, and coverage. Deployment must attach the recurring task UID to the `apix-collection-30m` job record.

## Verification

The project has automated pipeline tests for normalization, invalid and unavailable fare rejection, deduplication, outlier flagging, route API contract validation, and authentication behavior. TypeScript checks, Vitest tests, production build, API smoke tests, multi-frequency series checks, and desktop/mobile visual checks have been run successfully.

## Production completion items

Two inputs cannot be truthfully fabricated by application code: approved access credentials or feed agreements for the named airline/OTA sources, and the official DGCA route-level reference panel for the 30-day validation. Once those inputs are supplied, enable the corresponding source policy, set its endpoint environment variable, load the DGCA reference file, and rerun the back-test without changing the collection or index architecture.
