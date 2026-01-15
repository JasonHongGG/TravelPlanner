
import { TripInput, TripData, Message, AttractionRecommendation, FeasibilityResult } from "../types";
import {
    SYSTEM_INSTRUCTION,
    constructTripPrompt,
    constructUpdatePrompt,
    constructRecommendationPrompt,
    constructFeasibilityPrompt
} from "../config/aiConfig";
import { SERVICE_CONFIG } from "../config/serviceConfig";
import { IAIService, UpdateResult } from "./aiInterface";

const SERVER_URL = "http://localhost:3001";

export class CopilotService implements IAIService {

    // Helper to cleanup JSON string
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
                    // throw new Error("Response is missing required trip data fields (tripMeta or days).");
                    // Relaxed check for now as some partials might not have it all
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

    private async postGenerate(prompt: string, model: string, systemInstruction?: string): Promise<string> {
        const response = await fetch(`${SERVER_URL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model, systemInstruction })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(err.error || `Server error: ${response.status}`);
        }

        const data = await response.json();
        return data.text;
    }

    async generateTrip(input: TripInput): Promise<TripData> {
        const prompt = constructTripPrompt(input);
        const model = SERVICE_CONFIG.copilot?.models.tripGenerator || 'gpt-4o';

        const responseText = await this.postGenerate(prompt, model, SYSTEM_INSTRUCTION);
        return this.parseJsonFromResponse(responseText, true);
    }

    async updateTrip(
        currentData: TripData,
        history: Message[],
        onThought?: ((text: string) => void) | undefined
    ): Promise<UpdateResult> {
        const prompt = constructUpdatePrompt(currentData, history);
        const model = SERVICE_CONFIG.copilot?.models.tripUpdater || 'gpt-4o';

        // Use SSE for streaming updates
        const response = await fetch(`${SERVER_URL}/stream-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model, systemInstruction: SYSTEM_INSTRUCTION })
        });

        if (!response.ok || !response.body) {
            throw new Error("Failed to connect to streaming endpoint");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let isJsonMode = false;
        let jsonBuffer = "";
        const delimiter = "___UPDATE_JSON___";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkStr = decoder.decode(value);
            const lines = chunkStr.split('\n\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6);
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.type === 'content') {
                            const text = data.chunk;
                            if (!isJsonMode) {
                                fullText += text;
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
                                jsonBuffer += text;
                            }
                        } else if (data.type === 'error') {
                            throw new Error(data.message);
                        } else if (data.type === 'done') {
                            // Stream complete
                        }
                    } catch (e) {
                        // ignore parse errors for partial lines or empty keep-alives
                    }
                }
            }
        }

        if (isJsonMode) {
            // Basic JSON cleanup if needed (some LLMs add markdown blocks)
            let cleanJson = jsonBuffer.trim();
            if (cleanJson.startsWith('```json')) cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '');

            const partialUpdate = this.parseJsonFromResponse(cleanJson, false);
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
        category?: "attraction" | "food",
        excludeNames?: string[]
    ): Promise<AttractionRecommendation[]> {
        const prompt = constructRecommendationPrompt(location, interests, category || 'attraction', excludeNames || []);
        const model = SERVICE_CONFIG.copilot?.models.recommender || 'gpt-4o';

        const responseText = await this.postGenerate(prompt, model);

        try {
            const firstBracket = responseText.indexOf('[');
            const lastBracket = responseText.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1) {
                const jsonStr = responseText.substring(firstBracket, lastBracket + 1);
                return JSON.parse(jsonStr);
            }
            return [];
        } catch (e) {
            console.error("Failed to parse recommendations", e);
            return [];
        }
    }

    async checkFeasibility(
        currentData: TripData,
        modificationContext: string
    ): Promise<FeasibilityResult> {
        const prompt = constructFeasibilityPrompt(currentData, modificationContext);
        const model = SERVICE_CONFIG.copilot?.models.recommender || 'gpt-4o';

        const responseText = await this.postGenerate(prompt, model);

        try {
            return this.parseJsonFromResponse(responseText, false);
        } catch (e) {
            console.error("Failed to parse feasibility check", e);
            return { feasible: true, riskLevel: 'low', issues: [], suggestions: [] };
        }
    }
}
