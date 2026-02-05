
import { IAIProvider } from "./aiProvider/aiProvider.js";
import { GeminiProvider } from "./aiProvider/GeminiProvider.js";
import { OllamaProvider } from "./aiProvider/OllamaProvider.js";
import { CopilotProvider } from "./aiProvider/CopilotProvider.js";
import { LocalApiProvider } from "./aiProvider/LocalApiProvider.js";

// Determine provider from Env or Config
// For now, let's use process.env.AI_PROVIDER || 'copilot'
// But wait, frontend sends everything to 'copilot-server'.
// 'copilot-server' is the entry point.

export class BackendAIService {
    private static instance: IAIProvider;

    static getProvider(): IAIProvider {
        if (this.instance) return this.instance;

        const providerType = process.env.AI_PROVIDER || 'copilot'; // Default to Gemini if not set, or Copilot?

        console.log(`[BackendAIService] Initializing AI Provider: ${providerType}`);

        switch (providerType.toLowerCase()) {
            case 'ollama':
                this.instance = new OllamaProvider();
                break;
            case 'gemini':
                this.instance = new GeminiProvider();
                break;
            case 'local_api':
                this.instance = new LocalApiProvider();
                break;
            case 'copilot':
                // Copilot logic is unique because it's usually just "pass-through" to the SDK middlware.
                // But if we want to standardize, we'd use CopilotProvider.
                // However, CopilotProvider isn't fully implemented yet because of SDK constraints.
                // For the purpose of this refactor, if provider is Copilot, we might rely on the 
                // legacy handler in copilot-server.ts or throw error here.
                // Let's return the stub for now, but server.ts will handle it.
                this.instance = new CopilotProvider();
                break;
            default:
                console.warn(`Unknown provider '${providerType}', falling back to Gemini`);
                this.instance = new GeminiProvider();
        }

        return this.instance;
    }
}
