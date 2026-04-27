import { RECOMMENDATION_COUNT } from '../../config/apiLimits.js';
import { aiPipeline } from '../aiPipeline.js';
import { sessionStore } from '../recommendationSessionStore.js';
import type { SseWriter } from '../http/sseWriter.js';
import { billingService, HttpError } from './billingService.js';

type GenerateActionInput = {
    action: string;
    description?: string;
    userId?: string;
    authToken?: string;
    tripInput?: any;
    location?: string;
    interests?: string;
    category?: 'attraction' | 'food';
    excludeNames?: string[];
    language?: string;
    titleLanguage?: string;
    tripData?: any;
    modificationContext?: string;
};

type StreamUpdateInput = GenerateActionInput & {
    currentData?: any;
    history?: any[];
    tripLanguage?: string;
    dayIndex?: number;
    newMustVisit?: string[];
    newAvoid?: string[];
    keepExisting?: string[];
    removeExisting?: string[];
};

type RecommendationStreamInput = {
    userId?: string;
    authToken?: string;
    location?: string;
    interests?: string;
    category?: 'attraction' | 'food';
    excludeNames?: string[];
    language?: string;
    titleLanguage?: string;
    mode?: 'init' | 'next';
    sessionId?: string;
    queueSize?: number;
};

function costDescriptionFor(input: GenerateActionInput): string {
    if (input.action === 'GENERATE_TRIP') {
        return `Generate Trip: ${input.tripInput?.destination}`;
    }
    return input.description || `AI Request (${input.action})`;
}

export async function runGenerateAction(input: GenerateActionInput): Promise<{ text: string }> {
    await billingService.chargeAction({
        userId: input.userId,
        authToken: input.authToken,
        action: input.action,
        dateRange: input.tripInput?.dateRange,
        description: costDescriptionFor(input),
        insufficientMessage: 'Insufficient points or Unauthorized.'
    });

    if (input.action === 'GET_RECOMMENDATIONS') {
        const results = await aiPipeline.getRecommendations(
            input.location || '',
            input.interests || '',
            input.category || 'attraction',
            input.excludeNames || [],
            input.userId,
            undefined,
            input.language,
            input.titleLanguage
        );
        return { text: JSON.stringify(results) };
    }

    if (input.action === 'CHECK_FEASIBILITY') {
        const feasibility = await aiPipeline.checkFeasibility(input.tripData, input.modificationContext || '', input.userId, input.authToken, input.language);
        return { text: JSON.stringify(feasibility) };
    }

    if (input.action === 'GENERATE_TRIP') {
        const trip = await aiPipeline.generateTrip(input.tripInput, input.userId, input.authToken);
        return { text: JSON.stringify(trip) };
    }

    if (input.action === 'GENERATE_ADVISORY') {
        const advisory = await aiPipeline.generateAdvisory(input.tripData, input.userId, input.authToken, input.language);
        return { text: JSON.stringify(advisory) };
    }

    throw new HttpError(400, `Action ${input.action} not supported on /generate`);
}

export async function runStreamUpdateAction(input: StreamUpdateInput, writer: SseWriter): Promise<void> {
    if (input.userId && input.action !== 'GENERATE_TRIP') {
        await billingService.chargeAction({
            userId: input.userId,
            authToken: input.authToken,
            action: input.action,
            description: input.description || input.action,
            insufficientMessage: 'Insufficient points'
        });
    }

    writer.start();
    const onThought = (chunk: string) => writer.content(chunk);

    if (input.action === 'CHAT_UPDATE') {
        await aiPipeline.updateTrip(input.currentData, input.history || [], onThought, input.userId, input.authToken, input.language, input.tripLanguage);
        writer.done();
        writer.end();
        return;
    }

    if (input.action === 'EXPLORER_UPDATE') {
        await aiPipeline.updateTripWithExplorer(
            input.currentData,
            input.dayIndex || 0,
            input.newMustVisit || [],
            input.newAvoid || [],
            input.keepExisting || [],
            input.removeExisting || [],
            onThought,
            input.userId,
            input.authToken,
            input.language,
            input.tripLanguage
        );
        writer.done();
        writer.end();
        return;
    }

    if (input.action === 'GENERATE_TRIP') {
        const stopKeepAlive = writer.startKeepAlive();
        try {
            const tripData = await aiPipeline.generateTrip(input.tripInput, input.userId, input.authToken);
            await billingService.chargeAction({
                userId: input.userId,
                authToken: input.authToken,
                action: input.action,
                dateRange: input.tripInput?.dateRange,
                description: input.description || input.action,
                insufficientMessage: 'Insufficient points'
            });
            writer.content(`\`\`\`json\n${JSON.stringify(tripData)}\n\`\`\``);
            writer.done();
        } catch (error: any) {
            writer.error(error?.message || 'Generation failed');
        } finally {
            stopKeepAlive();
            writer.end();
        }
        return;
    }

    writer.error('Unknown Action');
    writer.end();
}

export async function runRecommendationStream(input: RecommendationStreamInput, writer: SseWriter): Promise<void> {
    const baseCost = billingService.calculate('GET_RECOMMENDATIONS');
    let shouldDeduct = true;
    let finalCost = baseCost;
    let transactionDesc = `Recommendations: ${input.location || ''} (${input.category || 'attraction'})`;
    let activeSessionId = input.sessionId;

    if (input.mode === 'init') {
        const queueSize = typeof input.queueSize === 'number' ? input.queueSize : 0;
        finalCost = baseCost * (1 + queueSize);
        transactionDesc = `Recommendations Session (Start + ${queueSize} buffered)`;
    } else if (input.mode === 'next') {
        if (!activeSessionId) throw new HttpError(400, 'Session ID required for next batch');

        const session = sessionStore.getSession(activeSessionId);
        if (!session) throw new HttpError(404, 'Session not found or expired');
        if (session.userId !== input.userId) throw new HttpError(403, 'Unauthorized access to this session');

        const hasQuota = sessionStore.consumeQuota(activeSessionId);
        if (!hasQuota) throw new HttpError(402, 'Quota exceeded. Payment required.', 'QUOTA_EXCEEDED');
        shouldDeduct = false;
    }

    if (shouldDeduct) {
        await billingService.chargePoints({
            userId: input.userId,
            authToken: input.authToken,
            cost: finalCost,
            description: transactionDesc,
            insufficientMessage: 'Insufficient points'
        });
    }

    if (input.mode === 'init' && input.userId) {
        const queueSize = typeof input.queueSize === 'number' ? input.queueSize : 0;
        activeSessionId = sessionStore.createSession(input.userId, queueSize, { location: input.location || '', interests: input.interests || '' });
    }

    writer.start();
    if (activeSessionId) writer.meta({ sessionId: activeSessionId });

    await aiPipeline.streamRecommendations(
        input.location || '',
        input.interests || '',
        input.category || 'attraction',
        input.excludeNames || [],
        item => writer.item(item),
        input.userId,
        input.authToken,
        input.language,
        input.titleLanguage,
        RECOMMENDATION_COUNT
    );

    writer.done();
    writer.end();
}