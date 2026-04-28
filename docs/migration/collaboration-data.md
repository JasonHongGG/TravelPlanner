# Collaboration Data Migration

The collaboration store is now organized around four durable concepts:

- Canonical trip documents in `.runtime/backend/data/shared_trips/` by default.
- Trip memberships in `.runtime/backend/data/trip_memberships/` by default.
- Derived trip metadata and gallery index in `.runtime/backend/data/trip_meta/` and `.runtime/backend/data/trip_index.json` by default.
- Per-user workspace projections in `.runtime/backend/data/workspaces/` by default.
- Trip event history in `.runtime/backend/data/trip_events/` by default.

Clients create documents through `POST /api/trips`, update document content through `PATCH /api/trips/:tripId/content`, and manage access through member commands. The old full-save route is no longer part of the API surface.

## Readiness Report

Run the non-destructive report before changing production data:

```bash
npm run migrate:report
```

The report reads the active `DATA_DIR` and writes `migration_report.json` plus `migration_report_snapshot.json` under `MIGRATION_REPORT_DIR`, which defaults to `.artifacts/migration/`. The snapshot is a point-in-time export only; it does not rewrite app data.

## Cleanup Rules

- Treat `shared_trips/{tripId}.json` as the source of truth for ownership, visibility, revision, and trip content.
- Treat `trip_memberships/{tripId}.json` as the source of truth for owner/editor/viewer membership status.
- Treat `trip_index.json` as a derived cache. If it drifts, rebuild it from `trip_meta/` instead of manually editing both lists.
- Convert older embedded access maps into `trip_memberships/{tripId}.json`, verify workspace visibility, then remove embedded access fields from trip documents.
- Backfill missing `revision` values to `1` before enforcing strict optimistic concurrency on older documents.
- Use the canonical document `ownerId` when nested `tripData.ownerId` disagrees.
- Resetting `workspaces/` only clears per-user removals and projections; it does not delete canonical trips.
- Keep or archive `trip_events/` according to retention needs. The app does not depend on replaying it for current trip state.

## Clean Reset For Development

For a local development reset, stop the backend services and remove only runtime data you intend to discard:

```bash
rm -rf .runtime/backend/data/shared_trips .runtime/backend/data/trip_memberships .runtime/backend/data/trip_meta .runtime/backend/data/workspaces .runtime/backend/data/trip_events .runtime/backend/data/.transactions
rm -f .runtime/backend/data/trip_index.json
rm -rf .artifacts/migration
```

Restarting the backend recreates the directories. User account records in `.runtime/backend/data/users.json` are intentionally not removed by this reset.
