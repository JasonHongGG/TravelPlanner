import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AiPipeline } from './aiPipeline.js';
import type { IAIProvider } from './aiProvider/aiProvider.js';

const tripData = {
    tripMeta: { dateRange: '2026-05-01 to 2026-05-02', days: 2, transportStrategy: 'train', pace: 'balanced' },
    days: [],
    totals: {}
};

function createProvider(overrides: Partial<IAIProvider> = {}): IAIProvider {
    return {
        async generateTrip() {
            return tripData;
        },
        async updateTrip() {
            return { responseText: 'ok' };
        },
        async updateTripWithExplorer() {
            return { responseText: 'ok' };
        },
        async getRecommendations() {
            return [{ name: 'A', description: 'A', category: 'attraction', reason: 'nearby', openHours: 'Always' }];
        },
        async checkFeasibility() {
            return { feasible: true, riskLevel: 'low', issues: [], suggestions: [] };
        },
        ...overrides
    };
}

describe('AiPipeline', () => {
    it('uses the injected provider for trip generation', async () => {
        const pipeline = new AiPipeline(() => createProvider());
        assert.equal(await pipeline.generateTrip({} as any), tripData);
    });

    it('streams recommendations by falling back to batch provider results', async () => {
        const received: string[] = [];
        const pipeline = new AiPipeline(() => createProvider());

        await pipeline.streamRecommendations('Tokyo', 'food', 'attraction', [], item => received.push(item.name));

        assert.deepEqual(received, ['A']);
    });
});