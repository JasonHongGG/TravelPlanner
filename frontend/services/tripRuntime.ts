import type { GenerationJob } from './TravelAIService';
import type { Trip, TripData, TripInput } from '../types';
import { loadWorkspaceTrips, saveWorkspaceTrips } from './tripWorkspaceRepository';

export function loadStoredTrips(userEmail?: string): Trip[] {
    return loadWorkspaceTrips(userEmail);
}

export function saveStoredTrips(trips: Trip[], userEmail?: string): void {
    saveWorkspaceTrips(trips, userEmail);
}

export function createGeneratingTrip(input: TripInput, clientRequestId: string): Trip {
    return {
        id: crypto.randomUUID(),
        title: input.destination,
        createdAt: Date.now(),
        status: 'generating',
        input,
        generationClientRequestId: clientRequestId
    };
}

export function applyGenerationJob(trips: Trip[], tripId: string, job: GenerationJob): Trip[] {
    return trips.map(trip => {
        if (trip.id !== tripId) return trip;

        if (job.status === 'failed') {
            return {
                ...trip,
                status: 'error',
                errorMsg: job.error || 'Generation failed',
                generationTimeMs: Date.now() - trip.createdAt,
                lastJobCheckAt: Date.now()
            };
        }

        return {
            ...trip,
            status: 'generating',
            lastJobCheckAt: Date.now()
        };
    });
}

export function applyCompletedTripResult(trips: Trip[], tripId: string, result: TripData): Trip[] {
    return trips.map(trip => trip.id === tripId
        ? {
            ...trip,
            status: 'complete',
            data: result,
            errorMsg: undefined,
            generationTimeMs: Date.now() - trip.createdAt,
            lastJobCheckAt: Date.now()
        }
        : trip
    );
}

export function applyGenerationError(trips: Trip[], tripId: string, errorMessage: string): Trip[] {
    return trips.map(trip => trip.id === tripId
        ? {
            ...trip,
            status: 'error',
            errorMsg: errorMessage,
            generationTimeMs: Date.now() - trip.createdAt
        }
        : trip
    );
}

export function markStaleGeneratingTrip(trips: Trip[], tripId: string): Trip[] {
    return trips.map(trip => trip.id === tripId
        ? {
            ...trip,
            status: 'error',
            errorMsg: trip.errorMsg || 'Generation session expired. Please retry.',
            generationTimeMs: Date.now() - trip.createdAt
        }
        : trip
    );
}
