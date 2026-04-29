import { GoogleGenAI, Type } from "@google/genai";
import type { GenerateContentConfig, GenerateContentParameters, GenerateContentResponse } from "@google/genai";
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
import { mergeTripData, parseJsonFromText } from "../aiResponseParser.js";

export interface VertexAIModelConfig {
    tripGenerator: string;
    tripUpdater: string;
    recommender: string;
}

export interface VertexAIProviderSettings {
    projectId: string;
    location: string;
    apiVersion: string;
    temperature: number;
    maxOutputTokens: number;
    models: VertexAIModelConfig;
}

type VertexAIResponse = Pick<GenerateContentResponse, 'text' | 'promptFeedback' | 'candidates' | 'usageMetadata'>;

export interface VertexAIClient {
    models: {
        generateContent(params: GenerateContentParameters): Promise<VertexAIResponse>;
        generateContentStream(params: GenerateContentParameters): Promise<AsyncGenerator<VertexAIResponse>>;
    };
}

export type VertexAIProviderClientFactory = (settings: VertexAIProviderSettings) => VertexAIClient;

export interface VertexAIProviderOptions {
    clientFactory?: VertexAIProviderClientFactory;
    settings?: Partial<Omit<VertexAIProviderSettings, 'models'>> & {
        models?: Partial<VertexAIModelConfig>;
    };
}
const createDefaultVertexClient: VertexAIProviderClientFactory = (settings) => new GoogleGenAI({
    vertexai: true,
    project: settings.projectId,
    location: settings.location,
    apiVersion: settings.apiVersion,
});

export class VertexAIProvider implements IAIProvider {
    private client?: VertexAIClient;
    private clientCacheKey?: string;
    private readonly clientFactory: VertexAIProviderClientFactory;

    constructor(private readonly options: VertexAIProviderOptions = {}) {
        this.clientFactory = options.clientFactory || createDefaultVertexClient;
    }

    private resolveSettings(): VertexAIProviderSettings {
        const configured = SERVICE_CONFIG.vertex;
        const override = this.options.settings || {};

        return {
            ...configured,
            ...override,
            models: {
                ...configured.models,
                ...override.models,
            }
        };
    }

    private validateSettings(settings: VertexAIProviderSettings): void {
        if (!settings.projectId.trim()) {
            throw new Error("GOOGLE_CLOUD_PROJECT environment variable is required when AI_PROVIDER=vertex.");
        }
        if (!settings.location.trim()) {
            throw new Error("GOOGLE_CLOUD_LOCATION environment variable is required when AI_PROVIDER=vertex.");
        }
    }

    private getClientWithSettings(): { client: VertexAIClient; settings: VertexAIProviderSettings } {
        const settings = this.resolveSettings();
        this.validateSettings(settings);

        const cacheKey = `${settings.projectId}:${settings.location}:${settings.apiVersion}`;
        if (!this.client || this.clientCacheKey !== cacheKey) {
            this.client = this.clientFactory(settings);
            this.clientCacheKey = cacheKey;
        }

        return { client: this.client, settings };
    }

    private buildGenerationConfig(settings: VertexAIProviderSettings, overrides: GenerateContentConfig = {}): GenerateContentConfig {
        return {
            temperature: settings.temperature,
            maxOutputTokens: settings.maxOutputTokens,
            ...overrides,
            labels: {
                app: 'travel_planner_dashboard',
                provider: 'vertex_ai',
                ...overrides.labels,
            }
        };
    }

    private parseJsonFromVertex<T>(text: string, strict = true, fallback: T): T {
        try {
            return parseJsonFromText<T>(text, { strict, fallback });
        } catch (error) {
            console.error("Vertex AI JSON Parse Error:", error);
            if (strict) throw new Error("Failed to parse Vertex AI response data.");
            return fallback;
        }
    }

    private getResponseText(response: VertexAIResponse, context: string, allowEmpty = false, requireComplete = false): string {
        const firstCandidate = response.candidates?.[0];
        const finishReason = firstCandidate?.finishReason ? String(firstCandidate.finishReason) : undefined;
        const finishMessage = firstCandidate?.finishMessage ? `: ${firstCandidate.finishMessage}` : "";
        const text = response.text || "";
        if (text) {
            if (requireComplete && finishReason === 'MAX_TOKENS') {
                throw new Error(`Vertex AI ${context} was truncated because generation stopped with ${finishReason}${finishMessage}`);
            }
            return text;
        }

        const promptFeedback = response.promptFeedback;
        if (promptFeedback?.blockReason) {
            const message = promptFeedback.blockReasonMessage ? `: ${promptFeedback.blockReasonMessage}` : "";
            throw new Error(`Vertex AI ${context} blocked the prompt (${promptFeedback.blockReason})${message}`);
        }

        if (finishReason && (this.isBlockingFinishReason(finishReason) || (requireComplete && finishReason === 'MAX_TOKENS'))) {
            throw new Error(`Vertex AI ${context} returned no content because generation stopped with ${finishReason}${finishMessage}`);
        }

        if (!allowEmpty) {
            const reason = finishReason ? ` Finish reason: ${finishReason}${finishMessage}` : "";
            throw new Error(`Vertex AI returned an empty response for ${context}.${reason}`);
        }

        return "";
    }

