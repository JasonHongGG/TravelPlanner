import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { IAIProvider } from './aiProvider.js';
import { LoggedAIProvider } from './LoggedAIProvider.js';

let tempDir = '';
const previousAiLogDir = process.env.AI_LOG_DIR;

function createProvider(overrides: Partial<IAIProvider> = {}): IAIProvider {
    return {
        async generateTrip() {
            return {
                tripMeta: { destination: '大阪', days: 1 },
                days: [],
                totals: {}
            } as any;
        },
        async updateTrip() {
            return { responseText: 'ok' };
        },
        async updateTripWithExplorer() {
            return { responseText: 'ok' };
        },
        async getRecommendations() {
            return [{
                name: '大阪城',
                description: '日本三大名城之一',
                category: '古蹟',
                reason: '大阪代表地標',
                openHours: '09:00 - 17:00'
            }];
        },
        async checkFeasibility() {
            return { feasible: true, riskLevel: 'low', issues: [], suggestions: [] };
        },
        ...overrides
    };
}

describe('LoggedAIProvider', () => {
    beforeEach(() => {
        tempDir = mkdtempSync(path.join(os.tmpdir(), 'travel-ai-log-'));
        process.env.AI_LOG_DIR = tempDir;
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
        if (previousAiLogDir === undefined) delete process.env.AI_LOG_DIR;
        else process.env.AI_LOG_DIR = previousAiLogDir;
    });

    it('writes structured ai-log files for provider calls', async () => {
        const provider = new LoggedAIProvider('vertex', createProvider());

        const result = await provider.getRecommendations('大阪', '', 'attraction', [], 'hong107373@gmail.com', undefined, 'Traditional Chinese', 'Local Language');

        assert.equal(result[0].name, '大阪城');

        const [fileName] = readdirSync(tempDir);
        assert.ok(fileName.includes('vertex_GettingRecommendations_大阪'));

        const log = JSON.parse(readFileSync(path.join(tempDir, fileName), 'utf8')) as {
            action: string;
            provider: { type: string; model: string };
            input: { prompt: string; request: { location: string } };
            output: { normalizedResponse: Array<{ name: string }> };
        };

        assert.equal(log.action, 'GET_RECOMMENDATIONS');
        assert.equal(log.provider.type, 'vertex');
        assert.ok(log.input.prompt.includes('大阪'));
        assert.equal(log.input.request.location, '大阪');
        assert.equal(log.output.normalizedResponse[0].name, '大阪城');
    });
});