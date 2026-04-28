import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCompletedTripResult, applyGenerationJob } from './tripRuntime';
import type { GenerationJob } from './TravelAIService';
import type { Trip, TripData, TripInput } from '../types';

const input = {
    destination: 'Tokyo',
    dateRange: '2026-04-01 - 2026-04-02'
} as TripInput;

const baseTrip = {
    id: 'trip-1',
    title: 'Tokyo',
    createdAt: Date.now() - 1000,
    status: 'generating',
    input
} as Trip;

test('applyGenerationJob marks failed trips', () => {
    const job = { status: 'failed', error: 'No points' } as GenerationJob;
    const [updated] = applyGenerationJob([baseTrip], 'trip-1', job);

    assert.equal(updated.status, 'error');
    assert.equal(updated.errorMsg, 'No points');
});

test('applyCompletedTripResult stores generated data', () => {
    const data = { tripMeta: { title: 'Tokyo' }, days: [], totals: {} } as unknown as TripData;
    const [updated] = applyCompletedTripResult([baseTrip], 'trip-1', data);

    assert.equal(updated.status, 'complete');
    assert.equal(updated.data, data);
});
