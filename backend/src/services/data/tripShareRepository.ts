import fs from 'fs';
import path from 'path';
import { resolveDataDir } from './jsonFileStore.js';
import { normalizeUserId, permissionToWorkspaceRole, permissionsFromMemberships } from './tripShareDomain.js';
import { TripDocumentRepository } from './tripDocumentRepository.js';
import { TripEventLogRepository } from './tripEventLogRepository.js';
import { TripMembershipRepository } from './tripMembershipRepository.js';
import { TripMetaRepository } from './tripMetaRepository.js';
import { TripWorkspaceRepository } from './tripWorkspaceRepository.js';
import type { SharedTrip, SharedTripMeta, TripEventLogEntry, TripIndex, TripMembership, TripVisibility, UserWorkspaceState, WorkspaceTripSummary } from './tripShareTypes.js';

export class TripShareRepository {
    private readonly transactionDir: string;
    private readonly documents: TripDocumentRepository;
    private readonly memberships: TripMembershipRepository;
    private readonly metas: TripMetaRepository;
    private readonly workspaces: TripWorkspaceRepository;
    private readonly events: TripEventLogRepository;

    constructor(private readonly dataDir = resolveDataDir()) {
        this.transactionDir = path.join(dataDir, '.transactions');
        this.documents = new TripDocumentRepository(dataDir);
        this.memberships = new TripMembershipRepository(dataDir);
        this.metas = new TripMetaRepository(dataDir);
        this.workspaces = new TripWorkspaceRepository(dataDir);
        this.events = new TripEventLogRepository(dataDir);
        this.ensureDirectories();
        this.recoverPendingTransactions();
    }

    ensureDirectories(): void {
        this.documents.ensureDirectories();
        this.memberships.ensureDirectories();
        this.metas.ensureDirectories();
        this.events.ensureDirectories();
        fs.mkdirSync(path.join(this.dataDir, 'workspaces'), { recursive: true });
        fs.mkdirSync(this.transactionDir, { recursive: true });
    }

    private recoverPendingTransactions(): void {
        if (!fs.existsSync(this.transactionDir)) return;
        const markerFiles = fs.readdirSync(this.transactionDir).filter(file => file.endsWith('.json'));
        if (markerFiles.length === 0) return;
        for (const markerFile of markerFiles) {
            fs.unlinkSync(path.join(this.transactionDir, markerFile));
        }
        this.rebuildIndexFromMetas();
    }

    private startTransaction(operation: string, tripId: string): string {
        fs.mkdirSync(this.transactionDir, { recursive: true });
        const markerPath = path.join(this.transactionDir, `${Date.now()}-${process.pid}-${tripId}.json`);
        fs.writeFileSync(markerPath, JSON.stringify({ operation, tripId, startedAt: Date.now() }, null, 2), 'utf-8');
        return markerPath;
    }

    private finishTransaction(markerPath: string): void {
        if (fs.existsSync(markerPath)) fs.unlinkSync(markerPath);
    }

    getWorkspaceState(userId: string): UserWorkspaceState {
        return this.workspaces.getWorkspaceState(userId);
    }

    markWorkspaceTripRemoved(userId: string, tripId: string): void {
        this.workspaces.markWorkspaceTripRemoved(userId, tripId);
    }

    restoreWorkspaceTrip(userId: string, tripId: string): void {
        this.workspaces.restoreWorkspaceTrip(userId, tripId);
    }

    readIndex(): TripIndex {
        return this.metas.readIndex();
    }

    writeIndex(index: TripIndex): void {
        this.metas.writeIndex(index);
    }

    upsertTripInIndex(tripId: string, visibility: TripVisibility): void {
        this.metas.upsertTripInIndex(tripId, visibility);
    }

    removeTripFromIndex(tripId: string): void {
        this.metas.removeTripFromIndex(tripId);
    }

    getTripMeta(tripId: string): SharedTripMeta | null {
        return this.metas.getTripMeta(tripId);
    }

    writeTripMeta(meta: SharedTripMeta): void {
        this.metas.writeTripMeta(meta);
    }

    deleteTripMeta(tripId: string): void {
        this.metas.deleteTripMeta(tripId);
    }

    listTripMetas(): SharedTripMeta[] {
        return this.metas.listTripMetas();
    }

    getUserTrips(ownerId: string): SharedTripMeta[] {
        return this.metas.getUserTrips(ownerId);
    }

    rebuildIndexFromMetas(): TripIndex {
        return this.metas.rebuildIndexFromMetas();
    }

    getSharedTrip(tripId: string): SharedTrip | null {
        const trip = this.documents.getSharedTrip(tripId);
        return trip ? this.withMemberships(trip) : null;
    }

    listSharedTrips(): SharedTrip[] {
        return this.documents.listSharedTrips().map(trip => this.withMemberships(trip));
    }

    writeSharedTrip(trip: SharedTrip): void {
        this.documents.writeSharedTrip(trip);
    }

    writeSharedTripBundle(trip: SharedTrip, meta: SharedTripMeta, memberships?: TripMembership[]): void {
        const markerPath = this.startTransaction('write-shared-trip-bundle', trip.tripId);
        try {
            this.writeSharedTrip(trip);
            if (memberships) this.writeTripMemberships(trip.tripId, memberships);
            this.writeTripMeta(meta);
            this.upsertTripInIndex(trip.tripId, trip.visibility);
        } finally {
            this.finishTransaction(markerPath);
        }
    }

    deleteSharedTrip(tripId: string): void {
        this.documents.deleteSharedTrip(tripId);
        this.memberships.deleteTripMemberships(tripId);
    }

    getTripMemberships(tripId: string, options: { includeRevoked?: boolean } = {}): TripMembership[] {
        return this.memberships.getTripMemberships(tripId, options);
    }

    writeTripMemberships(tripId: string, memberships: TripMembership[]): void {
        this.memberships.writeTripMemberships(tripId, memberships);
    }

    appendTripEvent(event: TripEventLogEntry): void {
        this.events.appendTripEvent(event);
    }

    getTripEvents(tripId: string): TripEventLogEntry[] {
        return this.events.getTripEvents(tripId);
    }

    deleteTripEvents(tripId: string): void {
        this.events.deleteTripEvents(tripId);
    }

    getWorkspaceTrips(userId: string): WorkspaceTripSummary[] {
        const normalizedUserId = normalizeUserId(userId);
        if (!normalizedUserId) return [];

        const removedTripIds = new Set(this.getWorkspaceState(normalizedUserId).removedTripIds);
        return this.listSharedTrips()
            .filter(trip => !removedTripIds.has(trip.tripId) && Boolean(permissionToWorkspaceRole(trip, normalizedUserId)))
            .map((trip): WorkspaceTripSummary | null => {
                const meta = this.getTripMeta(trip.tripId);
                const role = permissionToWorkspaceRole(trip, normalizedUserId);
                if (!meta || !role) return null;
                return {
                    ...meta,
                    source: role === 'owner' ? 'owned' : 'shared',
                    role,
                    revision: trip.revision || 1
                };
            })
            .filter((summary): summary is WorkspaceTripSummary => Boolean(summary))
            .sort((a, b) => b.lastModified - a.lastModified);
    }

    getPublicTripMetas(): SharedTripMeta[] {
        return this.metas.getPublicTripMetas();
    }

    private withMemberships(trip: SharedTrip): SharedTrip {
        const memberships = this.memberships.getTripMemberships(trip.tripId);
        return { ...trip, memberships, permissions: permissionsFromMemberships(memberships, trip.ownerId) };
    }
}

export const tripShareRepository = new TripShareRepository();