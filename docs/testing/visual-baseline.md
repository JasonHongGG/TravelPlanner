# Visual Baseline

The current refactor is architecture-only. UI behavior can change when it fixes routing, state ownership, security, or persistence, but the rendered visual design must stay equivalent unless a later task explicitly changes the UI.

## Frozen Screens

- Landing and login entry.
- Dashboard trip list, empty/loading/error states, new trip modal, import actions.
- Trip detail view, tabs, assistant panel, map area, cover image controls, export/share controls.
- Attraction Explorer modal, tabs, sidebars, payment confirmation, loading and buffer states.
- Shared trip view, read-only mode, editable shared trip mode, connection status.
- Gallery page, cards, pagination, random trips.
- Purchase, transaction history, settings, feasibility, share, export, and status modals.

## Manual Baseline Pass

1. Start `dev: all` from VS Code or run each dev script listed in the README.
2. Visit `/`, `/login`, `/dashboard`, `/dashboard/gallery`, and at least one `/trip/:id` route.
3. Open every modal listed above and confirm spacing, icon placement, colors, and layout match the previous design.
4. Exercise one successful and one failed generation path, then reload during generation to verify the durable job surface.
5. Exercise share events with a private trip and confirm EventSource connects through a signed event token.

## Automated Checks

Run E2E smoke locally with:

```bash
npm run test:e2e
```

Create or refresh screenshot baselines with:

```bash
npm --prefix frontend run test:visual:update
```

After baselines are reviewed, run screenshot regression with:

```bash
npm run test:visual
```

## CI Gate

CI runs shared contract checks, backend/frontend typecheck/test/build, and Playwright E2E smoke. Screenshot regression has a separate command so baselines can be approved deliberately before it becomes a blocking gate.
