## Run Locally

**Prerequisites:** Node.js

This repository is organized as a small workspace with clear runtime boundaries:

- `frontend/` - Vite React client.
- `backend/` - Express API, DB helper server, and Copilot helper server.
- `shared/` - current shared TypeScript types used by the app.
- `packages/contracts/` - schema-first API contract boundary used by the refactor baseline.

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

Generate data migration readiness artifacts:

```bash
npm run migrate:report
```

Architecture refactors must keep the existing visual design stable. See `docs/visual-baseline.md` before changing UI structure, spacing, or visual hierarchy.
