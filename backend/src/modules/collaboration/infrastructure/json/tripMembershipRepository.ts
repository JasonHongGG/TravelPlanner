import fs from 'fs';
import path from 'path';
import { createJsonFileStore, type JsonFileStore, resolveDataDir } from '../../../../platform/persistence/jsonFileStore.js';
import { normalizeUserId } from '../../domain/tripShareDomain.js';
import type { TripMemberRole, TripMembership } from '../../domain/tripShareTypes.js';

type TripMembershipFile = {
    schemaVersion: 1;
    memberships: TripMembership[];
};

function normalizeMembership(value: unknown): TripMembership | null {
    const record = value as Partial<TripMembership>;
    const userId = normalizeUserId(record.userId);
    if (!userId || typeof record.tripId !== 'string') return null;
    const role = ['owner', 'editor', 'viewer'].includes(String(record.role)) ? record.role as TripMemberRole : 'viewer';
    const status = record.status === 'revoked' ? 'revoked' : 'active';
    const createdAt = typeof record.createdAt === 'number' ? record.createdAt : Date.now();
    const updatedAt = typeof record.updatedAt === 'number' ? record.updatedAt : createdAt;
    return { schemaVersion: 1, tripId: record.tripId, userId, role, status, createdAt, updatedAt };
}

function validateMembershipFile(value: unknown): TripMembershipFile {
    const parsed = value as Partial<TripMembershipFile>;
    const memberships = Array.isArray(parsed.memberships)
        ? parsed.memberships.map(normalizeMembership).filter((item): item is TripMembership => Boolean(item))
        : [];
    return { schemaVersion: 1, memberships };
}

export class TripMembershipRepository {
    private readonly membershipDir: string;

    constructor(dataDir = resolveDataDir()) {
        this.membershipDir = path.join(dataDir, 'trip_memberships');
    }

    ensureDirectories(): void {
        fs.mkdirSync(this.membershipDir, { recursive: true });
    }

    private membershipFilePath(tripId: string): string {
        return path.join(this.membershipDir, `${tripId}.json`);
    }

    private membershipStore(tripId: string): JsonFileStore<TripMembershipFile> {
        return createJsonFileStore<TripMembershipFile>({
            filePath: this.membershipFilePath(tripId),
            defaultValue: () => ({ schemaVersion: 1, memberships: [] }),
            validate: validateMembershipFile,
            onReadError: (error) => console.error(`[TripMembershipRepository] Error reading memberships for ${tripId}:`, error)
        });
    }

    getTripMemberships(tripId: string, options: { includeRevoked?: boolean } = {}): TripMembership[] {
        const store = this.membershipStore(tripId);
        const memberships = store.exists() ? store.read().memberships : [];
        return options.includeRevoked ? memberships : memberships.filter(membership => membership.status === 'active');
    }

    writeTripMemberships(tripId: string, memberships: TripMembership[]): void {
        this.membershipStore(tripId).write({ schemaVersion: 1, memberships: memberships.map(item => ({ ...item, schemaVersion: 1 })) });
    }

    deleteTripMemberships(tripId: string): void {
        const filePath = this.membershipFilePath(tripId);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
}