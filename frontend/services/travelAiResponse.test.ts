import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeTripData, parseJsonFromText } from './travelAiResponse';
import type { TripData } from '../types';

test('parseJsonFromText reads fenced objects and arrays', () => {
    assert.deepEqual(parseJsonFromText<{ ok: boolean }>('```json\n{"ok":true}\n```'), { ok: true });
    assert.deepEqual(parseJsonFromText<number[]>('prefix [1,2,3] suffix'), [1, 2, 3]);
});

test('mergeTripData replaces matching days and preserves others', () => {
    const original = {
        tripMeta: { title: 'Old' },
        days: [
            { day: 1, date: '2026-04-01', theme: 'One', stops: [], dailyChecklist: [] },
            { day: 2, date: '2026-04-02', theme: 'Two', stops: [], dailyChecklist: [] }
        ],
        totals: { estimatedCost: 10 }
    } as unknown as TripData;

    const merged = mergeTripData(original, {
        tripMeta: { title: 'New' } as any,
        days: [{ day: 2, date: '2026-04-02', theme: 'Updated', stops: [], dailyChecklist: [] }] as any
    });

    assert.equal(merged.tripMeta.title, 'New');
    assert.equal(merged.days.length, 2);
    assert.equal(merged.days[1].theme, 'Updated');
    assert.equal(merged.totals, original.totals);
});
