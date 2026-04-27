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
});