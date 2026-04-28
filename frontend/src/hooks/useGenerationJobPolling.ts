import { Dispatch, MutableRefObject, SetStateAction, useCallback, useRef } from 'react';
import type { Trip } from '../types';
import { aiService } from '../services';
import type { GenerationJob } from '../services/TravelAIService';
import { applyCompletedTripResult, applyGenerationError, applyGenerationJob } from '../services/tripRuntime';

type GenerationJobClient = Pick<typeof aiService, 'getGenerationJob' | 'claimGenerationJob' | 'ackGenerationJob'>;

type UseGenerationJobPollingInput = {
    tripsRef: MutableRefObject<Trip[]>;
    setTrips: Dispatch<SetStateAction<Trip[]>>;
    jobPollIntervalMs: number;
    client?: GenerationJobClient;
};

export function useGenerationJobPolling({ tripsRef, setTrips, jobPollIntervalMs, client = aiService }: UseGenerationJobPollingInput) {
    const activeJobPollingRef = useRef<Set<string>>(new Set());

    const applyGenerationJobToTrip = useCallback((tripId: string, job: GenerationJob) => {
        setTrips(prev => applyGenerationJob(prev, tripId, job));
    }, [setTrips]);

    const applyCompletedTripResultToTrip = useCallback((tripId: string, result: any) => {
        setTrips(prev => applyCompletedTripResult(prev, tripId, result));
    }, [setTrips]);

    const pollGenerationJob = useCallback(async (tripId: string, jobId: string) => {
        const activeJobPolling = activeJobPollingRef.current;
        if (activeJobPolling.has(jobId)) return;
        activeJobPolling.add(jobId);

        try {
            while (true) {
                const currentTrip = tripsRef.current.find(trip => trip.id === tripId);
                if (!currentTrip) break;

                const job = await client.getGenerationJob(jobId);
                applyGenerationJobToTrip(tripId, job);

                if (job.status === 'completed') {
                    const claimed = await client.claimGenerationJob(jobId);
                    applyCompletedTripResultToTrip(tripId, claimed.result);
                    try {
                        await client.ackGenerationJob(jobId, claimed.claimToken);
                    } catch (ackErr) {
                        console.warn('[TripManager] Ack generation job failed, will expire by TTL:', ackErr);
                    }
                    break;
                }

                if (job.status === 'failed') break;

                await new Promise(resolve => setTimeout(resolve, jobPollIntervalMs));
            }
        } catch (err: any) {
            setTrips(prev => applyGenerationError(prev, tripId, err?.message || 'Failed to fetch generation status'));
        } finally {
            activeJobPolling.delete(jobId);
        }
    }, [applyCompletedTripResultToTrip, applyGenerationJobToTrip, client, jobPollIntervalMs, setTrips, tripsRef]);

    return { pollGenerationJob };
}