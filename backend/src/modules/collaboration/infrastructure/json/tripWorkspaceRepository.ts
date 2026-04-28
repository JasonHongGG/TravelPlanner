import path from 'path';
import { createJsonFileStore, type JsonFileStore, resolveDataDir } from '../../../../platform/persistence/jsonFileStore.js';
import { normalizeUserId, removeTripFromIndexList } from '../../domain/tripShareDomain.js';
import type { UserWorkspaceState } from '../../domain/tripShareTypes.js';

export class TripWorkspaceRepository {
    private readonly workspaceDir: string;

    constructor(dataDir = resolveDataDir()) {
        this.workspaceDir = path.join(dataDir, 'workspaces');
    }

    private workspaceFilePath(userId: string): string {
        const normalized = normalizeUserId(userId) || 'anonymous';
        return path.join(this.workspaceDir, `${Buffer.from(normalized, 'utf-8').toString('base64url')}.json`);
    }

    private workspaceStore(userId: string): JsonFileStore<UserWorkspaceState> {
        return createJsonFileStore<UserWorkspaceState>({
            filePath: this.workspaceFilePath(userId),
            defaultValue: () => ({ schemaVersion: 1, removedTripIds: [] }),
            validate: (value) => {
                const parsed = value as Partial<UserWorkspaceState>;
                return {
                    schemaVersion: 1,
                    removedTripIds: Array.isArray(parsed.removedTripIds)
                        ? parsed.removedTripIds.filter((id): id is string => typeof id === 'string')
                        : []
                };
            },
            onReadError: (error) => console.error(`[TripWorkspaceRepository] Error reading workspace for ${userId}:`, error)
        });
    }

    getWorkspaceState(userId: string): UserWorkspaceState {
        return this.workspaceStore(userId).read();
    }

    markWorkspaceTripRemoved(userId: string, tripId: string): void {
        this.workspaceStore(userId).mutate((workspace) => {
            if (!workspace.removedTripIds.includes(tripId)) workspace.removedTripIds.push(tripId);
        });
    }

    restoreWorkspaceTrip(userId: string, tripId: string): void {
        this.workspaceStore(userId).mutate((workspace) => {
            workspace.removedTripIds = removeTripFromIndexList(workspace.removedTripIds, tripId);
        });
    }
}