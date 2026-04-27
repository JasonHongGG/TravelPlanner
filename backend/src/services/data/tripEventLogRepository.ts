import fs from 'fs';
import path from 'path';
import { resolveDataDir } from './jsonFileStore.js';
import type { TripEventLogEntry } from './tripShareTypes.js';

export class TripEventLogRepository {
    private readonly eventLogDir: string;

    constructor(dataDir = resolveDataDir()) {
        this.eventLogDir = path.join(dataDir, 'trip_events');
    }

    ensureDirectories(): void {
        fs.mkdirSync(this.eventLogDir, { recursive: true });
    }

    appendTripEvent(event: TripEventLogEntry): void {
        this.ensureDirectories();
        const filePath = path.join(this.eventLogDir, `${event.tripId}.jsonl`);
        fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, 'utf-8');
    }

    getTripEvents(tripId: string): TripEventLogEntry[] {
        const filePath = path.join(this.eventLogDir, `${tripId}.jsonl`);
        if (!fs.existsSync(filePath)) return [];
        return fs.readFileSync(filePath, 'utf-8')
            .split('\n')
            .filter(Boolean)
            .map(line => JSON.parse(line) as TripEventLogEntry);
    }

    deleteTripEvents(tripId: string): void {
        const filePath = path.join(this.eventLogDir, `${tripId}.jsonl`);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
}