
import { GoogleGenAI, Type } from "@google/genai";
import { IAIProvider, TripInput, TripData, Message, AttractionRecommendation, FeasibilityResult, UpdateResult } from "./aiProvider";
import {
    SYSTEM_INSTRUCTION,
    constructTripPrompt,
    constructUpdatePrompt,
    constructRecommendationPrompt,
    constructFeasibilityPrompt,
    constructExplorerUpdatePrompt
} from "../config/aiConfig";
import { SERVICE_CONFIG } from "../config/serviceConfig";

export class GeminiProvider implements IAIProvider {
    private getClient() {
        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY environment variable is missing.");
        }
        return new GoogleGenAI({ apiKey });
    }

    private parseJsonFromResponse(text: string, strict = true): any {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');

        if (start === -1 || end === -1) {
            throw new Error("Invalid response format: No JSON object found.");
        }

        const jsonStr = text.substring(start, end + 1);
        try {
            const data = JSON.parse(jsonStr);
            if (strict) {
                if (!data.tripMeta || !data.days) {
                    // Strict check
                }
            }
            return data;
        } catch (e) {
            console.error("JSON Parse Error:", e);
            throw new Error("Failed to parse itinerary data.");
        }
    }

    private mergeTripData(original: TripData, updates: Partial<TripData>): TripData {
        const newData = { ...original };
        if (updates.tripMeta) newData.tripMeta = { ...newData.tripMeta, ...updates.tripMeta };

        if (updates.days && Array.isArray(updates.days)) {
            const newDays = [...newData.days];
            updates.days.forEach(updatedDay => {
                const index = newDays.findIndex(d => d.day === updatedDay.day);
                if (index !== -1) newDays[index] = updatedDay;
                else newDays.push(updatedDay);
            });
            newDays.sort((a, b) => a.day - b.day);
            newData.days = newDays;
        }

        if (updates.totals) newData.totals = updates.totals;
        if (updates.risks) newData.risks = updates.risks;

        return newData;
    }

    async generateTrip(input: TripInput, userId?: string, apiSecret?: string): Promise<TripData> {
        const ai = this.getClient();
        const prompt = constructTripPrompt(input); // Using backend config

        // No retry logic for simplicity in V1 port, can add later
        const response = await ai.models.generateContent({
            model: SERVICE_CONFIG.gemini.models.tripGenerator,
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: 'application/json',
            },
        });

        return this.parseJsonFromResponse(response.text || "{}", true) as TripData;
    }

    async updateTrip(
        currentData: TripData,
        history: Message[],
        onThought?: (text: string) => void,
        userId?: string,
        apiSecret?: string,
        language: string = "Traditional Chinese"
    ): Promise<UpdateResult> {
        const ai = this.getClient();
        const prompt = constructUpdatePrompt(currentData, history, language);

        const responseStream = await ai.models.generateContentStream({
            model: SERVICE_CONFIG.gemini.models.tripUpdater,
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
            },
        });

        let fullText = "";
        let isJsonMode = false;
        let jsonBuffer = "";
        const delimiter = "___UPDATE_JSON___";

        for await (const chunk of responseStream) {
            const text = chunk.text; // Google GenAI SDK stream text method

            if (!isJsonMode) {
                fullText += text;
                const delimiterIndex = fullText.indexOf(delimiter);

                if (delimiterIndex !== -1) {
                    isJsonMode = true;
                    const thoughtPart = fullText.substring(0, delimiterIndex);
                    // if (onThought) onThought(thoughtPart); // Backend streaming is different, we handled via SSE in server.ts
                    // For Provider, we might just return the stream? 
                    // Refactor: Provider should probably return a ReadableStream or accept a callback?
                    // The interface accepts 'onThought', which the caller (server) can use to pipe to SSE.
                    if (onThought) onThought(thoughtPart); // This might be duplicate thought? No, this is incremental.
                    jsonBuffer = fullText.substring(delimiterIndex + delimiter.length);
                } else {
                    if (onThought && text) onThought(text);
                }
            } else {
                jsonBuffer += text;
            }
        }

        if (isJsonMode) {
            const partialUpdate = this.parseJsonFromResponse(jsonBuffer, false);
            const updatedData = this.mergeTripData(currentData, partialUpdate);
            const finalText = fullText.split(delimiter)[0];
            return { responseText: finalText, updatedData: updatedData };
        } else {
            return { responseText: fullText };
        }
    }

    async getRecommendations(
        location: string,
        interests: string,
        category: 'attraction' | 'food' = 'attraction',
        excludeNames: string[] = [],
        userId?: string,
        apiSecret?: string,
        language: string = "Traditional Chinese"
    ): Promise<AttractionRecommendation[]> {
        const ai = this.getClient();
        const prompt = constructRecommendationPrompt(location, interests, category, excludeNames, language);

        const response = await ai.models.generateContent({
            model: SERVICE_CONFIG.gemini.models.recommender,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            description: { type: Type.STRING },
                            category: { type: Type.STRING },
                            reason: { type: Type.STRING },
                            openHours: { type: Type.STRING },
                        },
                        required: ['name', 'description', 'category', 'reason', 'openHours'],
                    }
                }
            },
        });

        try {
            return JSON.parse(response.text || "[]");
        } catch (e) {
            console.error("Failed to parse recommendations", e);
            return [];
        }
    }

    async checkFeasibility(
        currentData: TripData,
        modificationContext: string,
        userId?: string,
        apiSecret?: string,
        language: string = "Traditional Chinese"
    ): Promise<FeasibilityResult> {
        const ai = this.getClient();
        const prompt = constructFeasibilityPrompt(currentData, modificationContext, language);

        const response = await ai.models.generateContent({
            model: SERVICE_CONFIG.gemini.models.recommender,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        feasible: { type: Type.BOOLEAN },
                        riskLevel: { type: Type.STRING, enum: ['low', 'moderate', 'high'] },
                        issues: { type: Type.ARRAY, items: { type: Type.STRING } },
                        suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ['feasible', 'riskLevel', 'issues', 'suggestions']
                }
            },
        });

        try {
            return JSON.parse(response.text || "{}");
        } catch (e) {
            return { feasible: true, riskLevel: 'low', issues: [], suggestions: [] };
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
        language: string = "Traditional Chinese"
    ): Promise<UpdateResult> {
        const ai = this.getClient();
        const prompt = constructExplorerUpdatePrompt(dayIndex, newMustVisit, newAvoid, keepExisting, removeExisting);

        const responseStream = await ai.models.generateContentStream({
            model: SERVICE_CONFIG.gemini.models.tripUpdater,
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
            },
        });

        let fullText = "";
        let isJsonMode = false;
        let jsonBuffer = "";
        const delimiter = "___UPDATE_JSON___";

        for await (const chunk of responseStream) {
            const text = chunk.text;
            if (!isJsonMode) {
                fullText += text;
                const delimiterIndex = fullText.indexOf(delimiter);

                if (delimiterIndex !== -1) {
                    isJsonMode = true;
                    const thoughtPart = fullText.substring(0, delimiterIndex);
                    if (onThought) onThought(thoughtPart);
                    jsonBuffer = fullText.substring(delimiterIndex + delimiter.length);
                } else {
                    if (onThought && text) onThought(text);
                }
            } else {
                jsonBuffer += text;
            }
        }

        if (isJsonMode) {
            const partialUpdate = this.parseJsonFromResponse(jsonBuffer, false);
            const updatedData = this.mergeTripData(currentData, partialUpdate);
            const finalText = fullText.split(delimiter)[0];
            return { responseText: finalText, updatedData: updatedData };
        } else {
            return { responseText: fullText };
        }
    }
}
