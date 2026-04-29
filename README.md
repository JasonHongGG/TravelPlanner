## Run Locally

**Prerequisites:** Node.js

This repository is organized as a small workspace with clear runtime boundaries:

- `frontend/` - Vite React client.
- `backend/` - Express API, DB helper server, and Copilot helper server.
- `shared/` - shared TypeScript types, API contracts, and cross-runtime helpers.
- `.runtime/` - local runtime data and logs, ignored by git.
- `.artifacts/` - generated reports and test output, ignored by git.

See [docs/architecture/project-structure.md](docs/architecture/project-structure.md) and [docs/operations/runtime-artifacts.md](docs/operations/runtime-artifacts.md) for the folder rules.

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

### AI Providers

Backend AI provider selection and model names live in `backend/.env`, not in source edits. Set `AI_PROVIDER` to one of these values:

| Provider | `AI_PROVIDER` | Main env group |
| --- | --- | --- |
| GitHub Copilot helper server | `copilot` | `COPILOT_*`, `GITHUB_TOKEN` |
| Google AI Studio Gemini API | `gemini` | `GEMINI_*` |
| Google Cloud Vertex AI Gemini | `vertex` | `GOOGLE_CLOUD_*`, `VERTEX_*` |
| Ollama chat API | `ollama` | `OLLAMA_*` |
| Custom local API | `local_api` | `LOCAL_API_*` |

Each provider supports a shared model variable plus per-use-case overrides:

```env
AI_PROVIDER=vertex
VERTEX_MODEL=gemini-2.5-flash
VERTEX_TRIP_GENERATOR_MODEL=
VERTEX_TRIP_UPDATER_MODEL=
VERTEX_RECOMMENDER_MODEL=
```

When a per-use-case variable is blank, the provider uses its shared model variable, then falls back to the documented default in `backend/.env.example`.

#### Vertex AI

The Vertex provider uses the existing `@google/genai` dependency in Vertex mode and expects Application Default Credentials or a service account supplied by the runtime environment.

Local setup:

```bash
gcloud services enable aiplatform.googleapis.com
gcloud auth application-default login
```

Required backend variables:

```env
AI_PROVIDER=vertex
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_MODEL=gemini-2.5-flash
```

Optional per-use-case model overrides:

```env
VERTEX_TRIP_GENERATOR_MODEL=gemini-2.5-flash
VERTEX_TRIP_UPDATER_MODEL=gemini-2.5-flash
VERTEX_RECOMMENDER_MODEL=gemini-2.5-flash
VERTEX_TEMPERATURE=0.2
VERTEX_MAX_OUTPUT_TOKENS=4096
```

The authenticated user or service account needs permission to call Vertex AI, such as `roles/aiplatform.user`. For containers running outside Google Cloud, mount a service account key at runtime and set `GOOGLE_APPLICATION_CREDENTIALS` to the in-container path; never bake the key into an image or commit it.

After ADC or `GOOGLE_APPLICATION_CREDENTIALS` is configured, run a small live Vertex check from the backend package:

```bash
npm --prefix backend run smoke:vertex
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

Collaboration data migration and local cleanup rules are documented in [docs/migration/collaboration-data.md](docs/migration/collaboration-data.md).

Architecture refactors must keep the existing visual design stable. See [docs/testing/visual-baseline.md](docs/testing/visual-baseline.md) before changing UI structure, spacing, or visual hierarchy.