    private isBlockingFinishReason(finishReason: string): boolean {
        return [
            'SAFETY',
            'RECITATION',
            'SPII',
            'PROHIBITED_CONTENT',
            'BLOCKLIST',
            'MODEL_ARMOR',
            'OTHER',
        ].includes(finishReason);
    }

    private summarizeError(error: unknown): { message: string; status?: number } {
        const message = error instanceof Error ? error.message : String(error);
        const status = typeof error === 'object' && error !== null && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
            ? (error as { status: number }).status
            : undefined;
        return { message, status };
    }

    private handleProviderError(context: string, error: unknown): never {
        const summary = this.summarizeError(error);
        console.error(`Vertex AI ${context} Error:`, summary);

        if (summary.message.startsWith('Vertex AI')) {
            throw error instanceof Error ? error : new Error(summary.message);
        }

        const status = summary.status ? ` (${summary.status})` : "";
        throw new Error(`Vertex AI ${context} failed${status}: ${summary.message}`);
    }

    private async consumeUpdateStream(
        responseStream: AsyncGenerator<VertexAIResponse>,
        currentData: TripData,
        onThought: ((text: string) => void) | undefined,
        context: string
    ): Promise<UpdateResult> {
        let fullText = "";
        let isJsonMode = false;
        let jsonBuffer = "";
        const delimiter = "___UPDATE_JSON___";

        for await (const chunk of responseStream) {
            const text = this.getResponseText(chunk, context, true);
            if (!text) continue;

            if (!isJsonMode) {
                fullText += text;
                const delimiterIndex = fullText.indexOf(delimiter);

                if (delimiterIndex !== -1) {
                    isJsonMode = true;
                    const thoughtPart = fullText.substring(0, delimiterIndex);
                    if (onThought) onThought(thoughtPart);
                    jsonBuffer = fullText.substring(delimiterIndex + delimiter.length);
                } else if (onThought) {
                    onThought(text);
                }
            } else {
                jsonBuffer += text;
            }
        }

        if (!isJsonMode) return { responseText: fullText };

        const partialUpdate = this.parseJsonFromVertex<Partial<TripData>>(jsonBuffer, false, {});
        const updatedData = mergeTripData(currentData, partialUpdate);
        return {
            responseText: fullText.split(delimiter)[0],
            updatedData,
        };
    }

    private emitRecommendationObjects(text: string, parserState: {
        buffer: string;
        bracketCount: number;
        inObject: boolean;
        objectStart: number;
    }, onItem: (item: AttractionRecommendation) => void): void {
        for (let charIndex = 0; charIndex < text.length; charIndex++) {
            const char = text[charIndex];
            parserState.buffer += char;

            if (char === '{') {
                if (!parserState.inObject) {
                    parserState.inObject = true;
                    parserState.objectStart = parserState.buffer.length - 1;
                }
                parserState.bracketCount++;
            } else if (char === '}') {
                parserState.bracketCount--;

                if (parserState.inObject && parserState.bracketCount === 0) {
                    const objectText = parserState.buffer.substring(parserState.objectStart);
                    try {
                        const item = JSON.parse(objectText) as AttractionRecommendation;
                        if (item.name && item.description && item.category) onItem(item);
                    } catch (error) {
                        console.error("Failed to parse streamed Vertex AI recommendation object:", error);
                    }
                    parserState.inObject = false;
                    parserState.objectStart = -1;
                }
            }
        }
    }

    async generateTrip(input: TripInput, userId?: string, apiSecret?: string): Promise<TripData> {
        try {
            const { client, settings } = this.getClientWithSettings();
            const prompt = constructTripPrompt(input);

            const response = await client.models.generateContent({
                model: settings.models.tripGenerator,
                contents: prompt,
                config: this.buildGenerationConfig(settings, {
                    maxOutputTokens: settings.maxOutputTokens,
                    systemInstruction: SYSTEM_INSTRUCTION,
                    responseMimeType: 'application/json',
                }),
            });

            return this.parseJsonFromVertex<TripData>(
                this.getResponseText(response, 'trip generation', false, true),
                true,
                {} as TripData
            );
        } catch (error) {
            this.handleProviderError('Generate Trip', error);
        }
    }

