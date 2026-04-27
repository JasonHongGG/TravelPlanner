import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTripDocumentSaveQueue } from './tripDocumentSession';
import type { Trip } from '../types';

async function waitFor(assertion: () => void): Promise<void> {
    const startedAt = Date.now();
    let lastError: unknown;
    while (Date.now() - startedAt < 100) {
        try {
            assertion();
            return;
        } catch (error) {
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, 5));
        }
    }
    if (lastError) throw lastError;
}

function trip(id: string, title = id): Trip {
    return {
        id,
        title,
        createdAt: 1,
        status: 'complete',
        input: {
            dateRange: '2026-05-01 to 2026-05-02',
            destination: 'Tokyo',
            travelers: '2',
            interests: 'food',
            budget: 'medium',
            transport: 'train',
            accommodation: 'hotel',
            pace: 'balanced',
            mustVisit: '',
            language: 'en',
            constraints: ''
        }
    };
}

describe('createTripDocumentSaveQueue', () => {
    it('coalesces rapid queued saves into the latest trip', async () => {
        const saved: string[] = [];
        const queue = createTripDocumentSaveQueue({
            debounceMs: 1,
            async save(nextTrip) {
                saved.push(nextTrip.title);
            }
        });

        queue.enqueue(trip('trip-1', 'first'));
        queue.enqueue(trip('trip-1', 'second'));
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.deepEqual(saved, ['second']);
    });

    it('serializes a save queued during an in-flight save', async () => {
        const saved: string[] = [];
        let releaseFirstSave: (() => void) | undefined;
        const firstSaveDone = new Promise<void>(resolve => {
            releaseFirstSave = resolve;
        });
        const queue = createTripDocumentSaveQueue({
            debounceMs: 1,
            async save(nextTrip) {
                saved.push(nextTrip.title);
                if (nextTrip.title === 'first') await firstSaveDone;
            }
        });

        queue.enqueue(trip('trip-1', 'first'));
        await new Promise(resolve => setTimeout(resolve, 10));
        queue.enqueue(trip('trip-1', 'second'));
        releaseFirstSave?.();
        await waitFor(() => assert.deepEqual(saved, ['first', 'second']));

        assert.deepEqual(saved, ['first', 'second']);
    });
});