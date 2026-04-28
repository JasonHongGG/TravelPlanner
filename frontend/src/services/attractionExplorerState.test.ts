import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { collectKnownRecommendationNames, createInitialStopStatuses, getPromptLanguageName } from './attractionExplorerState';
import type { AttractionRecommendation, TripStop } from '../types';

const recommendation = (name: string): AttractionRecommendation => ({
    name,
    description: name,
    category: 'attraction',
    reason: 'nearby',
    openHours: 'Always'
});

describe('attractionExplorerState', () => {
    it('maps UI language codes to prompt language names', () => {
        assert.equal(getPromptLanguageName('ja-JP'), 'Japanese');
        assert.equal(getPromptLanguageName('unknown'), 'Traditional Chinese');
    });

    it('creates neutral status for current stops', () => {
        const statuses = createInitialStopStatuses([{ name: 'A' }, { name: 'B' }] as TripStop[]);
        assert.deepEqual(statuses, { A: 'neutral', B: 'neutral' });
    });

    it('collects current, visible, and buffered names for duplicate exclusion', () => {
        assert.deepEqual(collectKnownRecommendationNames({
            currentStops: [{ name: 'Current' }],
            results: { attraction: [recommendation('Visible')], food: [] },
            buffer: { attraction: [recommendation('Buffered')], food: [recommendation('Food')] },
            tab: 'attraction'
        }), ['Current', 'Visible', 'Buffered']);
    });
});