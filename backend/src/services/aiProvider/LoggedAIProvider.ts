import type { AttractionRecommendation, FeasibilityResult, Message, TripData, TripInput } from '../../types.js';
import {
    constructAdvisoryPrompt,
    constructExplorerUpdatePrompt,
    constructFeasibilityPrompt,
    constructRecommendationPrompt,
    constructTripPrompt,
    constructUpdatePrompt,
} from '../../config/aiConfig.js';
import { SERVICE_CONFIG, type ServiceAIProviderType } from '../../config/serviceConfig.js';
import type { IAIProvider, UpdateResult } from './aiProvider.js';
import { buildAiActionLabel, type AiLogAction, writeAiLog } from '../aiLogService.js';

type LoggedRequestPayload = Record<string, unknown>;

function getModelForAction(providerType: ServiceAIProviderType, action: AiLogAction): string {
    const models = SERVICE_CONFIG[providerType].models;

    switch (action) {
        case 'GENERATE_TRIP':
        case 'GENERATE_ADVISORY':
            return models.tripGenerator;
        case 'CHAT_UPDATE':
        case 'EXPLORER_UPDATE':
            return models.tripUpdater;
        case 'GET_RECOMMENDATIONS':
        case 'CHECK_FEASIBILITY':
            return models.recommender;
    }
}

function buildPrompt(action: AiLogAction, request: LoggedRequestPayload): string | null {
    try {
        switch (action) {
            case 'GENERATE_TRIP':
                return constructTripPrompt(request.tripInput as TripInput);
            case 'CHAT_UPDATE':
                return constructUpdatePrompt(
                    request.currentData as TripData,
                    (request.history as Message[]) || [],
                    typeof request.language === 'string' ? request.language : 'Traditional Chinese',
                    typeof request.tripLanguage === 'string' ? request.tripLanguage : (typeof request.language === 'string' ? request.language : 'Traditional Chinese')
                );
            case 'GET_RECOMMENDATIONS':
                return constructRecommendationPrompt(
                    typeof request.location === 'string' ? request.location : '',
                    typeof request.interests === 'string' ? request.interests : '',
                    (request.category as 'attraction' | 'food') || 'attraction',
                    (request.excludeNames as string[]) || [],
                    typeof request.language === 'string' ? request.language : 'Traditional Chinese',
                    typeof request.titleLanguage === 'string' ? request.titleLanguage : 'Local Language',
                    typeof request.count === 'number' ? request.count : 12
                );
            case 'CHECK_FEASIBILITY':
                return constructFeasibilityPrompt(
                    request.tripData as TripData,
                    typeof request.modificationContext === 'string' ? request.modificationContext : '',
                    typeof request.language === 'string' ? request.language : 'Traditional Chinese'
                );
            case 'EXPLORER_UPDATE':
                return constructExplorerUpdatePrompt(
                    typeof request.dayIndex === 'number' ? request.dayIndex : 0,
                    (request.newMustVisit as string[]) || [],
                    (request.newAvoid as string[]) || [],
                    (request.keepExisting as string[]) || [],
                    (request.removeExisting as string[]) || [],
                    typeof request.language === 'string' ? request.language : 'Traditional Chinese',
                    typeof request.tripLanguage === 'string' ? request.tripLanguage : (typeof request.language === 'string' ? request.language : 'Traditional Chinese')
                );
            case 'GENERATE_ADVISORY':
                return constructAdvisoryPrompt(
                    request.tripData as TripData,
                    typeof request.language === 'string' ? request.language : 'Traditional Chinese'
                );
            default:
                return null;
        }
    } catch {
        return null;
    }
}

export class LoggedAIProvider implements IAIProvider {
    constructor(
        private readonly providerType: ServiceAIProviderType,
        private readonly delegate: IAIProvider
    ) { }

    getInnerProvider(): IAIProvider {
        return this.delegate;
    }

    private async writeLog(
        action: AiLogAction,
        request: LoggedRequestPayload,
        userId: string | undefined,
        startedAt: number,
        result?: unknown,
        rawResponseText?: string | null,
        error?: unknown,
    ) {
        try {
            await writeAiLog({
                action,
                actionLabel: buildAiActionLabel(action, request),
                providerType: this.providerType,
                providerImplementation: this.delegate.constructor.name,
                model: getModelForAction(this.providerType, action),
                userId,
                request,
                prompt: buildPrompt(action, request),
                durationMs: Date.now() - startedAt,
                response: result,
                rawResponseText,
                error,
            });
        } catch (logError) {
            console.warn('[AI Log] Failed to write ai-log entry:', logError);
        }
    }

    async generateTrip(input: TripInput, userId?: string, apiSecret?: string): Promise<TripData> {
        const request = { tripInput: input };
        const startedAt = Date.now();

        try {
            const result = await this.delegate.generateTrip(input, userId, apiSecret);
            await this.writeLog('GENERATE_TRIP', request, userId, startedAt, result);
            return result;
        } catch (error) {
            await this.writeLog('GENERATE_TRIP', request, userId, startedAt, undefined, null, error);
            throw error;
        }
    }

