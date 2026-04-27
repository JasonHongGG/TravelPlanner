import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { TripShareEventBus } from './tripShareEvents.js';
import { TripShareRepository } from './tripShareRepository.js';
import { TripShareService } from './tripShareService.js';
import type { Trip } from './tripShareTypes.js';

let tempDir = '';
let repository: TripShareRepository;
let service: TripShareService;

function trip(title = 'Tokyo'): Trip {
    return {
        id: 'local-trip-1',
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

beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'trip-share-service-'));
    repository = new TripShareRepository(tempDir);
    service = new TripShareService(repository, new TripShareEventBus());
});

afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
});

describe('TripShareService', () => {
    it('creates a trip document through the explicit create command', () => {
        const created = service.createTripDocument({
            tripId: 'trip-create',
            ownerId: 'owner@example.com',
            ownerName: 'Owner',
            tripData: trip('Created'),
            visibility: 'public',
            reqUserEmail: 'owner@example.com'
        });

        assert.equal(created.revision, 1);
        assert.equal(created.tripData.serverTripId, 'trip-create');
        assert.equal(service.getTripMeta('trip-create')?.visibility, 'public');
        assert.deepEqual(repository.getTripEvents('trip-create').map(event => event.type), ['trip_created']);
    });

    it('does not let create command overwrite another owner document', () => {
        service.createTripDocument({
            tripId: 'trip-create-owned',
            ownerId: 'owner@example.com',
            ownerName: 'Owner',
            tripData: trip('Original'),
            visibility: 'private',
            reqUserEmail: 'owner@example.com'
        });

        assert.throws(() => service.createTripDocument({
            tripId: 'trip-create-owned',
            ownerId: 'other@example.com',
            ownerName: 'Other',
            tripData: trip('Other'),
            visibility: 'public',
            reqUserEmail: 'other@example.com'
        }), /already exists/);

        assert.equal(service.getSharedTrip('trip-create-owned')?.ownerId, 'owner@example.com');
        assert.equal(service.getSharedTrip('trip-create-owned')?.tripData.title, 'Original');
    });

    it('preserves owner metadata when a write collaborator updates content', () => {
        service.createTripDocument({
            tripId: 'trip-1',
            ownerId: 'owner@example.com',
            ownerName: 'Owner',
            tripData: trip('Original'),
            visibility: 'private',
            reqUserEmail: 'owner@example.com'
        });
        assert.equal(service.updateMemberPermission('trip-1', 'owner@example.com', 'collab@example.com', 'write')?.revision, 2);

        service.updateTripContent('trip-1', 'collab@example.com', trip('Updated'), 2);

        assert.equal(service.getSharedTrip('trip-1')?.ownerId, 'owner@example.com');
        assert.equal(service.getTripMeta('trip-1')?.ownerName, 'Owner');
        assert.equal(service.getSharedTrip('trip-1')?.tripData.title, 'Updated');
    });

    it('prevents a write collaborator from changing visibility', () => {
        service.createTripDocument({
            tripId: 'trip-visibility',
            ownerId: 'owner@example.com',
            ownerName: 'Owner',
            tripData: trip('Private'),
            visibility: 'private',
            reqUserEmail: 'owner@example.com'
        });
        assert.equal(service.updateMemberPermission('trip-visibility', 'owner@example.com', 'collab@example.com', 'write')?.revision, 2);

        assert.equal(service.updateVisibility('trip-visibility', 'collab@example.com', 'public'), false);

        assert.equal(service.getSharedTrip('trip-visibility')?.visibility, 'private');
        assert.deepEqual(service.getPublicTrips().trips, []);
    });

    it('rejects stale content updates with a revision conflict', () => {
        service.createTripDocument({
            tripId: 'trip-revision',
            ownerId: 'owner@example.com',
            ownerName: 'Owner',
            tripData: trip('Revision 1'),
            visibility: 'private',
            reqUserEmail: 'owner@example.com'
        });

        assert.throws(() => service.updateTripContent('trip-revision', 'owner@example.com', trip('Stale'), 99), /Revision conflict/);
        const updated = service.updateTripContent('trip-revision', 'owner@example.com', trip('Revision 2'), 1);
        assert.equal(updated.revision, 2);
        assert.equal(service.getSharedTrip('trip-revision')?.tripData.title, 'Revision 2');
        assert.deepEqual(repository.getTripEvents('trip-revision').map(event => event.type), ['trip_created', 'trip_updated']);
    });

    it('separates collaborator workspace removal from canonical deletion', () => {
        service.createTripDocument({
            tripId: 'trip-workspace',
            ownerId: 'owner@example.com',
            ownerName: 'Owner',
            tripData: trip('Workspace'),
            visibility: 'private',
            reqUserEmail: 'owner@example.com'
        });
        assert.equal(service.updateMemberPermission('trip-workspace', 'owner@example.com', 'collab@example.com', 'write')?.revision, 2);

        assert.deepEqual(service.getWorkspaceTrips('owner@example.com').map(item => item.tripId), ['trip-workspace']);
        assert.deepEqual(service.getWorkspaceTrips('collab@example.com').map(item => item.tripId), ['trip-workspace']);
        assert.equal(service.removeFromWorkspace('trip-workspace', 'collab@example.com'), 'success');
        assert.equal(service.getSharedTrip('trip-workspace')?.ownerId, 'owner@example.com');
        assert.deepEqual(service.getWorkspaceTrips('collab@example.com'), []);
        assert.deepEqual(service.getWorkspaceTrips('owner@example.com').map(item => item.tripId), ['trip-workspace']);
    });

    it('keeps gallery indexes aligned when visibility changes and trips are deleted', () => {
        service.createTripDocument({
            tripId: 'trip-2',
            ownerId: 'owner@example.com',
            ownerName: 'Owner',
            tripData: trip('Public'),
            visibility: 'public',
            reqUserEmail: 'owner@example.com'
        });
        assert.deepEqual(service.getPublicTrips().trips.map(item => item.tripId), ['trip-2']);

        assert.equal(service.updateVisibility('trip-2', 'owner@example.com', 'private'), true);
        assert.deepEqual(service.getPublicTrips().trips, []);

        assert.equal(service.deleteTrip('trip-2', 'owner@example.com'), 'success');
        assert.equal(service.getSharedTrip('trip-2'), null);
        assert.equal(repository.getTripEvents('trip-2').at(-1)?.type, 'trip_deleted');
    });

    it('does not place public gallery trips into unrelated user workspaces', () => {
        service.createTripDocument({
            tripId: 'trip-public-workspace',
            ownerId: 'owner@example.com',
            ownerName: 'Owner',
            tripData: trip('Public'),
            visibility: 'public',
            reqUserEmail: 'owner@example.com'
        });

        assert.deepEqual(service.getWorkspaceTrips('reader@example.com'), []);
        assert.deepEqual(service.getWorkspaceTrips('owner@example.com').map(item => item.tripId), ['trip-public-workspace']);
    });

    it('rebuilds the gallery index from trip metadata as a derived cache', () => {
        service.createTripDocument({
            tripId: 'trip-index',
            ownerId: 'owner@example.com',
            ownerName: 'Owner',
            tripData: trip('Public'),
            visibility: 'public',
            reqUserEmail: 'owner@example.com'
        });

        repository.writeIndex({ publicTrips: [], sharedPrivateTrips: [] });
        assert.deepEqual(repository.rebuildIndexFromMetas().publicTrips, ['trip-index']);
        assert.deepEqual(service.getPublicTrips().trips.map(item => item.tripId), ['trip-index']);
    });

    it('debounces repeat view engagements from the same IP', () => {
        service.createTripDocument({
            tripId: 'trip-3',
            ownerId: 'owner@example.com',
            ownerName: 'Owner',
            tripData: trip('Public'),
            visibility: 'public',
            reqUserEmail: 'owner@example.com'
        });

        service.getTrip('trip-3', undefined, '127.0.0.1');
        service.getTrip('trip-3', undefined, '127.0.0.1');

        assert.equal(service.getTripMeta('trip-3')?.viewCount, 1);
    });

    it('stores membership as a separate aggregate and derives permissions for API responses', () => {
        service.createTripDocument({
            tripId: 'trip-membership',
            ownerId: 'owner@example.com',
            ownerName: 'Owner',
            tripData: trip('Membership'),
            visibility: 'private',
            reqUserEmail: 'owner@example.com'
        });

        service.updateMemberPermission('trip-membership', 'owner@example.com', 'viewer@example.com', 'read');
        const document = repository.getSharedTrip('trip-membership');

        assert.equal(document?.permissions?.['viewer@example.com'], 'read');
        assert.equal(document?.memberships.find(member => member.userId === 'viewer@example.com')?.role, 'viewer');
    });
});