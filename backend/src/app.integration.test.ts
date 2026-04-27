import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const previousEnv = {
    DATA_DIR: process.env.DATA_DIR,
    NODE_ENV: process.env.NODE_ENV,
    TEST_AUTH_USER_JSON: process.env.TEST_AUTH_USER_JSON
};

let tempDir = '';
let baseUrl = '';
let server: Server;

function restoreEnv(name: keyof NodeJS.ProcessEnv, value: string | undefined): void {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}

function setAuthUser(email: string, name = email): void {
    process.env.TEST_AUTH_USER_JSON = JSON.stringify({ email, name });
}

function testTrip(title: string) {
    return {
        id: 'local-api-trip',
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

async function requestJson(pathname: string, init: RequestInit = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
        ...init,
        headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
            ...init.headers
        }
    });
    const body = await response.json();
    return { response, body };
}

before(async () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'travel-app-integration-'));
    process.env.DATA_DIR = tempDir;
    process.env.NODE_ENV = 'test';
    setAuthUser('owner@example.com', 'Owner');

    const { createMainApp } = await import('./app.js');
    const app = createMainApp();
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    await new Promise<void>(resolve => server.close(resolve));
    rmSync(tempDir, { recursive: true, force: true });
    restoreEnv('DATA_DIR', previousEnv.DATA_DIR);
    restoreEnv('NODE_ENV', previousEnv.NODE_ENV);
    restoreEnv('TEST_AUTH_USER_JSON', previousEnv.TEST_AUTH_USER_JSON);
});

describe('main app trip sharing API', () => {
    it('creates trip documents through the command route', async () => {
        setAuthUser('owner@example.com', 'Owner');
        const result = await requestJson('/api/trips', {
            method: 'POST',
            body: JSON.stringify({ tripId: 'trip-api-create', tripData: testTrip('Created'), visibility: 'public' })
        });

        assert.equal(result.response.status, 201);
        assert.equal(result.body.tripId, 'trip-api-create');
        assert.equal(result.body.revision, 1);

        const fetched = await requestJson('/api/trips/trip-api-create');
        assert.equal(fetched.response.status, 200);
        assert.equal(fetched.body.ownerId, 'owner@example.com');
        assert.equal(fetched.body.visibility, 'public');
    });

    it('keeps the original owner when a write collaborator updates through command routes', async () => {
        let result = await requestJson('/api/trips', {
            method: 'POST',
            body: JSON.stringify({ tripId: 'trip-api-1', tripData: testTrip('Original'), visibility: 'private' })
        });
        assert.equal(result.response.status, 201);
        const tripId = result.body.tripId;

        result = await requestJson(`/api/trips/${tripId}/members`, {
            method: 'POST',
            body: JSON.stringify({ email: 'collab@example.com', permission: 'write' })
        });
        assert.equal(result.response.status, 200);

        setAuthUser('collab@example.com', 'Collaborator');
        result = await requestJson(`/api/trips/${tripId}/content`, {
            method: 'PATCH',
            body: JSON.stringify({ tripData: testTrip('Updated'), expectedRevision: 2 })
        });
        assert.equal(result.response.status, 200);

        result = await requestJson(`/api/trips/${tripId}`);
        assert.equal(result.response.status, 200);
        assert.equal(result.body.ownerId, 'owner@example.com');
        assert.equal(result.body.tripData.title, 'Updated');
        assert.equal(result.body.userPermission, 'write');
    });

    it('blocks collaborator visibility changes and separates workspace removal from canonical delete', async () => {
        setAuthUser('owner@example.com', 'Owner');
        let result = await requestJson('/api/trips', {
            method: 'POST',
            body: JSON.stringify({ tripId: 'trip-api-2', tripData: testTrip('Original'), visibility: 'private' })
        });
        assert.equal(result.response.status, 201);

        const legacyResponse = await fetch(`${baseUrl}/api/trips/trip-api-2`, {
            method: 'PUT',
            headers: {
                Authorization: 'Bearer test-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tripData: testTrip('Original'), visibility: 'private' })
        });
        assert.equal(legacyResponse.status, 404);

        result = await requestJson('/api/trips/trip-api-2/members', {
            method: 'POST',
            body: JSON.stringify({ email: 'collab2@example.com', permission: 'write' })
        });
        assert.equal(result.response.status, 200);

        setAuthUser('collab2@example.com', 'Collaborator 2');
        result = await requestJson('/api/trips/trip-api-2/content', {
            method: 'PATCH',
            body: JSON.stringify({ tripData: testTrip('Collaborator Update'), expectedRevision: 2 })
        });
        assert.equal(result.response.status, 200);

        result = await requestJson('/api/trips/trip-api-2');
        assert.equal(result.response.status, 200);
        assert.equal(result.body.ownerId, 'owner@example.com');
        assert.equal(result.body.visibility, 'private');

        result = await requestJson('/api/trips/trip-api-2/visibility', {
            method: 'PATCH',
            body: JSON.stringify({ visibility: 'public' })
        });
        assert.equal(result.response.status, 403);

        result = await requestJson('/api/workspace/trips', { method: 'GET' });
        assert.equal(result.response.status, 200);
        assert.deepEqual(result.body.trips.map((item: { tripId: string }) => item.tripId), ['trip-api-2']);

        result = await requestJson('/api/workspace/trips/trip-api-2', { method: 'DELETE' });
        assert.equal(result.response.status, 200);

        result = await requestJson('/api/workspace/trips', { method: 'GET' });
        assert.equal(result.response.status, 200);
        assert.deepEqual(result.body.trips, []);

        setAuthUser('owner@example.com', 'Owner');
        result = await requestJson('/api/trips/trip-api-2');
        assert.equal(result.response.status, 200);
        assert.equal(result.body.ownerId, 'owner@example.com');
    });

    it('returns 409 when updating trip content from a stale revision', async () => {
        setAuthUser('owner@example.com', 'Owner');
        let result = await requestJson('/api/trips', {
            method: 'POST',
            body: JSON.stringify({ tripId: 'trip-api-3', tripData: testTrip('Original'), visibility: 'private' })
        });
        assert.equal(result.response.status, 201);
        const tripId = result.body.tripId;

        result = await requestJson(`/api/trips/${tripId}/content`, {
            method: 'PATCH',
            body: JSON.stringify({ tripData: testTrip('Stale'), expectedRevision: 99 })
        });
        assert.equal(result.response.status, 409);

        result = await requestJson(`/api/trips/${tripId}/content`, {
            method: 'PATCH',
            body: JSON.stringify({ tripData: testTrip('Fresh'), expectedRevision: 1 })
        });
        assert.equal(result.response.status, 200);
        assert.equal(result.body.revision, 2);
    });
});