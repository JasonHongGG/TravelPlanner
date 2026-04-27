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
    it('keeps the original owner when a write collaborator updates through HTTP routes', async () => {
        let result = await requestJson('/api/trips/trip-api-1', {
            method: 'PUT',
            body: JSON.stringify({ tripData: testTrip('Original'), visibility: 'private' })
        });
        assert.equal(result.response.status, 200);

        result = await requestJson('/api/trips/trip-api-1/permissions', {
            method: 'PATCH',
            body: JSON.stringify({ permissions: { 'collab@example.com': 'write' } })
        });
        assert.equal(result.response.status, 200);

        setAuthUser('collab@example.com', 'Collaborator');
        result = await requestJson('/api/trips/trip-api-1', {
            method: 'PUT',
            body: JSON.stringify({ tripData: testTrip('Updated'), visibility: 'private' })
        });
        assert.equal(result.response.status, 200);

        result = await requestJson('/api/trips/trip-api-1');
        assert.equal(result.response.status, 200);
        assert.equal(result.body.ownerId, 'owner@example.com');
        assert.equal(result.body.tripData.title, 'Updated');
        assert.equal(result.body.userPermission, 'write');
    });
});