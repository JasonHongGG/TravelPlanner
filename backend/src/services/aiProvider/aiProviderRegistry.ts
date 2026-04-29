import type { IAIProvider } from './aiProvider.js';
import { CopilotProvider } from './CopilotProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { LocalApiProvider } from './LocalApiProvider.js';
import { OllamaProvider } from './OllamaProvider.js';
import { VertexAIProvider } from './VertexAIProvider.js';

export type AIProviderType = 'copilot' | 'gemini' | 'local_api' | 'ollama' | 'vertex';

export class AIProviderRegistry {
    private instance?: IAIProvider;

    constructor(private readonly readProviderType = () => process.env.AI_PROVIDER || 'copilot') { }

    getProvider(): IAIProvider {
        if (this.instance) return this.instance;

        const providerType = this.readProviderType().toLowerCase();
        console.log(`[BackendAIService] Initializing AI Provider: ${providerType}`);

        this.instance = this.createProvider(providerType);
        return this.instance;
    }

    reset(): void {
        this.instance = undefined;
    }

    private createProvider(providerType: string): IAIProvider {
        switch (providerType) {
            case 'ollama':
                return new OllamaProvider();
            case 'gemini':
                return new GeminiProvider();
            case 'vertex':
                return new VertexAIProvider();
            case 'local_api':
                return new LocalApiProvider();
            case 'copilot':
                return new CopilotProvider();
            default:
                console.warn(`Unknown provider '${providerType}', falling back to Gemini`);
                return new GeminiProvider();
        }
    }
}

export const aiProviderRegistry = new AIProviderRegistry();