    async generateAdvisory(tripData: TripData, userId?: string, apiSecret?: string, language?: string): Promise<any> {
        if (!this.delegate.generateAdvisory) {
            throw new Error('Advisory generation is not supported by the active provider.');
        }

        const request = { tripData, language };
        const startedAt = Date.now();

        try {
            const result = await this.delegate.generateAdvisory(tripData, userId, apiSecret, language);
            await this.writeLog('GENERATE_ADVISORY', request, userId, startedAt, result);
            return result;
        } catch (error) {
            await this.writeLog('GENERATE_ADVISORY', request, userId, startedAt, undefined, null, error);
            throw error;
        }
    }

    async updateTrip(
        currentData: TripData,
        history: Message[],
        onThought?: (text: string) => void,
        userId?: string,
        apiSecret?: string,
        language?: string,
        tripLanguage?: string
    ): Promise<UpdateResult> {
        const request = { currentData, history, language, tripLanguage };
        const startedAt = Date.now();

        try {
            const result = await this.delegate.updateTrip(currentData, history, onThought, userId, apiSecret, language, tripLanguage);
            await this.writeLog('CHAT_UPDATE', request, userId, startedAt, {
                responseText: result.responseText,
                updatedData: result.updatedData ?? null,
            }, result.responseText || null);
            return result;
        } catch (error) {
            await this.writeLog('CHAT_UPDATE', request, userId, startedAt, undefined, null, error);
            throw error;
        }
    }

    async getRecommendations(
        location: string,
        interests: string,
        category: 'attraction' | 'food',
        excludeNames: string[] = [],
        userId?: string,
        apiSecret?: string,
        language?: string,
        titleLanguage?: string
    ): Promise<AttractionRecommendation[]> {
        const request = { location, interests, category, excludeNames, language, titleLanguage, mode: 'batch' };
        const startedAt = Date.now();

        try {
            const result = await this.delegate.getRecommendations(location, interests, category, excludeNames, userId, apiSecret, language, titleLanguage);
            await this.writeLog('GET_RECOMMENDATIONS', request, userId, startedAt, result);
            return result;
        } catch (error) {
            await this.writeLog('GET_RECOMMENDATIONS', request, userId, startedAt, undefined, null, error);
            throw error;
        }
    }

    async getRecommendationsStream(
        location: string,
        interests: string,
        category: 'attraction' | 'food',
        excludeNames: string[],
        onItem: (item: AttractionRecommendation) => void,
        userId?: string,
        apiSecret?: string,
        language?: string,
        titleLanguage?: string,
        count?: number
    ): Promise<void> {
        const request = { location, interests, category, excludeNames, language, titleLanguage, count, mode: 'stream' };
        const startedAt = Date.now();
        const streamedItems: AttractionRecommendation[] = [];

        const forwardItem = (item: AttractionRecommendation) => {
            streamedItems.push(item);
            onItem(item);
        };

        try {
            if (this.delegate.getRecommendationsStream) {
                await this.delegate.getRecommendationsStream(location, interests, category, excludeNames, forwardItem, userId, apiSecret, language, titleLanguage, count);
            } else {
                const items = await this.delegate.getRecommendations(location, interests, category, excludeNames, userId, apiSecret, language, titleLanguage);
                items.forEach(forwardItem);
            }

            await this.writeLog('GET_RECOMMENDATIONS', request, userId, startedAt, streamedItems);
        } catch (error) {
            await this.writeLog('GET_RECOMMENDATIONS', request, userId, startedAt, streamedItems, null, error);
            throw error;
        }
    }

    async checkFeasibility(currentData: TripData, modificationContext: string, userId?: string, apiSecret?: string, language?: string): Promise<FeasibilityResult> {
        const request = { tripData: currentData, modificationContext, language };
        const startedAt = Date.now();

        try {
            const result = await this.delegate.checkFeasibility(currentData, modificationContext, userId, apiSecret, language);
            await this.writeLog('CHECK_FEASIBILITY', request, userId, startedAt, result);
            return result;
        } catch (error) {
            await this.writeLog('CHECK_FEASIBILITY', request, userId, startedAt, undefined, null, error);
            throw error;
        }
    }

    async updateTripWithExplorer(
        currentData: TripData,
        dayIndex: number,
        newMustVisit: string[],
        newAvoid: string[],
        keepExisting: string[],
        removeExisting: string[],
        onThought?: (text: string) => void,
        userId?: string,
        apiSecret?: string,
        language?: string,
        tripLanguage?: string
    ): Promise<UpdateResult> {
        const request = { currentData, dayIndex, newMustVisit, newAvoid, keepExisting, removeExisting, language, tripLanguage };
        const startedAt = Date.now();

        try {
            const result = await this.delegate.updateTripWithExplorer(currentData, dayIndex, newMustVisit, newAvoid, keepExisting, removeExisting, onThought, userId, apiSecret, language, tripLanguage);
            await this.writeLog('EXPLORER_UPDATE', request, userId, startedAt, {
                responseText: result.responseText,
                updatedData: result.updatedData ?? null,
            }, result.responseText || null);
            return result;
        } catch (error) {
            await this.writeLog('EXPLORER_UPDATE', request, userId, startedAt, undefined, null, error);
            throw error;
        }
    }
}

export function unwrapLoggedProvider(provider: IAIProvider): IAIProvider {
    return provider instanceof LoggedAIProvider ? provider.getInnerProvider() : provider;
}