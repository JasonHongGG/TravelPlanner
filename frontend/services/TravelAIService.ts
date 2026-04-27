import { TripInput, TripData, Message, AttractionRecommendation, FeasibilityResult, UpdateResult } from "../types";
import { parseErrorResponse } from "./http/parseError";
import { apiUrl, getAuthHeaders, requestJson } from "./http/apiClient";
import { openSsePost, streamJsonEvents } from "./http/sseClient";
import { mergeTripData, parseJsonFromText } from "./travelAiResponse";

export type GenerationJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface GenerationJob {
    jobId: string;
    action: 'GENERATE_TRIP';
    userId: string;
    tripLocalId?: string;
    clientRequestId: string;
    tripInput: TripInput;
    status: GenerationJobStatus;
    billingStatus: 'pending' | 'charged' | 'charge_failed';
    hasResult?: boolean;
    result?: TripData;
    error?: string;
    createdAt: number;
    updatedAt: number;
    startedAt?: number;
    finishedAt?: number;
}

export interface ClaimedGenerationJob {
    jobId: string;
    status: 'completed';
    claimToken: string;
    result: TripData;
}

export class TravelAIService {
    private async streamAndAccumulate(
        endpoint: string,
        body: any,
        onChunk?: (text: string) => void,
        onPlanningStart?: () => void
    ): Promise<string> {
        const response = await openSsePost(endpoint, body, 'Server error');
        let fullText = "";

        await streamJsonEvents(response, (data) => {
            if (data.type === 'chunk' || data.type === 'content') {
                const text = data.chunk;
                fullText += text;
                if (onChunk) onChunk(text);

                if (fullText.includes("___UPDATE_JSON___") && onPlanningStart) {
                    onPlanningStart();
                }
            } else if (data.type === 'error') {
                throw new Error(data.message);
            }
        });
        return fullText;
    }

    private async postGenerate(
        action: string,
        description: string,
        bodyParams: any
    ): Promise<string> {
        const body = {
            action,
            description,
            ...bodyParams
        };
        const data = await requestJson<{ text: string }>('/generate', { method: 'POST', body, fallbackMessage: 'Server error' });
        return data.text;
    }

    async createGenerationJob(
        input: TripInput,
        userId?: string,
        options?: {
            tripLocalId?: string;
            clientRequestId?: string;
        }
    ): Promise<GenerationJob> {
        return await requestJson<GenerationJob>('/generation-jobs', {
            method: 'POST',
            fallbackMessage: 'Failed to create generation job',
            body: {
                userId,
                action: 'GENERATE_TRIP',
                description: `Generate Trip: ${input.destination}`,
                tripInput: input,
                tripLocalId: options?.tripLocalId,
                clientRequestId: options?.clientRequestId || crypto.randomUUID()
            }
        });
    }

    async getGenerationJob(jobId: string): Promise<GenerationJob> {
        return await requestJson<GenerationJob>(`/generation-jobs/${jobId}`, { method: 'GET', fallbackMessage: 'Failed to fetch generation job' });
    }

    async claimGenerationJob(jobId: string): Promise<ClaimedGenerationJob> {
        return await requestJson<ClaimedGenerationJob>(`/generation-jobs/${jobId}/claim`, {
            method: 'POST',
            body: {},
            fallbackMessage: 'Failed to claim generation result'
        });
    }

    async ackGenerationJob(jobId: string, claimToken: string): Promise<void> {
        await requestJson(`/generation-jobs/${jobId}/ack`, {
            method: 'POST',
            body: { claimToken },
            fallbackMessage: 'Failed to acknowledge generation result'
        });
    }

    async generateTrip(input: TripInput, userId?: string): Promise<TripData> {
        // Model is determined by backend configuration
        const responseText = await this.streamAndAccumulate(
            '/stream-update',
            {
                userId,
                action: 'GENERATE_TRIP',
                description: `Generate Trip: ${input.destination}`,
                tripInput: input
            }
        );

        return parseJsonFromText<TripData>(responseText, 'Failed to parse itinerary data.');
    }

