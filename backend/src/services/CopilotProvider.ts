
import { IAIProvider, TripInput, TripData, Message, AttractionRecommendation, FeasibilityResult, UpdateResult } from "./aiProvider";
import { SERVICE_CONFIG } from "../config/serviceConfig";

const COPILOT_SERVER_URL = "http://localhost:3003/process";

export class CopilotProvider implements IAIProvider {

    constructor() { }

    private async callCopilot(action: string, body: any, onChunk?: (text: string) => void): Promise<string> {
        try {
            const response = await fetch(COPILOT_SERVER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        if (updates.risks) newData.risks = updates.risks;
        return newData;
    }

    async generateTrip(input: TripInput, userId?: string, apiSecret?: string): Promise<TripData> {
        const text = await this.callCopilot('GENERATE_TRIP', { tripInput: input });
        return this.parseJson(text) as TripData;
    }

    async updateTrip(currentData: TripData, history: Message[], onThought?: ((text: string) => void) | undefined, userId?: string, apiSecret?: string, language?: string): Promise<UpdateResult> {
        const text = await this.callCopilot('CHAT_UPDATE', { currentData, history, language }, onThought);
        const delimiter = "___UPDATE_JSON___";
        const parts = text.split(delimiter);
        let updatedData = undefined;
        if (parts.length > 1) {
            const json = this.parseJson(parts[1]);
            updatedData = this.mergeHelper(currentData, json);
        }
        return { responseText: parts[0], updatedData };
    }

    async getRecommendations(location: string, interests: string, category: "attraction" | "food", excludeNames?: string[], userId?: string, apiSecret?: string, language?: string): Promise<AttractionRecommendation[]> {
        const text = await this.callCopilot('GET_RECOMMENDATIONS', { location, interests, category, excludeNames, language });
        const json = this.parseJson(text);
        return Array.isArray(json) ? json : [];
    }

    async checkFeasibility(currentData: TripData, modificationContext: string, userId?: string, apiSecret?: string, language?: string): Promise<FeasibilityResult> {
        const text = await this.callCopilot('CHECK_FEASIBILITY', { currentData, modificationContext, language });
        return this.parseJson(text) as FeasibilityResult;
    }

    async updateTripWithExplorer(currentData: TripData, dayIndex: number, newMustVisit: string[], newAvoid: string[], keepExisting: string[], removeExisting: string[], onThought?: ((text: string) => void) | undefined, userId?: string, apiSecret?: string, language?: string): Promise<UpdateResult> {
        const text = await this.callCopilot('EXPLORER_UPDATE', { currentData, dayIndex, newMustVisit, newAvoid, keepExisting, removeExisting, language }, onThought);
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
