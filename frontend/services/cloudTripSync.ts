import type { SharedTrip, Trip } from '../types';

export interface CloudTripSyncClient {
    getMySharedTripIds(): Promise<string[]>;
    getTrip(tripId: string): Promise<SharedTrip>;
}

export async function fetchMissingOwnedCloudTrips(input: {
    ownerEmail: string;
    localTrips: Trip[];
    client: CloudTripSyncClient;
}): Promise<Trip[]> {
    const serverTripIds = await input.client.getMySharedTripIds();
    if (serverTripIds.length === 0) return [];

    const missingTripIds = serverTripIds.filter(serverId =>
        !input.localTrips.some(trip => trip.id === serverId || trip.serverTripId === serverId)
    );

    const importedTrips: Trip[] = [];
    for (const tripId of missingTripIds) {
        try {
            const sharedTrip = await input.client.getTrip(tripId);
            if (sharedTrip.ownerId.toLowerCase() !== input.ownerEmail.toLowerCase()) continue;

            const tripData: Trip = {
                ...sharedTrip.tripData,
                serverTripId: sharedTrip.tripId,
                visibility: sharedTrip.visibility
            };

            if (!input.localTrips.some(trip => trip.id === tripData.id)) {
                importedTrips.push(tripData);
            }
        } catch (error) {
            console.error(`[TripManager] Failed to fetch shared trip ${tripId}`, error);
        }
    }

    return importedTrips;
}