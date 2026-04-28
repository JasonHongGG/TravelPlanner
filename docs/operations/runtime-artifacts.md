# Runtime And Artifacts

Local execution creates files that should not be mixed with source code.

## Runtime State

The backend resolves runtime paths from environment variables first, then falls back to `.runtime/backend/` at the workspace root.

| Purpose | Environment variable | Default |
| --- | --- | --- |
| Runtime root | `RUNTIME_DIR` | `.runtime/` |
| JSON data | `DATA_DIR` | `.runtime/backend/data/` |
| Backend logs | `LOG_DIR` | `.runtime/backend/logs/` |
| Copilot logs | `COPILOT_LOG_DIR` | `.runtime/backend/copilot-logs/` |

`DATA_DIR` stores local JSON state such as users, shared trips, memberships, workspace projections, event logs, and transaction markers.

## Generated Artifacts

Generated reports and test output go under `.artifacts/`.

| Purpose | Environment variable | Default |
| --- | --- | --- |
| Artifact root | `ARTIFACTS_DIR` | `.artifacts/` |
| Migration reports | `MIGRATION_REPORT_DIR` | `.artifacts/migration/` |
| Playwright output | configured in `frontend/playwright.config.ts` | `.artifacts/playwright/` |

These files can be deleted without changing source code. Delete `.runtime/` only when you intentionally want to reset local app state.

## Cleanup Commands

Use package scripts for routine cleanup once they are available:

```bash
npm run clean:artifacts
npm run clean:build
```

Runtime data cleanup should stay explicit because it can remove local users and trips.