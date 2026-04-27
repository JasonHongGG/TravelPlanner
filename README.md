## Run Locally

**Prerequisites:** Node.js

This repository is organized as a small workspace with clear runtime boundaries:

- `frontend/` - Vite React client.
- `backend/` - Express API, DB helper server, and Copilot helper server.
- `shared/` - shared TypeScript types, API contracts, and cross-runtime helpers.

Install dependencies inside each app if they are missing:

```bash
npm --prefix backend install
npm --prefix frontend install
```

Run the development services in separate terminals or use the VS Code `dev: all` task:

```bash
npm run dev:backend:db
npm run dev:backend:copilot
npm run dev:backend
npm run dev:frontend
```

Validate the workspace:

```bash
npm run typecheck
npm run test
npm run build
```

Run the shared API contract checks directly:

```bash
npm run test:contract
```

Generate data migration readiness artifacts:

```bash
npm run migrate:report
```

Collaboration data migration and local cleanup rules are documented in [docs/collaboration-data-migration.md](docs/collaboration-data-migration.md).

Architecture refactors must keep the existing visual design stable. See `docs/visual-baseline.md` before changing UI structure, spacing, or visual hierarchy.
