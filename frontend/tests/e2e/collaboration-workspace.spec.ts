import { expect, test, type Page } from '@playwright/test';
import { mockBackend } from '../support/backendMocks';

const owner = 'owner@example.com';
const collaborator = 'collaborator@example.com';

function trip(title: string) {
  return {
    id: 'local-ab-trip',
    title,
    createdAt: Date.now(),
    status: 'complete',
    input: {
      dateRange: '2026-05-01 to 2026-05-02',
      destination: 'Tokyo',
      travelers: '2',
      interests: 'food',
      budget: 'medium',
      transport: 'train',
      accommodation: 'hotel',
      pace: 'balanced',
      mustVisit: '',
      language: 'en',
      constraints: ''
    },
    data: {
      tripMeta: { days: 2 },
      days: [],
      totals: {}
    }
  };
}

async function api(page: Page, actor: string, path: string, init: { method?: string; body?: unknown } = {}) {
  return await page.evaluate(async ({ actor, path, init }) => {
    const response = await fetch(`http://localhost:3001${path}`, {
      method: init.method || 'GET',
      headers: {
        Authorization: `Bearer ${actor}`,
        'Content-Type': 'application/json'
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body)
    });
    return { status: response.status, body: await response.json() };
  }, { actor, path, init });
}

test('collaborator edits and removes a shared trip without taking it from the owner workspace', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');

  const created = await api(page, owner, '/api/trips', {
    method: 'POST',
    body: { tripId: 'shared-ab-trip', tripData: trip('Owner Plan'), visibility: 'private' }
  });
  expect(created.status).toBe(201);
  expect(created.body.revision).toBe(1);

  const member = await api(page, owner, '/api/trips/shared-ab-trip/members', {
    method: 'POST',
    body: { email: collaborator, permission: 'write' }
  });
  expect(member.status).toBe(200);

  const collaboratorWorkspace = await api(page, collaborator, '/api/workspace/trips');
  expect(collaboratorWorkspace.status).toBe(200);
  expect(collaboratorWorkspace.body.trips).toEqual(expect.arrayContaining([
    expect.objectContaining({ tripId: 'shared-ab-trip', source: 'shared', role: 'editor' })
  ]));

  const update = await api(page, collaborator, '/api/trips/shared-ab-trip/content', {
    method: 'PATCH',
    body: { tripData: trip('Collaborator Edit'), expectedRevision: 2 }
  });
  expect(update.status).toBe(200);
  expect(update.body.revision).toBe(3);

  const removed = await api(page, collaborator, '/api/workspace/trips/shared-ab-trip', { method: 'DELETE' });
  expect(removed.status).toBe(200);

  const collaboratorAfterRemove = await api(page, collaborator, '/api/workspace/trips');
  expect(collaboratorAfterRemove.body.trips).toEqual([]);

  const ownerWorkspace = await api(page, owner, '/api/workspace/trips');
  expect(ownerWorkspace.body.trips).toEqual(expect.arrayContaining([
    expect.objectContaining({ tripId: 'shared-ab-trip', source: 'owned', role: 'owner', title: 'Collaborator Edit' })
  ]));

  const ownerTrip = await api(page, owner, '/api/trips/shared-ab-trip');
  expect(ownerTrip.status).toBe(200);
  expect(ownerTrip.body.ownerId).toBe(owner);
  expect(ownerTrip.body.tripData.title).toBe('Collaborator Edit');
});