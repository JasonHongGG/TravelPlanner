import fs from 'fs';
import path from 'path';
import { createJsonFileStore, resolveDataDir } from './jsonFileStore.js';
import { normalizeSharedTripDocument } from './tripShareDomain.js';
import type { SharedTrip } from './tripShareTypes.js';

export class TripDocumentRepository {
    private readonly sharedTripsDir: string;

    constructor(dataDir = resolveDataDir()) {
        this.sharedTripsDir = path.join(dataDir, 'shared_trips');
    }

    ensureDirectories(): void {
        fs.mkdirSync(this.sharedTripsDir, { recursive: true });
    }

    getSharedTrip(tripId: string): SharedTrip | null {
        const filePath = path.join(this.sharedTripsDir, `${tripId}.json`);
        const tripStore = createJsonFileStore<SharedTrip | null>({
            filePath,
            defaultValue: () => null,
            validate: (value) => value as SharedTrip,
            onReadError: (error) => console.error(`[TripDocumentRepository] Error reading shared trip ${tripId}:`, error)
        });
        const trip = tripStore.exists() ? tripStore.read() : null;
        return trip ? normalizeSharedTripDocument(trip) : null;
    }

    listSharedTrips(): SharedTrip[] {
        this.ensureDirectories();
        const trips: SharedTrip[] = [];
        for (const file of fs.readdirSync(this.sharedTripsDir)) {
            if (!file.endsWith('.json')) continue;
            const trip = this.getSharedTrip(file.replace(/\.json$/, ''));
            if (trip) trips.push(trip);
        }
        return trips;
    }

    writeSharedTrip(trip: SharedTrip): void {
        const document = normalizeSharedTripDocument({ ...trip });
        createJsonFileStore<SharedTrip>({
            filePath: path.join(this.sharedTripsDir, `${trip.tripId}.json`),
            defaultValue: () => document
        }).write(document);
    }

    deleteSharedTrip(tripId: string): void {
        const filePath = path.join(this.sharedTripsDir, `${tripId}.json`);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
}