import fs from 'fs';
import path from 'path';
import { createJsonFileStore, type JsonFileStore, resolveDataDir } from '../../../../platform/persistence/jsonFileStore.js';
import { removeTripFromIndexList, selectIndexList } from '../../domain/tripShareDomain.js';
import type { SharedTripMeta, TripIndex, TripVisibility } from '../../domain/tripShareTypes.js';

function validateTripIndex(value: unknown): TripIndex {
    const parsed = value as Partial<TripIndex>;
    return {
        publicTrips: Array.isArray(parsed.publicTrips) ? parsed.publicTrips.filter((id): id is string => typeof id === 'string') : [],
        sharedPrivateTrips: Array.isArray(parsed.sharedPrivateTrips) ? parsed.sharedPrivateTrips.filter((id): id is string => typeof id === 'string') : []
    };
}

export class TripMetaRepository {
    private readonly tripMetaDir: string;
    private readonly indexStore: JsonFileStore<TripIndex>;

    constructor(dataDir = resolveDataDir()) {
        this.tripMetaDir = path.join(dataDir, 'trip_meta');
        this.indexStore = createJsonFileStore<TripIndex>({
            filePath: path.join(dataDir, 'trip_index.json'),
            defaultValue: () => ({ publicTrips: [], sharedPrivateTrips: [] }),
            validate: validateTripIndex,
            onReadError: (error) => console.error('[TripMetaRepository] Error reading trip index:', error)
        });
    }

    ensureDirectories(): void {
        fs.mkdirSync(this.tripMetaDir, { recursive: true });
    }

    readIndex(): TripIndex {
        return this.indexStore.read();
    }

    writeIndex(index: TripIndex): void {
        this.indexStore.write(index);
    }

    upsertTripInIndex(tripId: string, visibility: TripVisibility): void {
        const index = this.readIndex();
        index.publicTrips = removeTripFromIndexList(index.publicTrips, tripId);
        index.sharedPrivateTrips = removeTripFromIndexList(index.sharedPrivateTrips, tripId);
        index[selectIndexList(visibility)].push(tripId);
        this.writeIndex(index);
    }

    removeTripFromIndex(tripId: string): void {
        const index = this.readIndex();
        index.publicTrips = removeTripFromIndexList(index.publicTrips, tripId);
        index.sharedPrivateTrips = removeTripFromIndexList(index.sharedPrivateTrips, tripId);
        this.writeIndex(index);
    }

    getTripMeta(tripId: string): SharedTripMeta | null {
        const filePath = path.join(this.tripMetaDir, `${tripId}.json`);
        const metaStore = createJsonFileStore<SharedTripMeta | null>({
            filePath,
            defaultValue: () => null,
            validate: (value) => value as SharedTripMeta,
            onReadError: (error) => console.error(`[TripMetaRepository] Error reading trip meta ${tripId}:`, error)
        });
        return metaStore.exists() ? metaStore.read() : null;
    }

    writeTripMeta(meta: SharedTripMeta): void {
        createJsonFileStore<SharedTripMeta>({
            filePath: path.join(this.tripMetaDir, `${meta.tripId}.json`),
            defaultValue: () => meta
        }).write(meta);
    }

    deleteTripMeta(tripId: string): void {
        const filePath = path.join(this.tripMetaDir, `${tripId}.json`);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    listTripMetas(): SharedTripMeta[] {
        this.ensureDirectories();
        const metas: SharedTripMeta[] = [];
        for (const file of fs.readdirSync(this.tripMetaDir)) {
            if (!file.endsWith('.json')) continue;
            const tripId = file.replace(/\.json$/, '');
            const meta = this.getTripMeta(tripId);
            if (meta) metas.push(meta);
        }
        return metas;
    }

    getUserTrips(ownerId: string): SharedTripMeta[] {
        return this.listTripMetas()
            .filter(meta => meta.ownerId.toLowerCase() === ownerId.toLowerCase())
            .sort((a, b) => b.lastModified - a.lastModified);
    }

    rebuildIndexFromMetas(): TripIndex {
        const index: TripIndex = { publicTrips: [], sharedPrivateTrips: [] };
        if (!fs.existsSync(this.tripMetaDir)) {
            this.writeIndex(index);
            return index;
        }
        for (const meta of this.listTripMetas()) {
            index[selectIndexList(meta.visibility)].push(meta.tripId);
        }
        this.writeIndex(index);
        return index;
    }

    getPublicTripMetas(): SharedTripMeta[] {
        const index = this.readIndex();
        const publicIds = index.publicTrips.length > 0 ? index.publicTrips : this.rebuildIndexFromMetas().publicTrips;
        return publicIds
            .map(tripId => this.getTripMeta(tripId))
            .filter((meta): meta is SharedTripMeta => Boolean(meta));
    }
}