    async generateAdvisory(
        tripData: TripData,
        userId?: string,
        apiSecret?: string,
        language?: string
    ): Promise<any> {
        try {
            const { client, settings } = this.getClientWithSettings();
            const prompt = constructAdvisoryPrompt(tripData, language);

            const response = await client.models.generateContent({
                model: settings.models.tripGenerator,
                contents: prompt,
                config: this.buildGenerationConfig(settings, {
                    responseMimeType: 'application/json',
                }),
            });

            return this.parseJsonFromVertex(this.getResponseText(response, 'advisory generation'), false, {});
        } catch (error) {
            this.handleProviderError('Generate Advisory', error);
        }
    }

    async updateTrip(
        currentData: TripData,
        history: Message[],
        onThought?: (text: string) => void,
        userId?: string,
        apiSecret?: string,
        language: string = "Traditional Chinese",
        tripLanguage: string = language
    ): Promise<UpdateResult> {
        try {
            const { client, settings } = this.getClientWithSettings();
            const prompt = constructUpdatePrompt(currentData, history, language, tripLanguage);

            const responseStream = await client.models.generateContentStream({
                model: settings.models.tripUpdater,
                contents: prompt,
                config: this.buildGenerationConfig(settings, {
                    systemInstruction: SYSTEM_INSTRUCTION,
                }),
            });

            return this.consumeUpdateStream(responseStream, currentData, onThought, 'trip update');
        } catch (error) {
            this.handleProviderError('Update Trip', error);
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
        try {
            const { client, settings } = this.getClientWithSettings();
            const prompt = constructRecommendationPrompt(location, interests, category, excludeNames, language, titleLanguage);

            const response = await client.models.generateContent({
                model: settings.models.recommender,
                contents: prompt,
                config: this.buildGenerationConfig(settings, {
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
                }),
            });

            const parsed = this.parseJsonFromVertex<AttractionRecommendation[]>(this.getResponseText(response, 'recommendation generation'), false, []);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("Vertex AI Recommendation Error:", this.summarizeError(error));
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
        try {
            const { client, settings } = this.getClientWithSettings();
            const prompt = constructRecommendationPrompt(location, interests, category, excludeNames, language, titleLanguage, count || 12);

            const responseStream = await client.models.generateContentStream({
                model: settings.models.recommender,
                contents: prompt,
                config: this.buildGenerationConfig(settings, {
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
                }),
            });

            const parserState = {
                buffer: "",
                bracketCount: 0,
                inObject: false,
                objectStart: -1,
            };

            for await (const chunk of responseStream) {
                const text = this.getResponseText(chunk, 'streamed recommendation generation', true);
                if (text) this.emitRecommendationObjects(text, parserState, onItem);
            }
        } catch (error) {
            this.handleProviderError('Stream Recommendations', error);
        }
    }

    async checkFeasibility(
        currentData: TripData,
        modificationContext: string,
        userId?: string,
        apiSecret?: string,
        language: string = "Traditional Chinese"
    ): Promise<FeasibilityResult> {
        try {
            const { client, settings } = this.getClientWithSettings();
            const prompt = constructFeasibilityPrompt(currentData, modificationContext, language);

            const response = await client.models.generateContent({
                model: settings.models.recommender,
                contents: prompt,
                config: this.buildGenerationConfig(settings, {
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
                }),
            });

            return this.parseJsonFromVertex<FeasibilityResult>(this.getResponseText(response, 'feasibility check'), false, {
                feasible: true,
                riskLevel: 'low',
                issues: [],
                suggestions: []
            });
        } catch (error) {
            console.error("Vertex AI Feasibility Error:", this.summarizeError(error));
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
        language: string = "Traditional Chinese",
        tripLanguage: string = language
    ): Promise<UpdateResult> {
        try {
            const { client, settings } = this.getClientWithSettings();
            const prompt = constructExplorerUpdatePrompt(dayIndex, newMustVisit, newAvoid, keepExisting, removeExisting, language, tripLanguage);

            const responseStream = await client.models.generateContentStream({
                model: settings.models.tripUpdater,
                contents: prompt,
                config: this.buildGenerationConfig(settings, {
                    systemInstruction: SYSTEM_INSTRUCTION,
                }),
            });

            return this.consumeUpdateStream(responseStream, currentData, onThought, 'explorer trip update');
        } catch (error) {
            this.handleProviderError('Explorer Update', error);
        }
    }
}