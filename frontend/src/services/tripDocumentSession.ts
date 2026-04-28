import type { Trip } from '../types';

export type TripDocumentSaveResult = {
    serverTripId?: string;
    revision?: number;
    lastSyncedAt?: number;
};

export type TripDocumentSaveQueueOptions = {
    debounceMs?: number;
    save: (trip: Trip) => Promise<TripDocumentSaveResult | void>;
    onSaved?: (result: TripDocumentSaveResult, trip: Trip) => void;
    onError?: (error: unknown, trip: Trip) => void;
};

export type TripDocumentSaveQueue = {
    enqueue: (trip: Trip) => void;
    flush: () => Promise<void>;
    dispose: () => void;
    isPending: () => boolean;
};

export function createTripDocumentSaveQueue(options: TripDocumentSaveQueueOptions): TripDocumentSaveQueue {
    const debounceMs = options.debounceMs ?? 1200;
    let queuedTrip: Trip | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let disposed = false;

    const clearTimer = () => {
        if (timer) clearTimeout(timer);
        timer = null;
    };

    const flush = async (): Promise<void> => {
        clearTimer();
        if (disposed || inFlight || !queuedTrip) return;

        const tripToSave = queuedTrip;
        queuedTrip = null;
        inFlight = true;

        try {
            const result = await options.save(tripToSave);
            options.onSaved?.(result || {}, tripToSave);
        } catch (error) {
            options.onError?.(error, tripToSave);
        } finally {
            inFlight = false;
            if (!disposed && queuedTrip) {
                await flush();
            }
        }
    };

    return {
        enqueue(trip: Trip) {
            if (disposed) return;
            queuedTrip = trip;
            clearTimer();
            timer = setTimeout(() => void flush(), debounceMs);
        },
        flush,
        dispose() {
            disposed = true;
            queuedTrip = null;
            clearTimer();
        },
        isPending() {
            return Boolean(queuedTrip || inFlight || timer);
        }
    };
}