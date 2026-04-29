import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GenerateContentParameters } from '@google/genai';
import { VertexAIProvider, type VertexAIClient, type VertexAIProviderSettings } from './VertexAIProvider.js';
import type { TripData } from '../../types.js';
import { SYSTEM_INSTRUCTION } from '../../config/aiConfig.js';

const baseSettings: VertexAIProviderSettings = {
    projectId: 'test-project',
    location: 'us-central1',
    apiVersion: 'v1',
    temperature: 0.2,
    maxOutputTokens: 1024,
    models: {
        tripGenerator: 'gemini-2.5-flash',
        tripUpdater: 'gemini-2.5-flash',
        recommender: 'gemini-2.5-flash',
    }
};

const tripData = {
    tripMeta: { title: 'Tokyo', days: 1 },
    days: [
        { day: 1, theme: 'Original', stops: [] }
    ],
    totals: {}
} as unknown as TripData;

async function* streamText(chunks: string[]) {
    for (const text of chunks) {
        yield { text };
    }
}

function createProvider(client: VertexAIClient, settings: Partial<VertexAIProviderSettings> = {}) {
    return new VertexAIProvider({
        clientFactory: () => client,
        settings: {
            ...baseSettings,
            ...settings,
            models: {
                ...baseSettings.models,
                ...settings.models,
            }
        }
    });
}

describe('VertexAIProvider', () => {
    it('requires a Google Cloud project id before creating the client', async () => {
        const provider = new VertexAIProvider({
            clientFactory: () => {
                throw new Error('client should not be created');
            },
            settings: { projectId: '' }
        });
        const originalConsoleError = console.error;
        console.error = () => undefined;

        try {
            await assert.rejects(
                () => provider.generateTrip({} as any),
                /GOOGLE_CLOUD_PROJECT/
            );
        } finally {
            console.error = originalConsoleError;
        }
    });

    it('generates trips with JSON response configuration', async () => {
        const calls: GenerateContentParameters[] = [];
        const client: VertexAIClient = {
            models: {
                async generateContent(params) {
                    calls.push(params);
                    return { text: JSON.stringify(tripData) };
                },
                async generateContentStream() {
                    return streamText([]);
                }
            }
        };

        const provider = createProvider(client);
        const result = await provider.generateTrip({ destination: 'Tokyo' } as any);

        assert.deepEqual(result, tripData);
        assert.equal(calls[0].model, 'gemini-2.5-flash');
        assert.equal(calls[0].config?.responseMimeType, 'application/json');
        assert.equal(calls[0].config?.systemInstruction, SYSTEM_INSTRUCTION);
        assert.equal(calls[0].config?.labels?.provider, 'vertex_ai');
    });

    it('streams trip updates and merges partial JSON payloads', async () => {
        const client: VertexAIClient = {
            models: {
                async generateContent() {
                    return { text: '{}' };
                },
                async generateContentStream() {
                    return streamText([
                        '我會更新這一天。',
                        '___UPDATE_JSON___',
                        JSON.stringify({ days: [{ day: 1, theme: 'Updated', stops: [] }] })
                    ]);
                }
            }
        };
        const thoughts: string[] = [];
        const provider = createProvider(client);

        const result = await provider.updateTrip(
            tripData,
            [{ role: 'user', text: 'Change day 1' }],
            text => thoughts.push(text)
        );

        assert.equal(result.responseText, '我會更新這一天。');
        assert.equal(result.updatedData?.days[0].theme, 'Updated');
        assert.ok(thoughts.includes('我會更新這一天。'));
    });

    it('returns an empty recommendation list for invalid JSON', async () => {
        const client: VertexAIClient = {
            models: {
                async generateContent() {
                    return { text: 'not json' };
                },
                async generateContentStream() {
                    return streamText([]);
                }
            }
        };
        const provider = createProvider(client);

        const result = await provider.getRecommendations('Tokyo', 'food', 'food');

        assert.deepEqual(result, []);
    });

    it('uses a safe feasibility fallback when parsing fails', async () => {
        const client: VertexAIClient = {
            models: {
                async generateContent() {
                    return { text: 'not json' };
                },
                async generateContentStream() {
                    return streamText([]);
                }
            }
        };
        const provider = createProvider(client);

        const result = await provider.checkFeasibility(tripData, 'Add a late dinner');

        assert.deepEqual(result, { feasible: true, riskLevel: 'low', issues: [], suggestions: [] });
    });
});