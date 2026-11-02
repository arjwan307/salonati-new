# Shared Salonati API

`worker.mjs` is the standalone source recovered from the deployed `salonati-api` Worker, then hardened on the repair branch. The import is recorded in its own commit so reviewers can distinguish existing code/assets from the security changes. The production source and embedded asset checksums are in `source-provenance.json`.

This directory does not deploy automatically from `deployment/build-static.mjs`, and it contains no production credentials or deployment configuration. The existing Worker bindings/settings were read, not changed. No migration is required by these API fixes; they use the existing account-control, registration, booking-block and session tables.

## Validation

```sh
node --check workers/salonati-api/worker.mjs
node deployment/test-shared-api.mjs
node deployment/verify-shared-api-assets.mjs
```

For the fully local Workers/D1/R2 test, install test dependencies in a disposable directory and point to Miniflare's module:

```sh
npm install --prefix /tmp/salonati-worker-runtime --no-save --ignore-scripts --no-audit --no-fund miniflare @cloudflare/workers-types
SALONATI_MINIFLARE_MODULE=/tmp/salonati-worker-runtime/node_modules/miniflare/dist/src/index.js node deployment/test-shared-api-runtime.mjs
```

The runtime suite uses local ephemeral D1/R2 only. The tested Miniflare version is `4.20260730.0`, compatibility date `2026-07-30`. Production's existing date is `2026-10-26`; it was not changed. The local test does not certify production configuration or network integration. The deterministic race tests run separately using real SQLite with hooks between validation and transaction execution.

## Review and release boundary

Review the source changes after the import commit and the Arabic API report in `docs/audit-20261103/API-FIXES.ar.md`. API and Pages releases are separate. Do not treat a Pages deployment as deploying this Worker. Production deployment should retain the existing `MODERATION_DB`, `LEGACY_DB`, `MEDIA`, `BOOKING_API`, and `WORKFLOW_QR_SECRET` bindings and the existing settings; capture the current deployment/version for rollback first. No secret values were exported.

No production deployment, live write/delete, or settings change was performed in this repair. The independent `BOOKING_API` service and its legacy tables remain outside the tested implementation; the forwarding endpoint and financial history behavior were preserved. Account hard deletion remains staged and is not exposed through this Worker.
