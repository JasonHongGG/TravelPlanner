
import { TripData, TripInput, Message, AttractionRecommendation, FeasibilityResult } from "../types";

export type { TripData, TripInput, Message, AttractionRecommendation, FeasibilityResult };

export interface UpdateResult {
    responseText: string;
    updatedData?: TripData;
}

export interface IAIProvider {
    generateTrip(input: TripInput, userId?: string, apiSecret?: string): Promise<TripData>;
    updateTrip(currentData: TripData, history: Message[], onThought?: (text: string) => void, userId?: string, apiSecret?: string, language?: string): Promise<UpdateResult>;
    getRecommendations(location: string, interests: string, category: 'attraction' | 'food', excludeNames?: string[], userId?: string, apiSecret?: string, language?: string): Promise<AttractionRecommendation[]>;
    checkFeasibility(currentData: TripData, modificationContext: string, userId?: string, apiSecret?: string, language?: string): Promise<FeasibilityResult>;
    updateTripWithExplorer(
        currentData: TripData,
        dayIndex: number,
        newMustVisit: string[],
        newAvoid: string[],
        keepExisting: string[],
        removeExisting: string[],
        onThought?: (text: string) => void,
        userId?: string,
        apiSecret?: string,
        language?: string
    ): Promise<UpdateResult>;
}
