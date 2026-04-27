import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractJsonText, mergeTripData, parseJsonFromText, stripJsonFence } from './aiResponseParser.js';
import type { TripData } from '../types.js';

describe('AI response parser', () => {
    it('strips fenced JSON', () => {
        assert.equal(stripJsonFence('```json\n{"ok":true}\n```'), '{"ok":true}');
    });

    it('extracts the outer JSON value from surrounding text', () => {
        assert.equal(extractJsonText('Here is the result: {"ok":true} thanks'), '{"ok":true}');
    });

    it('parses arrays and objects', () => {
        assert.deepEqual(parseJsonFromText('```json\n[{"name":"A"}]\n```'), [{ name: 'A' }]);
        assert.deepEqual(parseJsonFromText('{"ok":true}'), { ok: true });
    });

    it('returns fallback for non-strict parse failures', () => {
        assert.deepEqual(parseJsonFromText('not json', { strict: false, fallback: {} }), {});
    });

    it('merges partial trip updates by day number', () => {
        const original = {
            tripMeta: { title: 'Trip', days: 2 },
            days: [
                { day: 1, title: 'One' },
                { day: 2, title: 'Two' }
            ],
            totals: { estimatedCost: 100 }
        } as unknown as TripData;

        const merged = mergeTripData(original, {
            tripMeta: { title: 'Updated' },
            days: [
                { day: 2, title: 'Two updated' },
                { day: 3, title: 'Three' }
            ]
        } as unknown as Partial<TripData>);

        assert.equal(merged.tripMeta.title, 'Updated');
        assert.deepEqual(merged.days.map(day => day.day), [1, 2, 3]);
        assert.equal(merged.days[1].title, 'Two updated');
    });
});