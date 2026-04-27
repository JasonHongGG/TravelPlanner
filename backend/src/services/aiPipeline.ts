import type { AttractionRecommendation, FeasibilityResult, Message, TripData, TripInput } from '../types.js';
import type { IAIProvider, UpdateResult } from './aiProvider/aiProvider.js';
import { BackendAIService } from './BackendAIService.js';

export type AiAction = 'GENERATE_TRIP' | 'GET_RECOMMENDATIONS' | 'CHECK_FEASIBILITY' | 'GENERATE_ADVISORY' | 'CHAT_UPDATE' | 'EXPLORER_UPDATE';
type ProviderResolver = () => IAIProvider;

export class AiPipeline {
    constructor(private readonly resolveProvider: ProviderResolver = () => BackendAIService.getProvider()) { }

    private get provider(): IAIProvider {
        return this.resolveProvider();
    }

    async generateTrip(input: TripInput, userId?: string, authToken?: string): Promise<TripData> {
        return this.provider.generateTrip(input, userId, authToken);
    }

    async generateAdvisory(tripData: TripData, userId?: string, authToken?: string, language?: string): Promise<any> {
        if (!this.provider.generateAdvisory) throw new Error('Advisory generation is not supported by the active provider.');
        return this.provider.generateAdvisory(tripData, userId, authToken, language);
    }

    async checkFeasibility(tripData: TripData, modificationContext: string, userId?: string, authToken?: string, language?: string): Promise<FeasibilityResult> {
        return this.provider.checkFeasibility(tripData, modificationContext, userId, authToken, language);
    }

    async updateTrip(
        currentData: TripData,
        history: Message[],
        onThought: (text: string) => void,
        userId?: string,
        authToken?: string,
        language?: string,
        tripLanguage?: string
    ): Promise<UpdateResult> {
        return this.provider.updateTrip(currentData, history, onThought, userId, authToken, language, tripLanguage);
    }

    async updateTripWithExplorer(
        currentData: TripData,
        dayIndex: number,
        newMustVisit: string[],
        newAvoid: string[],
        keepExisting: string[],
        removeExisting: string[],
        onThought: (text: string) => void,
        userId?: string,
        authToken?: string,
        language?: string,
        tripLanguage?: string
    ): Promise<UpdateResult> {
        return this.provider.updateTripWithExplorer(
            currentData,
            dayIndex,
            newMustVisit,
            newAvoid,
            keepExisting,
            removeExisting,
            onThought,
            userId,
            authToken,
            language,
            tripLanguage
        );
    }

    async getRecommendations(
        location: string,
        interests: string,
        category: 'attraction' | 'food',
        excludeNames: string[] = [],
        userId?: string,
        authToken?: string,
        language?: string,
        titleLanguage?: string
    ): Promise<AttractionRecommendation[]> {
        return this.provider.getRecommendations(location, interests, category, excludeNames, userId, authToken, language, titleLanguage);
    }

    async streamRecommendations(
        location: string,
        interests: string,
        category: 'attraction' | 'food',
        excludeNames: string[],
        onItem: (item: AttractionRecommendation) => void,
        userId?: string,
        authToken?: string,
        language?: string,
        titleLanguage?: string,
        count?: number
    ): Promise<void> {
        if (this.provider.getRecommendationsStream) {
            await this.provider.getRecommendationsStream(location, interests, category, excludeNames, onItem, userId, authToken, language, titleLanguage, count);
            return;
        }

        const items = await this.provider.getRecommendations(location, interests, category, excludeNames, userId, authToken, language, titleLanguage);
        for (const item of items) onItem(item);
    }
}

export const aiPipeline = new AiPipeline();
