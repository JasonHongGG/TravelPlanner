import path from 'path';
import crypto from 'crypto';
import type { TripData, TripInput } from '../../types.js';
import { createJsonFileStore, resolveDataDir } from './jsonFileStore.js';

export type GenerationJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type GenerationBillingStatus = 'pending' | 'charged' | 'charge_failed';

export interface GenerationJob {
    jobId: string;
    action: 'GENERATE_TRIP';
    userId: string;
    tripLocalId?: string;
    clientRequestId: string;
    tripInput: TripInput;
    status: GenerationJobStatus;
    billingStatus: GenerationBillingStatus;
    result?: TripData;
    error?: string;
    claimToken?: string;
    createdAt: number;
    updatedAt: number;
    startedAt?: number;
    finishedAt?: number;
    billedAt?: number;
    claimedAt?: number;
    acknowledgedAt?: number;
}

type GenerationJobStoreFile = {
    schemaVersion: 1;
    jobs: Record<string, GenerationJob>;
};

type CreateGenerationJobInput = {
    action: 'GENERATE_TRIP';
    userId: string;
    tripLocalId?: string;
    clientRequestId: string;
    tripInput: TripInput;
};

const DATA_DIR = resolveDataDir();
const STORE_PATH = path.join(DATA_DIR, 'generation_jobs.json');
const JOB_TTL_MS = Number.parseInt(process.env.GENERATION_JOB_TTL_MS || '', 10) || 24 * 60 * 60 * 1000;
const ACKED_RESULT_TTL_MS = Number.parseInt(process.env.GENERATION_JOB_ACKED_RESULT_TTL_MS || '', 10) || 15 * 60 * 1000;

const jobStore = createJsonFileStore<GenerationJobStoreFile>({
    filePath: STORE_PATH,
    defaultValue: () => ({ schemaVersion: 1, jobs: {} }),
    validate: (value) => {
        const parsed = value as Partial<GenerationJobStoreFile>;
        return {
            schemaVersion: 1,
            jobs: parsed.jobs && typeof parsed.jobs === 'object' ? parsed.jobs : {}
        };
    },
    onReadError: (error) => console.error('[GenerationJobStore] Failed to read store, starting with empty store:', error)
});

function readStore(): GenerationJobStoreFile {
    return jobStore.read();
}

function writeStore(store: GenerationJobStoreFile) {
    jobStore.write(store);
}

function mutateStore<T>(mutator: (store: GenerationJobStoreFile) => T): T {
    return jobStore.mutate(mutator);
}

function cloneJob(job: GenerationJob): GenerationJob {
    return JSON.parse(JSON.stringify(job)) as GenerationJob;
}

export function createGenerationJob(input: CreateGenerationJobInput): GenerationJob {
    const now = Date.now();
    return mutateStore((store) => {
        const job: GenerationJob = {
            jobId: crypto.randomUUID(),
            action: input.action,
            userId: input.userId,
            tripLocalId: input.tripLocalId,
            clientRequestId: input.clientRequestId,
            tripInput: input.tripInput,
            status: 'queued',
            billingStatus: 'pending',
            createdAt: now,
            updatedAt: now
        };
        store.jobs[job.jobId] = job;
        return cloneJob(job);
    });
}

export function findGenerationJobByClientRequestId(userId: string, clientRequestId: string): GenerationJob | null {
    const store = readStore();
    const job = Object.values(store.jobs).find(item => item.userId === userId && item.clientRequestId === clientRequestId);
    return job ? cloneJob(job) : null;
}

export function getGenerationJob(jobId: string): GenerationJob | null {
    const job = readStore().jobs[jobId];
    return job ? cloneJob(job) : null;
}

export function updateGenerationJob(jobId: string, updates: Partial<GenerationJob>): GenerationJob | null {
    return mutateStore((store) => {
        const existing = store.jobs[jobId];
        if (!existing) return null;

        const next: GenerationJob = {
            ...existing,
            ...updates,
            jobId: existing.jobId,
            userId: existing.userId,
            action: existing.action,
            clientRequestId: existing.clientRequestId,
            tripInput: existing.tripInput,
            updatedAt: Date.now()
        };
        store.jobs[jobId] = next;
        return cloneJob(next);
    });
}

export function claimGenerationJob(jobId: string, userId: string): { job: GenerationJob; claimToken: string } | null {
    return mutateStore((store) => {
        const job = store.jobs[jobId];
        if (!job || job.userId !== userId || job.status !== 'completed' || !job.result) return null;

        const claimToken = crypto.randomUUID();
        job.claimToken = claimToken;
        job.claimedAt = Date.now();
        job.updatedAt = Date.now();

        return { job: cloneJob(job), claimToken };
    });
}

export function ackGenerationJob(jobId: string, userId: string, claimToken: string): boolean {
    return mutateStore((store) => {
        const job = store.jobs[jobId];
        if (!job || job.userId !== userId || job.claimToken !== claimToken) return false;

        job.acknowledgedAt = Date.now();
        job.claimToken = undefined;
        job.result = undefined;
        job.updatedAt = Date.now();
        return true;
    });
}

export function failInProgressGenerationJobsOnStartup(): number {
    return mutateStore((store) => {
        let failedCount = 0;
        for (const job of Object.values(store.jobs)) {
            if (job.status === 'queued' || job.status === 'running') {
                job.status = 'failed';
                job.error = 'Generation was interrupted by a server restart. Please retry.';
                job.finishedAt = Date.now();
                job.updatedAt = Date.now();
                failedCount++;
            }
        }
        return failedCount;
    });
}

export function purgeExpiredGenerationJobs(includeAcknowledged = false): number {
    const now = Date.now();
    return mutateStore((store) => {
        let purgedCount = 0;
        for (const [jobId, job] of Object.entries(store.jobs)) {
            const isExpired = now - job.updatedAt > JOB_TTL_MS;
            const isAcknowledgedExpired = includeAcknowledged && job.acknowledgedAt && now - job.acknowledgedAt > ACKED_RESULT_TTL_MS;
            if (isExpired || isAcknowledgedExpired) {
                delete store.jobs[jobId];
                purgedCount++;
            }
        }
        return purgedCount;
    });
}
