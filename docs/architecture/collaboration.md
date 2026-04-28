# Collaboration Architecture

This project treats shared trips as canonical server documents with per-user workspace projections. The visual UI remains unchanged; collaboration behavior is enforced through backend commands, shared contracts, and frontend runtime state.

## Core Model

- `TripDocument`: canonical server-owned trip content, owner, visibility, revision, and timestamps.
- `TripMembership`: per-user access represented as owner, editor, or viewer semantics and persisted outside the trip document.
- `WorkspaceTripProjection`: per-user dashboard/workspace view over owned and shared trips. Removing a shared trip from a collaborator workspace does not delete the canonical trip.
- `TripRevision`: every content, visibility, membership, workspace, and delete event is revision-aware and logged.

## Command Rules

- Owners can change visibility, manage members, and delete the canonical trip.
- Editors can update trip content only.
- Viewers and public anonymous users can read only.
- Full trip overwrite routes are not exposed. Clients must use explicit create, content, visibility, member, workspace, and delete commands.
- Content updates may include `expectedRevision`; stale writes return `409 REVISION_CONFLICT` instead of silently overwriting newer data.

## Persistence

The current runtime remains JSON-backed. Repository methods own file layout and provide transaction markers for multi-file trip writes, event logs, derived gallery index rebuild, workspace removal state, membership persistence, and shared trip persistence. Domain/use-case code should not directly depend on JSON paths.

## Frontend Runtime

- Local trip storage is namespaced by authenticated user email, preventing A/B account workspace contamination in the same browser.
- Workspace sync imports owned and shared workspace trips with role, owner, source, and revision metadata.
- Trip detail autosave uses a debounced serialized document save queue. Manual edits, AI updates, Explorer updates, cover changes, and advisory updates pass through the same cloud-sync path.
- A revision conflict triggers a remote reload instead of blindly overwriting server content.

## Command Surface

The collaboration API is intentionally command-only: `POST /api/trips`, `PATCH /api/trips/:tripId/content`, `PATCH /api/trips/:tripId/visibility`, member commands under `/api/trips/:tripId/members`, workspace removal under `/api/workspace/trips/:tripId`, and owner-only canonical deletion. The legacy full-save `PUT /api/trips/:tripId` route has been removed.

## Verification

Required gates after collaboration changes:

1. `npm run typecheck`
2. `npm run test`
3. `npm run build`
4. `npm run test:e2e`
5. `npm run test:visual`
