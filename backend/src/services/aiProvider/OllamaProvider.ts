import { IAIProvider, TripInput, TripData, Message, AttractionRecommendation, FeasibilityResult, UpdateResult } from "./aiProvider";
import {
    SYSTEM_INSTRUCTION,
    constructTripPrompt,
    constructUpdatePrompt,
    constructRecommendationPrompt,
    constructFeasibilityPrompt,
    constructExplorerUpdatePrompt,
    constructAdvisoryPrompt
} from "../../config/aiConfig";
import { SERVICE_CONFIG } from "../../config/serviceConfig";

export class OllamaProvider implements IAIProvider {
    private baseUrl: string;

    constructor() {
        this.baseUrl = SERVICE_CONFIG.ollama.baseUrl;
    }

    private cleanJsonString(text: string) {
        return text.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    private parseJsonFromOllama(text: string, strict = true): any {
        try {
            const cleaned = this.cleanJsonString(text);
            const start = cleaned.search(/[{[]/);
            const end = cleaned.lastIndexOf(cleaned[start] === '{' ? '}' : ']');

            if (start === -1 || end === -1) throw new Error("No JSON found in Ollama response");

            return JSON.parse(cleaned.substring(start, end + 1));
        } catch (e) {
            console.error("Ollama JSON Parse Error", e);
            if (strict) throw e;
            return {};
        }
    }

    private async callOllama(messages: { role: string, content: string }[], model: string, format = 'json', stream = false) {
        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    format: format === 'json' ? 'json' : undefined,
                    stream: stream,
                    options: {
                        temperature: 0.7,
                        num_ctx: 8192
                    }
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Ollama API Error (${response.status}): ${errText}`);
            }
            return response;
        } catch (error: any) {
            console.error("Network connection to Ollama failed:", error);
            throw error;
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

    async generateTrip(input: TripInput): Promise<TripData> {
        const prompt = constructTripPrompt(input);
        const messages = [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            { role: 'user', content: prompt }
        ];

        try {
            const response = await this.callOllama(messages, SERVICE_CONFIG.ollama.models.tripGenerator, 'json', false);
            const data = await response.json();
            return this.parseJsonFromOllama(data.message.content) as TripData;
        } catch (error: any) {
            console.error("Ollama Generation Error:", error);
            throw new Error(error.message);
        }
    }

    async generateAdvisory(tripData: TripData, userId?: string, apiSecret?: string, language?: string): Promise<any> {
        const prompt = constructAdvisoryPrompt(tripData, language);
        const messages = [
            { role: 'user', content: prompt }
        ];

        try {
            const response = await this.callOllama(messages, SERVICE_CONFIG.ollama.models.tripGenerator, 'json', false);
            const data = await response.json();
            return this.parseJsonFromOllama(data.message.content, false);
        } catch (error: any) {
            console.error("Ollama Advisory Error:", error);
            throw new Error(error.message);
        }
    }

    async updateTrip(
        currentData: TripData,
        history: Message[],
        onThought?: (text: string) => void,
        userId?: string,
        apiSecret?: string,
        language: string = "Traditional Chinese"
    ): Promise<UpdateResult> {
        const prompt = constructUpdatePrompt(currentData, history, language);
        const messages = [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            { role: 'user', content: prompt }
        ];

        try {
            const response = await this.callOllama(messages, SERVICE_CONFIG.ollama.models.tripUpdater, 'json', true);

            if (!response.body) throw new Error("Failed to read Ollama stream");

            const decoder = new TextDecoder();
            let fullText = "";
            let isJsonMode = false;
            let jsonBuffer = "";
            const delimiter = "___UPDATE_JSON___";

            // @ts-ignore
            for await (const chunk of response.body) {
                const chunkStr = decoder.decode(chunk as Buffer);
                const lines = chunkStr.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);
                        if (json.done) continue;

                        const textContent = json.message?.content || "";

                        if (!isJsonMode) {
                            fullText += textContent;
                            const delimiterIndex = fullText.indexOf(delimiter);

                            if (delimiterIndex !== -1) {
                                isJsonMode = true;
                                const thoughtPart = fullText.substring(0, delimiterIndex);
                                if (onThought) onThought(thoughtPart);
                                jsonBuffer = fullText.substring(delimiterIndex + delimiter.length);
                            } else {
                                if (onThought) onThought(fullText);
                            }
                        } else {
                            jsonBuffer += textContent;
                        }

                    } catch (e) { /* Ignore partial chunk map errors */ }
                }
            }

            if (isJsonMode) {
                const partialUpdate = this.parseJsonFromOllama(jsonBuffer, false);
                const updatedData = this.mergeTripData(currentData, partialUpdate);
                return {
                    responseText: fullText.split(delimiter)[0],
                    updatedData: updatedData
                };
            } else {
                return { responseText: fullText };
            }

        } catch (error) {
            console.error("Ollama Update Error:", error);
            throw error;
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
        const prompt = constructRecommendationPrompt(location, interests, category, excludeNames, language);
        const messages = [
            { role: 'user', content: prompt }
        ];

        try {
            const response = await this.callOllama(messages, SERVICE_CONFIG.ollama.models.recommender, 'json', false);
            const data = await response.json();
            const parsed = this.parseJsonFromOllama(data.message.content, false);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("Ollama Recommendation Error:", error);
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
        const prompt = constructFeasibilityPrompt(currentData, modificationContext, language);
        const messages = [
            { role: 'user', content: prompt }
        ];

        try {
            const response = await this.callOllama(messages, SERVICE_CONFIG.ollama.models.recommender, 'json', false);
            const data = await response.json();
            return this.parseJsonFromOllama(data.message.content, false);
        } catch (e) {
            console.error("Ollama Feasibility Error", e);
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
        const prompt = constructExplorerUpdatePrompt(dayIndex, newMustVisit, newAvoid, keepExisting, removeExisting);
        const messages = [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            { role: 'user', content: prompt }
        ];

        try {
            const response = await this.callOllama(messages, SERVICE_CONFIG.ollama.models.tripUpdater, 'json', true);

            if (!response.body) throw new Error("Failed to read Ollama stream");

            const decoder = new TextDecoder();
            let fullText = "";
            let isJsonMode = false;
            let jsonBuffer = "";
            const delimiter = "___UPDATE_JSON___";

            // @ts-ignore
            for await (const chunk of response.body) {
                const chunkStr = decoder.decode(chunk as Buffer);
                const lines = chunkStr.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);
                        if (json.done) continue;

                        const textContent = json.message?.content || "";

                        if (!isJsonMode) {
                            fullText += textContent;
                            const delimiterIndex = fullText.indexOf(delimiter);

                            if (delimiterIndex !== -1) {
                                isJsonMode = true;
                                const thoughtPart = fullText.substring(0, delimiterIndex);
                                if (onThought) onThought(thoughtPart);
                                jsonBuffer = fullText.substring(delimiterIndex + delimiter.length);
                            } else {
                                if (onThought) onThought(fullText);
                            }
                        } else {
                            jsonBuffer += textContent;
                        }

                    } catch (e) { /* Ignore */ }
                }
            }

            if (isJsonMode) {
                const partialUpdate = this.parseJsonFromOllama(jsonBuffer, false);
                const updatedData = this.mergeTripData(currentData, partialUpdate);
                return {
                    responseText: fullText.split(delimiter)[0],
                    updatedData: updatedData
                };
            } else {
                return { responseText: fullText };
            }

        } catch (error) {
            console.error("Ollama Explorer Update Error:", error);
            throw error;
        }
    }
}
