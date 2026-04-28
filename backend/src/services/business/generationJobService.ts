import { pricingService } from './pricingService.js';
import { deductPoints } from './pointsService.js';
import { aiPipeline } from '../aiPipeline.js';
import {
    ackGenerationJob,
    claimGenerationJob,
    createGenerationJob,
    failInProgressGenerationJobsOnStartup,
    findGenerationJobByClientRequestId,
    getGenerationJob,
    purgeExpiredGenerationJobs,
    updateGenerationJob
} from '../../modules/ai/infrastructure/json/generationJobStore.js';
import type { TripInput } from '../../types.js';

const generationInFlight = new Set<string>();

export function toPublicGenerationJob(job: any) {
    const { result, claimToken, ...rest } = job;
    return {
        ...rest,
        hasResult: Boolean(result)
    };
}

async function runGenerationJob(jobId: string, authToken: string, costDescription: string) {
    if (generationInFlight.has(jobId)) return;
    generationInFlight.add(jobId);

    try {
        const current = getGenerationJob(jobId);
        if (!current || current.status !== 'queued') return;

        updateGenerationJob(jobId, {
            status: 'running',
            startedAt: Date.now(),
            error: undefined,
            claimToken: undefined,
            claimedAt: undefined,
            result: undefined,
            billingStatus: 'pending'
        });

        const trip = await aiPipeline.generateTrip(current.tripInput, current.userId, authToken);

        const cost = pricingService.calculate('GENERATE_TRIP', { dateRange: current.tripInput?.dateRange });
        const idempotencyKey = `tripgen:${current.userId}:${jobId}:charge:v1`;
        const transactionId = `tripgen_charge_${jobId}`;
        const charged = await deductPoints(
            current.userId,
            cost,
            costDescription,
            authToken,
            { jobId, action: 'GENERATE_TRIP' },
            { idempotencyKey, transactionId }
        );

        if (!charged) {
            updateGenerationJob(jobId, {
                status: 'failed',
                billingStatus: 'charge_failed',
                error: 'Point charge failed. Please retry generation.',
                finishedAt: Date.now()
            });
            return;
        }

        updateGenerationJob(jobId, {
            status: 'completed',
            billingStatus: 'charged',
            result: trip,
            billedAt: Date.now(),
            finishedAt: Date.now(),
            error: undefined
        });
    } catch (error: any) {
        console.error('[GenerationJob] Failed:', error);
        updateGenerationJob(jobId, {
            status: 'failed',
            billingStatus: 'pending',
            error: error?.message || 'Generation failed',
            finishedAt: Date.now()
        });
    } finally {
        generationInFlight.delete(jobId);
    }
}

export function createOrReuseGenerationJob(input: {
    userId: string;
    authToken: string;
    tripInput: TripInput;
    tripLocalId?: string;
    clientRequestId: string;
    description?: string;
}) {
    const existing = findGenerationJobByClientRequestId(input.userId, input.clientRequestId);
    if (existing) return { statusCode: 200, job: toPublicGenerationJob(existing) };

    const job = createGenerationJob({
        action: 'GENERATE_TRIP',
        userId: input.userId,
        tripLocalId: input.tripLocalId,
        clientRequestId: input.clientRequestId,
        tripInput: input.tripInput
    });

    const costDescription = input.description || `Generate Trip: ${input.tripInput?.destination || 'Unknown'}`;
    void runGenerationJob(job.jobId, input.authToken, costDescription);

    return { statusCode: 202, job: toPublicGenerationJob(job) };
}

export function getGenerationJobForUser(jobId: string, userId: string) {
    const job = getGenerationJob(jobId);
    if (!job) return { statusCode: 404, body: { error: 'Generation job not found.' } };
    if (job.userId !== userId) return { statusCode: 403, body: { error: 'Forbidden.' } };
    return { statusCode: 200, body: toPublicGenerationJob(job) };
}

export function claimGenerationJobForUser(jobId: string, userId: string) {
    const claimed = claimGenerationJob(jobId, userId);
    if (!claimed) return { statusCode: 404, body: { error: 'Generation job not claimable.' } };

    return {
        statusCode: 200,
        body: {
            jobId: claimed.job.jobId,
            status: claimed.job.status,
            claimToken: claimed.claimToken,
            result: claimed.job.result
        }
    };
}

export function ackGenerationJobForUser(jobId: string, userId: string, claimToken: string) {
    const ok = ackGenerationJob(jobId, userId, claimToken);
    if (!ok) return { statusCode: 403, body: { error: 'Invalid claim token or forbidden.' } };
    return { statusCode: 200, body: { ok: true } };
}

export function initGenerationJobMaintenance() {
    try {
        purgeExpiredGenerationJobs(true);
        failInProgressGenerationJobsOnStartup();

        setInterval(() => {
            try {
                purgeExpiredGenerationJobs(true);
            } catch (e) {
                console.error('[GenerationJobMaintenance] Cleanup failed:', e);
            }
        }, 60 * 60 * 1000);
    } catch (e) {
        console.error('[GenerationJobMaintenance] Init failed:', e);
    }
}
