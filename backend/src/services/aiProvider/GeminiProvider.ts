import { GoogleGenAI, Type } from "@google/genai";
import { IAIProvider, TripInput, TripData, Message, AttractionRecommendation, FeasibilityResult, UpdateResult } from "./aiProvider.js";
import {
    SYSTEM_INSTRUCTION,
    constructTripPrompt,
    constructUpdatePrompt,
    constructRecommendationPrompt,
    constructFeasibilityPrompt,
    constructExplorerUpdatePrompt,
    constructAdvisoryPrompt
} from "../../config/aiConfig.js";
import { SERVICE_CONFIG } from "../../config/serviceConfig.js";

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
        if (updates.advisory) newData.advisory = updates.advisory;

        return newData;
    }

    async generateTrip(input: TripInput, userId?: string, apiSecret?: string): Promise<TripData> {
        const ai = this.getClient();
        const prompt = constructTripPrompt(input);

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

    async getRecommendations(
        location: string,
        interests: string,
        category: 'attraction' | 'food' = 'attraction',
        excludeNames: string[] = [],
        userId?: string,
        apiSecret?: string,
        language: string = "Traditional Chinese",
        titleLanguage?: string
    ): Promise<AttractionRecommendation[]> {
        const ai = this.getClient();
        const prompt = constructRecommendationPrompt(location, interests, category, excludeNames, language, titleLanguage);

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

    async getRecommendationsStream(
        location: string,
        interests: string,
        category: 'attraction' | 'food' = 'attraction',
        excludeNames: string[] = [],
        onItem: (item: AttractionRecommendation) => void,
        userId?: string,
        apiSecret?: string,
        language: string = "Traditional Chinese",
        titleLanguage?: string,
        count?: number
    ): Promise<void> {
        const ai = this.getClient();
        const prompt = constructRecommendationPrompt(location, interests, category, excludeNames, language, titleLanguage, count || 12);

        const responseStream = await ai.models.generateContentStream({
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

        let buffer = "";
        let bracketCount = 0;
        let inObject = false;
        let objectStart = -1;

        for await (const chunk of responseStream) {
            const text = chunk.text || "";

            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                buffer += char;

                if (char === '{') {
                    if (!inObject) {
                        inObject = true;
                        objectStart = buffer.length - 1;
                    }
                    bracketCount++;
                } else if (char === '}') {
                    bracketCount--;

                    if (inObject && bracketCount === 0) {
                        // Complete object found
                        const objectStr = buffer.substring(objectStart);
                        try {
                            const item = JSON.parse(objectStr) as AttractionRecommendation;
                            onItem(item);
                        } catch (e) {
                            console.error("Failed to parse streamed recommendation object:", e);
                        }
                        inObject = false;
                        objectStart = -1;
                    }
                }
            }
        }
    }

    async generateAdvisory(
        tripData: TripData,
        userId?: string,
        apiSecret?: string,
        language?: string
    ): Promise<any> {
        const ai = this.getClient();
        const prompt = constructAdvisoryPrompt(tripData, language);

        const response = await ai.models.generateContent({
            model: SERVICE_CONFIG.gemini.models.tripGenerator,
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });

        return this.parseJsonFromResponse(response.text || "{}", false);
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
