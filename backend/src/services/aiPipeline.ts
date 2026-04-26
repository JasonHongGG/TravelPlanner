import type { AttractionRecommendation, FeasibilityResult, Message, TripData, TripInput } from '../types.js';
import type { UpdateResult } from './aiProvider/aiProvider.js';
import { BackendAIService } from './BackendAIService.js';

export type AiAction = 'GENERATE_TRIP' | 'GET_RECOMMENDATIONS' | 'CHECK_FEASIBILITY' | 'GENERATE_ADVISORY' | 'CHAT_UPDATE' | 'EXPLORER_UPDATE';

export class AiPipeline {
    async generateTrip(input: TripInput, userId?: string, authToken?: string): Promise<TripData> {
        return BackendAIService.getProvider().generateTrip(input, userId, authToken);
    }

    async generateAdvisory(tripData: TripData, userId?: string, authToken?: string, language?: string): Promise<any> {
        const provider = BackendAIService.getProvider();
        if (!provider.generateAdvisory) throw new Error('Advisory generation is not supported by the active provider.');
        return provider.generateAdvisory(tripData, userId, authToken, language);
    }

    async checkFeasibility(tripData: TripData, modificationContext: string, userId?: string, authToken?: string, language?: string): Promise<FeasibilityResult> {
        return BackendAIService.getProvider().checkFeasibility(tripData, modificationContext, userId, authToken, language);
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
        return BackendAIService.getProvider().updateTrip(currentData, history, onThought, userId, authToken, language, tripLanguage);
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
        return BackendAIService.getProvider().updateTripWithExplorer(
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
        return BackendAIService.getProvider().getRecommendations(location, interests, category, excludeNames, userId, authToken, language, titleLanguage);
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
        const provider = BackendAIService.getProvider();
        if (provider.getRecommendationsStream) {
            await provider.getRecommendationsStream(location, interests, category, excludeNames, onItem, userId, authToken, language, titleLanguage, count);
            return;
        }

        const items = await provider.getRecommendations(location, interests, category, excludeNames, userId, authToken, language, titleLanguage);
        for (const item of items) onItem(item);
    }
}

export const aiPipeline = new AiPipeline();
