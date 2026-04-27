import type { SharedTrip, Trip, WorkspaceTripSummary } from '../types';

export interface CloudTripSyncClient {
    getMySharedTripIds(): Promise<string[]>;
    getTrip(tripId: string): Promise<SharedTrip>;
    getWorkspaceTrips?(): Promise<WorkspaceTripSummary[]>;
}

export async function fetchMissingOwnedCloudTrips(input: {
    ownerEmail: string;
    localTrips: Trip[];
    client: CloudTripSyncClient;
}): Promise<Trip[]> {
    const workspaceTrips = input.client.getWorkspaceTrips ? await input.client.getWorkspaceTrips() : [];
    const serverTripIds = workspaceTrips.length > 0
        ? workspaceTrips.map(trip => trip.tripId)
        : await input.client.getMySharedTripIds();
    if (serverTripIds.length === 0) return [];

    const workspaceByTripId = new Map(workspaceTrips.map(trip => [trip.tripId, trip]));

    const missingTripIds = serverTripIds.filter(serverId =>
        !input.localTrips.some(trip => trip.id === serverId || trip.serverTripId === serverId)
    );

    const importedTrips: Trip[] = [];
    for (const tripId of missingTripIds) {
        try {
            const sharedTrip = await input.client.getTrip(tripId);
            const workspaceTrip = workspaceByTripId.get(tripId);
            if (!workspaceTrip && sharedTrip.ownerId.toLowerCase() !== input.ownerEmail.toLowerCase()) continue;

            const tripData: Trip = {
                ...sharedTrip.tripData,
                ownerId: sharedTrip.ownerId,
                serverTripId: sharedTrip.tripId,
                visibility: sharedTrip.visibility,
                userPermission: sharedTrip.userPermission,
                workspaceSource: workspaceTrip?.source || 'owned',
                revision: sharedTrip.revision || workspaceTrip?.revision
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