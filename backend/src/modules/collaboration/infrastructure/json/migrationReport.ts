import fs from 'fs';
import path from 'path';
import { resolveDataDir, resolveMigrationReportDir } from '../../../../platform/runtimePaths.js';

type MigrationSection = {
    name: string;
    source: string;
    recordCount: number;
    issues: string[];
    cleanupActions?: string[];
};

export type MigrationReport = {
    generatedAt: string;
    dataDir: string;
    target: 'json-runtime' | 'sqlite-ready';
    sections: MigrationSection[];
    artifacts?: {
        reportPath: string;
        snapshotPath: string;
    };
};

export type MigrationSnapshot = {
    generatedAt: string;
    users: Array<{ email: string; value: unknown }>;
    tripIndex: unknown;
    sharedTrips: unknown[];
    tripMemberships: unknown[];
    tripMeta: unknown[];
    generationJobs: unknown[];
};

const DATA_DIR = resolveDataDir();

function readJsonFile(filePath: string): any | null {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function countJsonFiles(dirPath: string): number {
    if (!fs.existsSync(dirPath)) return 0;
    return fs.readdirSync(dirPath).filter(file => file.endsWith('.json')).length;
}

function readJsonFiles(dirPath: string): unknown[] {
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath)
        .filter(file => file.endsWith('.json'))
        .map(file => readJsonFile(path.join(dirPath, file)))
        .filter(Boolean);
}

function isObjectRecord(value: unknown): value is Record<string, any> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function issueWhen(count: number, message: string): string[] {
    return count > 0 ? [`${message}: ${count}`] : [];
}

function metaTripIdsByVisibility(records: unknown[], visibility: 'public' | 'private'): string[] {
    return records.flatMap(record => {
        if (!isObjectRecord(record) || typeof record.tripId !== 'string') return [];
        const isPublic = record.visibility === 'public';
        if (visibility === 'public' && isPublic) return [record.tripId];
        if (visibility === 'private' && !isPublic) return [record.tripId];
        return [];
    });
}

function activeOwnerMembershipCount(records: unknown[], tripId: string, ownerId: string): number {
    return records.filter(record => {
        if (!isObjectRecord(record)) return false;
        if (!Array.isArray(record.memberships)) return false;
        return record.memberships.some((membership: unknown) => isObjectRecord(membership)
            && membership.tripId === tripId
            && typeof membership.userId === 'string'
            && membership.userId.toLowerCase() === ownerId.toLowerCase()
            && membership.role === 'owner'
            && membership.status === 'active'
        );
    }).length;
}

