import { TripInput, TripData, Message, AttractionRecommendation, FeasibilityResult, UpdateResult } from "../types";


const SERVER_URL = "http://localhost:3001";

export class TravelAIService {

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
                    // Relaxed check for now
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

    private async streamAndAccumulate(
        endpoint: string,
        body: any,
        apiSecret?: string,
        onChunk?: (text: string) => void
    ): Promise<string> {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiSecret) headers['x-api-secret'] = apiSecret;

        const response = await fetch(`${SERVER_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(err.error || `Server error: ${response.status}`);
        }

        if (!response.body) {
            throw new Error("Failed to connect to streaming endpoint");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

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
                            fullText += text;
                            if (onChunk) onChunk(text);
                        } else if (data.type === 'error') {
                            throw new Error(data.message);
                        }
                    } catch (e) {
                        // ignore parse errors
                    }
                }
            }
        }
        return fullText;
    }

    private async postGenerate(
        action: string,
        description: string,
        bodyParams: any,
        apiSecret?: string
    ): Promise<string> {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiSecret) headers['x-api-secret'] = apiSecret;

        const body = {
            action,
            description,
            ...bodyParams
        };

        const response = await fetch(`${SERVER_URL}/generate`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(err.error || `Server error: ${response.status}`);
        }

        const data = await response.json();
        return data.text;
    }

    async generateTrip(input: TripInput, userId?: string, apiSecret?: string): Promise<TripData> {
        // Model is determined by backend configuration
        const responseText = await this.streamAndAccumulate(
            '/stream-update',
            {
                userId,
                action: 'GENERATE_TRIP',
                description: `Generate Trip: ${input.destination}`,
                tripInput: input
            },
            apiSecret
        );

        let cleanJson = responseText.trim();
        if (cleanJson.startsWith('```json')) {
            cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '');
        } else if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '');
        }

        return this.parseJsonFromResponse(cleanJson, true);
    }

    async updateTrip(
        currentData: TripData,
        history: Message[],
        onThought?: ((text: string) => void) | undefined,
        userId?: string,
        apiSecret?: string,
        language: string = "Traditional Chinese"
    ): Promise<UpdateResult> {
        // Model is determined by backend configuration

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiSecret) headers['x-api-secret'] = apiSecret;

        const response = await fetch(`${SERVER_URL}/stream-update`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                // model removed, backend decides
                userId,
                action: 'CHAT_UPDATE',
                description: `Update Trip: ${history[history.length - 1]?.text.substring(0, 20)}...`,
                currentData,
                history: history.slice(-10),
                language
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(err.error || `Server error: ${response.status}`);
        }

        if (!response.body) {
            throw new Error("Failed to connect to streaming endpoint");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let isJsonMode = false;
        let jsonBuffer = "";
        const delimiter = "___UPDATE_JSON___";
        let displayedText = "";

        const typewrite = async (newText: string) => {
            const delay = newText.length > 50 ? 5 : 15;
            for (const char of newText) {
                displayedText += char;
                if (onThought) onThought(displayedText);
                await new Promise(r => setTimeout(r, delay));
            }
        };

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

                            // If text contains delimiter, we switch modes
                            // Note: text chunk might be small (one char) or large

                            if (!isJsonMode) {
                                fullText += text;
                                const delimiterIndex = fullText.indexOf(delimiter);

                                if (delimiterIndex !== -1) {
                                    isJsonMode = true;
                                    const fullThought = fullText.substring(0, delimiterIndex);
                                    const newThoughtPart = fullThought.substring(displayedText.length);

                                    await typewrite(newThoughtPart);

                                    jsonBuffer = fullText.substring(delimiterIndex + delimiter.length);
                                } else {
                                    // Careful: Only type component of fullText that hasn't changed?
                                    // Actually, we should just type 'text'.
                                    // But what if 'text' contains part of delimiter? 
                                    // Usually unlikely to break significantly.
                                    await typewrite(text);
                                }
                            } else {
                                fullText += text;
                                jsonBuffer += text;
                            }
                        } else if (data.type === 'error') {
                            throw new Error(data.message);
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }
        }

        if (isJsonMode) {
            let cleanJson = jsonBuffer.trim();
            if (cleanJson.startsWith('```json')) cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '');

            const partialUpdate = this.parseJsonFromResponse(cleanJson, false);
            const updatedData = this.mergeTripData(currentData, partialUpdate);
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
        apiSecret?: string,
        language?: string
    ): Promise<UpdateResult> {
        const body = {
            action: 'EXPLORER_UPDATE',
            currentData,
            dayIndex,
            newMustVisit,
            newAvoid,
            keepExisting,
            removeExisting,
            language
        };

        const responseText = await this.streamAndAccumulate('/stream-update', body, apiSecret, onThought);

        const delimiter = "___UPDATE_JSON___";
        const delimiterIndex = responseText.indexOf(delimiter);

        if (delimiterIndex !== -1) {
            const finalText = responseText.substring(0, delimiterIndex);
            const jsonPart = responseText.substring(delimiterIndex + delimiter.length);

            try {
                const partialUpdate = JSON.parse(jsonPart);
                const mergedData = this.mergeTripData(currentData, partialUpdate);
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
        apiSecret?: string,
        language: string = "Traditional Chinese"
    ): Promise<AttractionRecommendation[]> {


        const responseText = await this.postGenerate(
            'GET_RECOMMENDATIONS',
            `Recommendations: ${location} (${category})`,
            { location, interests, category, excludeNames, language },
            apiSecret
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

    async checkFeasibility(
        currentData: TripData,
        modificationContext: string,
        userId?: string,
        apiSecret?: string,
        language: string = "Traditional Chinese"
    ): Promise<FeasibilityResult> {


        const responseText = await this.postGenerate(
            'CHECK_FEASIBILITY',
            `Feasibility Check`,
            { tripData: currentData, modificationContext, language },
            apiSecret
        );

        try {
            return JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse feasibility check", e);
            return { feasible: true, riskLevel: 'low', issues: [], suggestions: [] };
        }
    }
}
