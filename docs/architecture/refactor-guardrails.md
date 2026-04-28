# Refactor Implementation Guardrails

This refactor changes architecture, not visual design. Existing UI appearance is frozen unless a separate UI change is explicitly approved.

## UI Freeze Rules

- Do not change layout, spacing, class names, icon placement, modal structure, button placement, or visual hierarchy while doing architecture refactors.
- Route changes, state ownership changes, API contracts, persistence changes, and security changes are allowed when the rendered UI remains visually equivalent.
- Generation job status improvements must reuse existing loading, error, and retry surfaces.
- Settings and purchase modal ownership can move to the app shell, but modal visuals and entry points must remain the same.

## Acceptance Workflows

- Login and auth restore.
- Dashboard list, create trip modal, import, export, delete, retry.
- Trip generation queued, running, completed, failed, retry, and reload recovery.
- Trip detail tabs, assistant updates, map interactions, cover image actions, feasibility modal.
- Attraction Explorer initial search, buffered queue, load more, selections, and confirmation.
- Points balance, membership purchase modal, subscription gating.
- Settings modal load, update, local fallback, and reset.
- Private sharing, public sharing, permission update, share URL, read-only shared view, write shared view.
- Gallery pagination, random trips, likes, and cover fallback.
- Export, encryption, and decryption flows.

## Folder Discipline

- Keep top-level project structure readable: `backend`, `frontend`, `shared`, and `docs`.
- Prefer cohesive files with clear ownership over tiny fragmented files.
- Add a new file only when it owns a stable boundary: shared contracts, persistence store, token signing, routes, runtime hooks, or tests.
- Do not move UI components solely for naming symmetry; move them only when a feature boundary becomes clearer.
