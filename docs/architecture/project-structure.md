# Project Structure

The repository separates source code, local runtime state, and generated artifacts.

```text
TravelPlannerDashboard/
  .github/                 CI workflows.
  .runtime/                Local runtime state, ignored by git.
  .artifacts/              Generated reports and test output, ignored by git.
  backend/                 Express servers and backend package metadata.
  frontend/                Vite React client and frontend package metadata.
  shared/                  Shared contracts and TypeScript types.
  docs/                    Architecture, migration, operations, and testing notes.
```

## Source Boundaries

- `backend/src/platform/` owns runtime paths, logging, persistence adapters, and process-level integration helpers.
- `backend/src/modules/` owns backend business modules. Feature code should live here instead of accumulating in generic service folders.
- `frontend/src/` owns the React application source. Existing UI modules are grouped by source kind (`components`, `context`, `hooks`, `services`, `utils`) and can be moved into feature folders when a feature boundary is being actively changed.
- `shared/` is the only package intended to be imported by both backend and frontend.

## Generated Boundaries

- `.runtime/backend/data/` is the default JSON runtime database for local development.
- `.runtime/backend/logs/` is the default backend log directory.
- `.runtime/backend/copilot-logs/` is the default Copilot request/response log directory.
- `.artifacts/playwright/` contains Playwright traces, screenshots, videos, and HTML reports.
- `.artifacts/migration/` contains migration readiness reports and snapshots.

Generated folders are intentionally outside `backend/` and `frontend/` so package folders remain source-focused.