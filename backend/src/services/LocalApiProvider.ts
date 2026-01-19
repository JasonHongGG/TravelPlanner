
import { IAIProvider, TripInput, TripData, Message, AttractionRecommendation, FeasibilityResult, UpdateResult } from "./aiProvider";
import { SERVICE_CONFIG } from "../config/serviceConfig";

// Provider for Custom Local API
export class LocalApiProvider implements IAIProvider {
    private baseUrl: string;

    constructor() {
        // SERVICE_CONFIG.local_api.baseUrl might be relative '/local-api' if it was designed for frontend proxy.
        // If running on backend, we need the absolute URL. 
        // We'll assume if it starts with /, it needs a host prefix (e.g. from env or default python server port 8000).
        let url = SERVICE_CONFIG.local_api.baseUrl;
        if (url.startsWith('/')) {
            url = `http://localhost:8000${url}`;
        }
        this.baseUrl = url;
    }

    private async callApi(endpoint: string, body: any) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Local API Error ${response.status}: ${text}`);
            }
            return response.json();
        } catch (e) {
            console.error("Local API Call Failed:", e);
            throw e;
        }
    }

    async generateTrip(input: TripInput, userId?: string, apiSecret?: string): Promise<TripData> {
        // Assume Local API has a /generate endpoint matching our needs
        // Logic depends on the external Local API implementation. 
        // For now, mirroring the standard payload structure.
        const result = await this.callApi('/generate', {
            input,
            model: SERVICE_CONFIG.local_api.models.tripGenerator
        });
        return result as TripData;
    }

    async updateTrip(
        currentData: TripData,
        history: Message[],
        onThought?: (text: string) => void,
        userId?: string,
        apiSecret?: string,
        language?: string
    ): Promise<UpdateResult> {
        // Streaming support? Local API might stream.
        // For simple implementation, assuming non-streaming first or standard text response.
        const result = await this.callApi('/update', {
            currentData,
            history,
            model: SERVICE_CONFIG.local_api.models.tripUpdater,
            language
        });
        return { responseText: result.responseText, updatedData: result.updatedData };
    }

    async getRecommendations(
        location: string,
        interests: string,
        category: "attraction" | "food",
        excludeNames?: string[],
        userId?: string,
        apiSecret?: string,
        language?: string
    ): Promise<AttractionRecommendation[]> {
        const result = await this.callApi('/recommend', {
            location,
            interests,
            category,
            excludeNames,
            model: SERVICE_CONFIG.local_api.models.recommender,
            language
        });
        return result as AttractionRecommendation[];
    }

    async checkFeasibility(
        currentData: TripData,
        modificationContext: string,
        userId?: string,
        apiSecret?: string,
        language?: string
    ): Promise<FeasibilityResult> {
        const result = await this.callApi('/feasibility', {
            currentData,
            modificationContext,
            model: SERVICE_CONFIG.local_api.models.recommender,
            language
        });
        return result as FeasibilityResult;
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
        language?: string
    ): Promise<UpdateResult> {
        const result = await this.callApi('/explorer-update', {
            currentData,
            dayIndex,
            newMustVisit,
            newAvoid,
            keepExisting,
            removeExisting,
            model: SERVICE_CONFIG.local_api.models.tripUpdater,
            language
        });
        return { responseText: result.responseText, updatedData: result.updatedData };
    }
}
