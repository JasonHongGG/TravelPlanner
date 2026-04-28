import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fetchMissingOwnedCloudTrips } from './cloudTripSync';
import type { SharedTrip, Trip } from '../types';

function trip(id: string, ownerId = 'owner@example.com'): SharedTrip {
    return {
        tripId: id,
        ownerId,
        visibility: 'private',
        permissions: {},
        createdAt: 1,
        lastModified: 1,
        tripData: {
            id: `local-${id}`,
            title: id,
            createdAt: 1,
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
            }
        }
    };
}

describe('fetchMissingOwnedCloudTrips', () => {
    it('imports only missing trips owned by the current user', async () => {
        const localTrips = [{ id: 'existing', serverTripId: 'trip-1' } as Trip];
        const imported = await fetchMissingOwnedCloudTrips({
            ownerEmail: 'owner@example.com',
            localTrips,
            client: {
                async getMySharedTripIds() {
                    return ['trip-1', 'trip-2', 'trip-3'];
                },
                async getTrip(tripId: string) {
                    return tripId === 'trip-3' ? trip(tripId, 'other@example.com') : trip(tripId);
                }
            }
        });

        assert.deepEqual(imported.map(item => item.serverTripId), ['trip-2']);
    });

    it('imports shared workspace trips with collaboration metadata', async () => {
        const imported = await fetchMissingOwnedCloudTrips({
            ownerEmail: 'collab@example.com',
            localTrips: [],
            client: {
                async getMySharedTripIds() {
                    return [];
                },
                async getWorkspaceTrips() {
                    return [{
                        tripId: 'trip-shared',
                        ownerId: 'owner@example.com',
                        ownerName: 'Owner',
                        visibility: 'private',
                        title: 'Shared',
                        destination: 'Tokyo',
                        dateRange: '2026-05-01 to 2026-05-02',
                        days: 2,
                        createdAt: 1,
                        lastModified: 2,
                        viewCount: 0,
                        likeCount: 0,
                        recentEngagements: [],
                        source: 'shared',
                        role: 'editor',
                        revision: 3
                    }];
                },
                async getTrip() {
                    return {
                        ...trip('trip-shared', 'owner@example.com'),
                        userPermission: 'write',
                        revision: 3
                    };
                }
            }
        });

        assert.equal(imported.length, 1);
        assert.equal(imported[0].ownerId, 'owner@example.com');
        assert.equal(imported[0].workspaceSource, 'shared');
        assert.equal(imported[0].userPermission, 'write');
        assert.equal(imported[0].revision, 3);
    });
});