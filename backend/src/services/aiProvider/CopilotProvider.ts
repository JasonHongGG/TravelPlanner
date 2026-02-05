import { IAIProvider, TripInput, TripData, Message, AttractionRecommendation, FeasibilityResult, UpdateResult } from "./aiProvider";
import { SERVICE_CONFIG } from "../../config/serviceConfig";

const COPILOT_SERVER_URL = process.env.COPILOT_SERVER_URL || "http://localhost:3003/process";

export class CopilotProvider implements IAIProvider {

    constructor() { }

    private async callCopilot(action: string, body: any, onChunk?: (text: string) => void, apiSecret?: string): Promise<string> {
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (apiSecret) {
                headers['Authorization'] = `Bearer ${apiSecret}`;
            }

            const response = await fetch(COPILOT_SERVER_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify({ action, ...body })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(err.error || "Copilot Server Error");
            }

            if (!response.body) throw new Error("No response body from Copilot Server");

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
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.chunk) {
                                fullText += data.chunk;
                                if (onChunk) onChunk(data.chunk);
                            } else if (data.error) {
                                throw new Error(data.error);
                            }
                        } catch (e) { }
                    }
                }
            }
            return fullText;

        } catch (e) {
            console.error("Copilot Provider Error:", e);
            throw e;
        }
    }

    private parseJson(text: string): any {
        try {
            const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(clean);
        } catch (e) {
            return {};
        }
    }

    private mergeHelper(original: TripData, updates: Partial<TripData>): TripData {
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
        const text = await this.callCopilot('GENERATE_TRIP', { tripInput: input }, undefined, apiSecret);
        return this.parseJson(text) as TripData;
    }

    async updateTrip(currentData: TripData, history: Message[], onThought?: ((text: string) => void) | undefined, userId?: string, apiSecret?: string, language?: string, tripLanguage?: string): Promise<UpdateResult> {
        const text = await this.callCopilot('CHAT_UPDATE', { currentData, history, language, tripLanguage }, onThought, apiSecret);
        const delimiter = "___UPDATE_JSON___";
        const parts = text.split(delimiter);
        let updatedData = undefined;
        if (parts.length > 1) {
            const json = this.parseJson(parts[1]);
            updatedData = this.mergeHelper(currentData, json);
        }
        return { responseText: parts[0], updatedData };
    }

    async getRecommendations(location: string, interests: string, category: "attraction" | "food", excludeNames?: string[], userId?: string, apiSecret?: string, language?: string, titleLanguage?: string): Promise<AttractionRecommendation[]> {
        const text = await this.callCopilot('GET_RECOMMENDATIONS', { location, interests, category, excludeNames, language, tripLanguage: titleLanguage }, undefined, apiSecret);
        const json = this.parseJson(text);
        return Array.isArray(json) ? json : [];
    }

    async getRecommendationsStream(
        location: string,
        interests: string,
        category: 'attraction' | 'food' = 'attraction',
        excludeNames: string[] = [],
        onItem: (item: AttractionRecommendation) => void,
        userId?: string,
        apiSecret?: string,
        language?: string,
        titleLanguage?: string,
        count?: number
    ): Promise<void> {
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (apiSecret) {
                headers['Authorization'] = `Bearer ${apiSecret}`;
            }

            const response = await fetch(COPILOT_SERVER_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'GET_RECOMMENDATIONS',
                    location,
                    interests,
                    category,
                    excludeNames,
                    language,
                    tripLanguage: titleLanguage
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(err.error || "Copilot Server Error");
            }

            if (!response.body) throw new Error("No response body from Copilot Server");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let chunkBuffer = ""; // Buffer for SSE lines
            let jsonBuffer = "";  // Buffer for JSON object parsing
            let bracketCount = 0;
            let inObject = false;
            let objectStart = -1;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunkBuffer += decoder.decode(value, { stream: true });
                const lines = chunkBuffer.split('\n\n');
                // Keep the last part if it might be incomplete (doesn't end with \n\n)
                // However, split separates by delimiter. If string ends with \n\n, last item is empty.
                // If it doesn't, last item is the incomplete line.

                // Correct logic: process all but last, set chunkBuffer to last. 
                // BUT lines.length - 1 might be empty if it ended with \n\n.
                // Let's rely on standard SSE which ends with \n\n.
                // Simpler: iterate all, if line is not empty check it.
                // Warning: This basic split assumes \n\n always arrives at chunk boundary or inside.
                // Better:

                chunkBuffer = lines.pop() || ""; // Save incomplete part

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));

                            if (data.type === 'done') {
                                return; // Explicitly finish stream
                            }

                            if (data.type === 'error') {
                                throw new Error(data.message || "Unknown Copilot Error");
                            }

                            if (data.chunk) {
                                const text = data.chunk;
                                // Parse JSON objects incrementally
                                for (let i = 0; i < text.length; i++) {
                                    const char = text[i];
                                    jsonBuffer += char;

                                    if (char === '{') {
                                        if (!inObject) {
                                            inObject = true;
                                            objectStart = jsonBuffer.length - 1;
                                        }
                                        bracketCount++;
                                    } else if (char === '}') {
                                        bracketCount--;

                                        if (inObject && bracketCount === 0) {
                                            // Complete object found
                                            const objectStr = jsonBuffer.substring(objectStart);
                                            try {
                                                const item = JSON.parse(objectStr) as AttractionRecommendation;
                                                // Validate it has required fields
                                                if (item.name && item.description && item.category) {
                                                    onItem(item);
                                                }
                                            } catch (e) {
                                                // Not a valid JSON object yet
                                            }
                                            inObject = false;
                                            objectStart = -1;
                                        }
                                    }
                                }
                            } else if (data.error) {
                                throw new Error(data.error);
                            }
                        } catch (e) {
                            // console.warn("Parse error", e);
                        }
                    }
                }
            }

            // Flush any remaining buffer if stream closed without final newline
            if (chunkBuffer.startsWith('data: ')) {
                try {
                    const data = JSON.parse(chunkBuffer.substring(6));
                    if (data.chunk) {
                        // We might have a partial object here, but usually 'data' lines contain complete JSON strings for the wrapper.
                        // The 'chunk' content itself is what matters. 
                        // If we are here, it means we have a valid data line that was just missing \n\n
                        // We can try to process it same as above.
                        // For simplicity, we just recurse or copy logic.
                        // Actually, let's just copy the inner logic since we can't easily recurse.
                        const text = data.chunk;
                        for (let i = 0; i < text.length; i++) {
                            const char = text[i];
                            jsonBuffer += char;
                            if (char === '{') {
                                if (!inObject) { inObject = true; objectStart = jsonBuffer.length - 1; }
                                bracketCount++;
                            } else if (char === '}') {
                                bracketCount--;
                                if (inObject && bracketCount === 0) {
                                    const objectStr = jsonBuffer.substring(objectStart);
                                    try {
                                        const item = JSON.parse(objectStr) as AttractionRecommendation;
                                        if (item.name && item.description && item.category) onItem(item);
                                    } catch (e) { }
                                    inObject = false; objectStart = -1;
                                }
                            }
                        }
                    }
                } catch (e) { }
            }

        } catch (e) {
            console.error("Copilot Provider Streaming Error:", e);
            throw e;
        }
    }

    async generateAdvisory(tripData: TripData, userId?: string, apiSecret?: string, language?: string): Promise<any> {
        const text = await this.callCopilot('GENERATE_ADVISORY', { currentData: tripData, language }, undefined, apiSecret);
        return this.parseJson(text);
    }

    async checkFeasibility(currentData: TripData, modificationContext: string, userId?: string, apiSecret?: string, language?: string): Promise<FeasibilityResult> {
        const text = await this.callCopilot('CHECK_FEASIBILITY', { currentData, modificationContext, language }, undefined, apiSecret);
        return this.parseJson(text) as FeasibilityResult;
    }

    async updateTripWithExplorer(currentData: TripData, dayIndex: number, newMustVisit: string[], newAvoid: string[], keepExisting: string[], removeExisting: string[], onThought?: ((text: string) => void) | undefined, userId?: string, apiSecret?: string, language?: string, tripLanguage?: string): Promise<UpdateResult> {
        const text = await this.callCopilot('EXPLORER_UPDATE', { currentData, dayIndex, newMustVisit, newAvoid, keepExisting, removeExisting, language, tripLanguage }, onThought, apiSecret);
        const delimiter = "___UPDATE_JSON___";
        const parts = text.split(delimiter);
        let updatedData = undefined;
        if (parts.length > 1) {
            const json = this.parseJson(parts[1]);
            updatedData = this.mergeHelper(currentData, json);
        }
        return { responseText: parts[0], updatedData };
    }
}