    async updateTrip(
        currentData: TripData,
        history: Message[],
        onThought?: ((text: string) => void) | undefined,
        userId?: string,
        language: string = "Traditional Chinese",
        tripLanguage: string = "Traditional Chinese",
        onPlanningStart?: () => void
    ): Promise<UpdateResult> {
        // Model is determined by backend configuration

        const response = await openSsePost('/stream-update', {
                // model removed, backend decides
                userId,
                action: 'CHAT_UPDATE',
                description: `Update Trip: ${history[history.length - 1]?.text.substring(0, 20)}...`,
                currentData,
                history: history.slice(-10),
                language,
                tripLanguage
            }, 'Server error');
        let fullText = "";
        let isJsonMode = false;
        let jsonBuffer = "";
        const delimiter = "___UPDATE_JSON___";
        const guardLength = delimiter.length - 1;
        let displayedText = "";

        const typewrite = async (newText: string) => {
            const delay = newText.length > 50 ? 5 : 15;
            for (const char of newText) {
                displayedText += char;
                if (onThought) onThought(displayedText);
                await new Promise(r => setTimeout(r, delay));
            }
        };

        await streamJsonEvents(response, async (data) => {
            if (data.type === 'content') {
                const text = data.chunk;

                if (!isJsonMode) {
                    fullText += text;
                    const delimiterIndex = fullText.indexOf(delimiter);

                    if (delimiterIndex !== -1) {
                        isJsonMode = true;

                        if (onPlanningStart) onPlanningStart();

                        const fullThought = fullText.substring(0, delimiterIndex);
                        const newThoughtPart = fullThought.substring(displayedText.length);

                        await typewrite(newThoughtPart);

                        jsonBuffer = fullText.substring(delimiterIndex + delimiter.length);
                    } else {
                        const safeEnd = Math.max(0, fullText.length - guardLength);
                        const safeText = fullText.substring(0, safeEnd);
                        const newThoughtPart = safeText.substring(displayedText.length);
                        if (newThoughtPart) {
                            await typewrite(newThoughtPart);
                        }
                    }
                } else {
                    fullText += text;
                    jsonBuffer += text;
                }
            } else if (data.type === 'error') {
                throw new Error(data.message);
            }
        });

        if (!isJsonMode) {
            const remainingText = fullText.substring(displayedText.length);
            if (remainingText) {
                await typewrite(remainingText);
            }
        }

        if (isJsonMode) {
            const partialUpdate = parseJsonFromText<Partial<TripData>>(jsonBuffer, 'Failed to parse itinerary update data.');
            const updatedData = mergeTripData(currentData, partialUpdate);
            const finalText = fullText.split(delimiter)[0].trim();
            const safeResponseText = finalText || "好的，已為您更新行程。";
            return { responseText: safeResponseText, updatedData: updatedData };
        } else {
            const safeResponseText = fullText.trim() || "抱歉，我無法處理您的請求，請再試一次。";
            return { responseText: safeResponseText };
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
        language?: string,
        tripLanguage?: string,
        onPlanningStart?: () => void
    ): Promise<UpdateResult> {
        const body = {
            action: 'EXPLORER_UPDATE',
            currentData,
            dayIndex,
            newMustVisit,
            newAvoid,
            keepExisting,
            removeExisting,
            language,
            tripLanguage
        };

        const responseText = await this.streamAndAccumulate('/stream-update', body, onThought, onPlanningStart);

        const delimiter = "___UPDATE_JSON___";
        const delimiterIndex = responseText.indexOf(delimiter);

        if (delimiterIndex !== -1) {
            const finalText = responseText.substring(0, delimiterIndex);
            const jsonPart = responseText.substring(delimiterIndex + delimiter.length);

            try {
                const partialUpdate = parseJsonFromText<Partial<TripData>>(jsonPart, 'Failed to parse explorer update data.');
                const mergedData = mergeTripData(currentData, partialUpdate);
                return { responseText: finalText, updatedData: mergedData };
            } catch (e) {
                console.error("Failed to parse explorer update JSON", e);
                return { responseText: responseText };
            }
        } else {
            return { responseText: responseText };
        }
    }

    async getRecommendations(
        location: string,
        interests: string,
        category: "attraction" | "food" = 'attraction',
        excludeNames: string[] = [],
        userId?: string,
        language: string = "Traditional Chinese",
        titleLanguage?: string
    ): Promise<AttractionRecommendation[]> {


        const responseText = await this.postGenerate(
            'GET_RECOMMENDATIONS',
            `Recommendations: ${location} (${category})`,
            { location, interests, category, excludeNames, language, titleLanguage }
        );

        try {
            // Recommendation endpoint returns { text: JSON_STRING }
            // So we just parse it.
            // But wait, the previous Gemini/Copilot service parsed it manually from potentially markdown-wrapped text.
            // Backend sends `res.json({ text: JSON.stringify(result) })` which is double encoded if result is an object?
            // "result = await provider.getRecommendations" -> returns OBJECT Array.
            // "res.json({ text: JSON.stringify(result) })" -> returns JSON object { text: "[...]" }
            // So responseText IS a JSON string of the array.
            return JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse recommendations", e);
            return [];
        }
    }

    async getRecommendationsStream(
        location: string,
        interests: string,
        category: "attraction" | "food" = 'attraction',
        excludeNames: string[] = [],
        onItem: (item: AttractionRecommendation) => void,
        userId?: string,
        language: string = "Traditional Chinese",
        titleLanguage?: string,
        options?: {
            mode?: 'init' | 'next',
            sessionId?: string,
            queueSize?: number,
            onSessionStart?: (sessionId: string) => void
        }
    ): Promise<void> {
        const headers = getAuthHeaders();
        const response = await fetch(apiUrl('/stream-recommendations'), {
            method: 'POST',
            headers,
            body: JSON.stringify({
                location,
                interests,
                category,
                excludeNames,
                language,
                titleLanguage,
                mode: options?.mode,
                sessionId: options?.sessionId,
                queueSize: options?.queueSize
            })
        });

        if (!response.ok) {
            // Handle Quota Exceeded specifically
            if (response.status === 402) {
                const errorData = await response.json();
                throw new Error(errorData.code || "QUOTA_EXCEEDED");
            }
            throw await parseErrorResponse(response, 'Server error');
        }

        if (!response.body) {
            throw new Error("Failed to connect to streaming endpoint");
        }

        await streamJsonEvents(response, (data) => {
            if (data.type === 'item' && data.item) {
                onItem(data.item);
            } else if (data.type === 'meta' && data.sessionId) {
                if (options?.onSessionStart) {
                    options.onSessionStart(data.sessionId);
                }
            } else if (data.type === 'error') {
                throw new Error(data.message);
            }
        });
    }

    async generateAdvisory(
        tripData: TripData,
        userId?: string,
        language: string = "Traditional Chinese"
    ): Promise<any> {
        const responseText = await this.postGenerate(
            'GENERATE_ADVISORY',
            `Generate Advisory for ${tripData.tripMeta.title || "Trip"}`,
            { tripData, language }
        );

        try {
            return JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse advisory", e);
            throw new Error("Failed to parse advisory data.");
        }
    }

    async checkFeasibility(
        currentData: TripData,
        modificationContext: string,
        userId?: string,
        language: string = "Traditional Chinese"
    ): Promise<FeasibilityResult> {


        const responseText = await this.postGenerate(
            'CHECK_FEASIBILITY',
            `Feasibility Check`,
            { tripData: currentData, modificationContext, language }
        );

        try {
            return JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse feasibility check", e);
            return { feasible: true, riskLevel: 'low', issues: [], suggestions: [] };
        }
    }
}
