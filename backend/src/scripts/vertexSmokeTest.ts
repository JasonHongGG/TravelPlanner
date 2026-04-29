import 'dotenv/config';
import { VertexAIProvider } from '../services/aiProvider/VertexAIProvider.js';
import type { TripData } from '../types.js';

const sampleTrip = {
    tripMeta: {
        dateRange: '2026-05-01 to 2026-05-01',
        days: 1,
        travelers: '1 adult',
        transportStrategy: 'walking and transit',
        pace: 'easy'
    },
    days: [
        {
            day: 1,
            date: '05/01',
            theme: 'Smoke Test',
            stops: [],
            dailyChecklist: []
        }
    ],
    totals: {}
} as unknown as TripData;

async function main() {
    if (!process.env.GOOGLE_CLOUD_PROJECT) {
        throw new Error('GOOGLE_CLOUD_PROJECT is required for the Vertex AI smoke test.');
    }

    const provider = new VertexAIProvider();
    const result = await provider.generateAdvisory(sampleTrip, undefined, undefined, 'Traditional Chinese');
    const keys = result && typeof result === 'object' ? Object.keys(result) : [];

    console.log('Vertex AI smoke test completed. Response keys:', keys.join(', ') || '<none>');
}

main().catch(error => {
    console.error('Vertex AI smoke test failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
});