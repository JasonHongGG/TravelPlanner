import type { Page, Route } from '@playwright/test';

const pointPackages = [
  { id: 'pkg_100', points: 100, price: 30, type: 'points', name: '100 points', description: 'Small starter package' },
  { id: 'pkg_500', points: 500, price: 130, type: 'points', name: '500 points', description: 'Popular package', popular: true },
  { id: 'plan_unlimited', points: 0, price: 399, type: 'subscription', name: 'Unlimited', description: 'Membership plan' }
];

const pointConfig = {
  TRIP_BASE_COST: 50,
  TRIP_DAILY_COST: 10,
  NEW_USER_BONUS: 500,
  ATTRACTION_SEARCH_COST: 10,
  RECOMMENDATION_COUNT: 12,
  GALLERY_PAGE_SIZE_DEFAULT: 12,
  GALLERY_PAGE_SIZE_MAX: 24,
  GALLERY_PAGE_MAX: 1000,
  RANDOM_TRIPS_DEFAULT: 6,
  RANDOM_TRIPS_MAX: 12
};

type MockPermission = 'read' | 'write';

type MockTrip = {
  tripId: string;
  ownerId: string;
  visibility: 'private' | 'public';
  permissions: Record<string, MockPermission>;
  revision: number;
  createdAt: number;
  lastModified: number;
  tripData: any;
};

export type MockCollaborationState = {
  trips: Map<string, MockTrip>;
  removedTripsByUser: Map<string, Set<string>>;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Correlation-ID',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
};

function createMockCollaborationState(): MockCollaborationState {
  return { trips: new Map(), removedTripsByUser: new Map() };
}

function actorFromRoute(route: Route): string {
  const authorization = route.request().headers().authorization || '';
  return authorization.replace(/^Bearer\s+/i, '').trim().toLowerCase() || 'anonymous@example.com';
}

async function requestBody(route: Route): Promise<any> {
  const rawBody = route.request().postData();
  return rawBody ? JSON.parse(rawBody) : {};
}

async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify(body)
  });
}

function permissionFor(trip: MockTrip, actor: string): MockPermission | undefined {
  if (trip.ownerId === actor) return 'write';
  if (trip.permissions[actor]) return trip.permissions[actor];
  if (trip.visibility === 'public') return 'read';
  return undefined;
}

function roleFor(trip: MockTrip, actor: string): 'owner' | 'editor' | 'viewer' | undefined {
  if (trip.ownerId === actor) return 'owner';
  const permission = trip.permissions[actor];
  if (permission === 'write') return 'editor';
  if (permission === 'read') return 'viewer';
  return undefined;
}

function workspaceSummary(trip: MockTrip, actor: string) {
  return {
    tripId: trip.tripId,
    ownerId: trip.ownerId,
    ownerName: trip.ownerId,
    visibility: trip.visibility,
    title: trip.tripData.title,
    destination: trip.tripData.input?.destination || '',
    dateRange: trip.tripData.input?.dateRange || '',
    days: trip.tripData.data?.tripMeta?.days || 0,
    createdAt: trip.createdAt,
    lastModified: trip.lastModified,
    viewCount: 0,
    likeCount: 0,
    recentEngagements: [],
    language: trip.tripData.input?.language,
    source: trip.ownerId === actor ? 'owned' : 'shared',
    role: roleFor(trip, actor),
    revision: trip.revision
  };
}

