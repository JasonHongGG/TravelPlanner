import { IAIProvider } from "./aiProvider/aiProvider.js";
import { aiProviderRegistry } from "./aiProvider/aiProviderRegistry.js";

export class BackendAIService {
    static getProvider(): IAIProvider {
        return aiProviderRegistry.getProvider();
    }

    static resetForTests(): void {
        aiProviderRegistry.reset();
    }
}