export function createMigrationReport(): MigrationReport {
    const usersPath = path.join(DATA_DIR, 'users.json');
    const tripIndexPath = path.join(DATA_DIR, 'trip_index.json');
    const sharedTripsDir = path.join(DATA_DIR, 'shared_trips');
    const tripMembershipsDir = path.join(DATA_DIR, 'trip_memberships');
    const tripMetaDir = path.join(DATA_DIR, 'trip_meta');
    const workspaceDir = path.join(DATA_DIR, 'workspaces');
    const tripEventsDir = path.join(DATA_DIR, 'trip_events');
    const transactionDir = path.join(DATA_DIR, '.transactions');
    const generationJobsPath = path.join(DATA_DIR, 'generation_jobs.json');

    const sections: MigrationSection[] = [];

    const users = readJsonFile(usersPath);
    sections.push({
        name: 'users',
        source: usersPath,
        recordCount: users && typeof users === 'object' ? Object.keys(users).length : 0,
        issues: users ? [] : ['users.json not found; new installs can ignore this.']
    });

    const tripIndex = readJsonFile(tripIndexPath);
    const tripMetaRecords = readJsonFiles(tripMetaDir);
    const sharedTripRecords = readJsonFiles(sharedTripsDir);
    const tripMembershipRecords = readJsonFiles(tripMembershipsDir);
    const indexedPublicTrips = Array.isArray(tripIndex?.publicTrips) ? tripIndex.publicTrips : [];
    const indexedPrivateTrips = Array.isArray(tripIndex?.sharedPrivateTrips) ? tripIndex.sharedPrivateTrips : [];
    const metaPublicIds = metaTripIdsByVisibility(tripMetaRecords, 'public');
    const metaPrivateIds = metaTripIdsByVisibility(tripMetaRecords, 'private');
    const stalePublicIndexCount = indexedPublicTrips.filter((tripId: string) => !metaPublicIds.includes(tripId)).length;
    const stalePrivateIndexCount = indexedPrivateTrips.filter((tripId: string) => !metaPrivateIds.includes(tripId)).length;

    sections.push({
        name: 'trip_index',
        source: tripIndexPath,
        recordCount: tripIndex ? indexedPublicTrips.length + indexedPrivateTrips.length : 0,
        issues: [
            ...(tripIndex ? [] : ['trip_index.json not found; no shared trips to migrate.']),
            ...issueWhen(stalePublicIndexCount + stalePrivateIndexCount, 'trip_index contains entries not backed by current trip_meta visibility')
        ],
        cleanupActions: stalePublicIndexCount + stalePrivateIndexCount > 0
            ? ['Run the app or rebuildIndexFromMetas() once; trip_index is a derived cache and can be regenerated from trip_meta.']
            : []
    });

    const missingRevisionCount = sharedTripRecords.filter(trip => isObjectRecord(trip) && typeof trip.revision !== 'number').length;
    const embeddedAccessFieldCount = sharedTripRecords.filter(trip => isObjectRecord(trip) && (Array.isArray(trip.allowedUsers) || isObjectRecord(trip.permissions))).length;
    const ownerMismatchCount = sharedTripRecords.filter(trip => {
        if (!isObjectRecord(trip) || !isObjectRecord(trip.tripData)) return false;
        return typeof trip.ownerId === 'string' && typeof trip.tripData.ownerId === 'string' && trip.ownerId.toLowerCase() !== trip.tripData.ownerId.toLowerCase();
    }).length;

    sections.push({
        name: 'shared_trips',
        source: sharedTripsDir,
        recordCount: sharedTripRecords.length,
        issues: [
            ...issueWhen(missingRevisionCount, 'shared trip documents without revision'),
            ...issueWhen(embeddedAccessFieldCount, 'shared trip documents still carrying embedded access fields'),
            ...issueWhen(ownerMismatchCount, 'shared trip ownerId does not match nested tripData.ownerId')
        ],
        cleanupActions: [
            ...(missingRevisionCount > 0 ? ['Backfill missing revisions to 1 before enabling strict optimistic concurrency on old data.'] : []),
            ...(embeddedAccessFieldCount > 0 ? ['Convert embedded access fields into trip_memberships records, then remove embedded access fields after verification.'] : []),
            ...(ownerMismatchCount > 0 ? ['Use the canonical shared trip ownerId as source of truth and rewrite nested tripData.ownerId.'] : [])
        ]
    });

    const missingOwnerMembershipCount = sharedTripRecords.filter(trip => {
        if (!isObjectRecord(trip) || typeof trip.tripId !== 'string' || typeof trip.ownerId !== 'string') return false;
        return activeOwnerMembershipCount(tripMembershipRecords, trip.tripId, trip.ownerId) === 0;
    }).length;

    sections.push({
        name: 'trip_memberships',
        source: tripMembershipsDir,
        recordCount: tripMembershipRecords.reduce<number>((count, record) => count + (isObjectRecord(record) && Array.isArray(record.memberships) ? record.memberships.length : 0), 0),
        issues: [
            ...issueWhen(missingOwnerMembershipCount, 'shared trip documents without active owner membership')
        ],
        cleanupActions: missingOwnerMembershipCount > 0
            ? ['Create one active owner membership for each canonical trip document before enabling strict membership-only access checks on old data.']
            : []
    });

    sections.push({
        name: 'trip_meta',
        source: tripMetaDir,
        recordCount: tripMetaRecords.length,
        issues: []
    });

    sections.push({
        name: 'workspaces',
        source: workspaceDir,
        recordCount: countJsonFiles(workspaceDir),
        issues: [],
        cleanupActions: ['Workspace files are per-user projections; they can be reset without deleting canonical trip documents.']
    });

    sections.push({
        name: 'trip_events',
        source: tripEventsDir,
        recordCount: fs.existsSync(tripEventsDir) ? fs.readdirSync(tripEventsDir).filter(file => file.endsWith('.jsonl')).length : 0,
        issues: [],
        cleanupActions: ['Event logs are audit/invalidation history. Keep for diagnostics or archive after a retention decision.']
    });

    sections.push({
        name: 'transactions',
        source: transactionDir,
        recordCount: countJsonFiles(transactionDir),
        issues: countJsonFiles(transactionDir) > 0 ? ['Pending transaction markers found; repository startup will remove markers and rebuild trip_index.'] : []
    });

    const generationJobs = readJsonFile(generationJobsPath);
    sections.push({
        name: 'generation_jobs',
        source: generationJobsPath,
        recordCount: generationJobs?.jobs && typeof generationJobs.jobs === 'object' ? Object.keys(generationJobs.jobs).length : 0,
        issues: generationJobs ? [] : ['generation_jobs.json not found; no durable jobs to migrate.']
    });

    return {
        generatedAt: new Date().toISOString(),
        dataDir: DATA_DIR,
        target: 'sqlite-ready',
        sections
    };
}

export function createMigrationSnapshot(): MigrationSnapshot {
    const users = readJsonFile(path.join(DATA_DIR, 'users.json')) || {};
    const generationJobStore = readJsonFile(path.join(DATA_DIR, 'generation_jobs.json'));

    return {
        generatedAt: new Date().toISOString(),
        users: Object.entries(users).map(([email, value]) => ({ email, value })),
        tripIndex: readJsonFile(path.join(DATA_DIR, 'trip_index.json')) || { publicTrips: [], sharedPrivateTrips: [] },
        sharedTrips: readJsonFiles(path.join(DATA_DIR, 'shared_trips')),
        tripMemberships: readJsonFiles(path.join(DATA_DIR, 'trip_memberships')),
        tripMeta: readJsonFiles(path.join(DATA_DIR, 'trip_meta')),
        generationJobs: generationJobStore?.jobs && typeof generationJobStore.jobs === 'object'
            ? Object.values(generationJobStore.jobs)
            : []
    };
}

export function writeMigrationReport(outputPath = path.join(resolveMigrationReportDir(), 'migration_report.json')): MigrationReport {
    const report = createMigrationReport();
    const snapshotPath = outputPath.replace(/\.json$/i, '_snapshot.json');
    const snapshot = createMigrationSnapshot();

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    report.artifacts = {
        reportPath: outputPath,
        snapshotPath
    };
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    return report;
}