export async function mockBackend(page: Page, state: MockCollaborationState = createMockCollaborationState()): Promise<MockCollaborationState> {
  await page.route('http://localhost:3001/**', async route => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const url = new URL(route.request().url());
    let body: unknown = {};

    if (url.pathname === '/packages') body = pointPackages;
    if (url.pathname === '/config') body = pointConfig;

    if (url.pathname === '/api/trips' && route.request().method() === 'POST') {
      const actor = actorFromRoute(route);
      const request = await requestBody(route);
      const tripId = request.tripId || request.tripData?.serverTripId || request.tripData?.id;
      const now = Date.now();
      if (!tripId || !request.tripData) {
        await fulfillJson(route, 400, { error: 'tripId and tripData are required' });
        return;
      }

      if (state.trips.has(tripId)) {
        await fulfillJson(route, 409, { error: 'Trip already exists' });
        return;
      }

      const trip: MockTrip = {
        tripId,
        ownerId: actor,
        visibility: request.visibility || 'private',
        permissions: {},
        revision: 1,
        createdAt: now,
        lastModified: now,
        tripData: { ...request.tripData, ownerId: actor, serverTripId: tripId, visibility: request.visibility || 'private', revision: 1 }
      };
      state.trips.set(tripId, trip);
      await fulfillJson(route, 201, { tripId, revision: 1, lastModified: now });
      return;
    }

    if (url.pathname === '/api/workspace/trips' && route.request().method() === 'GET') {
      const actor = actorFromRoute(route);
      const removed = state.removedTripsByUser.get(actor) || new Set<string>();
      const trips = [...state.trips.values()]
        .filter(trip => !removed.has(trip.tripId) && Boolean(roleFor(trip, actor)))
        .map(trip => workspaceSummary(trip, actor));
      await fulfillJson(route, 200, { trips, tripIds: trips.map(trip => trip.tripId) });
      return;
    }

    const memberMatch = url.pathname.match(/^\/api\/trips\/([^/]+)\/members$/);
    if (memberMatch && route.request().method() === 'POST') {
      const actor = actorFromRoute(route);
      const request = await requestBody(route);
      const trip = state.trips.get(memberMatch[1]);
      if (!trip || trip.ownerId !== actor) {
        await fulfillJson(route, 403, { error: 'Trip not found or not authorized' });
        return;
      }
      trip.permissions[String(request.email).toLowerCase()] = request.permission;
      trip.revision += 1;
      trip.lastModified = Date.now();
      await fulfillJson(route, 200, { tripId: trip.tripId, memberEmail: String(request.email).toLowerCase(), permission: request.permission, revision: trip.revision });
      return;
    }

    const contentMatch = url.pathname.match(/^\/api\/trips\/([^/]+)\/content$/);
    if (contentMatch && route.request().method() === 'PATCH') {
      const actor = actorFromRoute(route);
      const request = await requestBody(route);
      const trip = state.trips.get(contentMatch[1]);
      if (!trip || permissionFor(trip, actor) !== 'write') {
        await fulfillJson(route, 403, { error: 'Access denied' });
        return;
      }
      if (typeof request.expectedRevision === 'number' && request.expectedRevision !== trip.revision) {
        await fulfillJson(route, 409, { error: 'Revision conflict', code: 'REVISION_CONFLICT' });
        return;
      }
      trip.revision += 1;
      trip.lastModified = Date.now();
      trip.tripData = { ...request.tripData, ownerId: trip.ownerId, serverTripId: trip.tripId, visibility: trip.visibility, revision: trip.revision };
      await fulfillJson(route, 200, { tripId: trip.tripId, revision: trip.revision, lastModified: trip.lastModified });
      return;
    }

    const workspaceRemoveMatch = url.pathname.match(/^\/api\/workspace\/trips\/([^/]+)$/);
    if (workspaceRemoveMatch && route.request().method() === 'DELETE') {
      const actor = actorFromRoute(route);
      const trip = state.trips.get(workspaceRemoveMatch[1]);
      if (!trip) {
        await fulfillJson(route, 404, { error: 'Trip not found' });
        return;
      }
      if (trip.ownerId === actor) {
        await fulfillJson(route, 409, { error: 'Owners must delete the canonical trip instead of removing it from workspace.' });
        return;
      }
      if (!permissionFor(trip, actor)) {
        await fulfillJson(route, 403, { error: 'Trip not found or access denied' });
        return;
      }
      if (!state.removedTripsByUser.has(actor)) state.removedTripsByUser.set(actor, new Set());
      state.removedTripsByUser.get(actor)?.add(trip.tripId);
      await fulfillJson(route, 200, { message: 'Trip removed from workspace' });
      return;
    }

    const tripMatch = url.pathname.match(/^\/api\/trips\/([^/]+)$/);
    if (tripMatch && route.request().method() === 'GET') {
      const actor = actorFromRoute(route);
      const trip = state.trips.get(tripMatch[1]);
      const permission = trip ? permissionFor(trip, actor) : undefined;
      if (!trip || !permission) {
        await fulfillJson(route, 404, { error: 'Trip not found or access denied' });
        return;
      }
      await fulfillJson(route, 200, { ...trip, memberships: Object.entries(trip.permissions).map(([userId, memberPermission]) => ({
        schemaVersion: 1,
        tripId: trip.tripId,
        userId,
        role: memberPermission === 'write' ? 'editor' : 'viewer',
        status: 'active',
        createdAt: trip.createdAt,
        updatedAt: trip.lastModified
      })), userPermission: permission });
      return;
    }

    await fulfillJson(route, 200, body);
  });

  return state;
}