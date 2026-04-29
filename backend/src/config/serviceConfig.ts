
// =================================================================
// Service Configuration
// This is where you manually select which AI provider to use.
// Options: 'gemini' | 'ollama' | 'local_api' | 'copilot' | 'vertex'
// =================================================================

export type ServiceAIProviderType = 'gemini' | 'ollama' | 'local_api' | 'copilot' | 'vertex';

const readEnv = (key: string, fallback = ''): string => {
    const value = process.env[key];
    if (value === undefined || value.trim() === '') return fallback;
    return value.trim();
};

const parseNumberEnv = (value: string | undefined, fallback: number): number => {
    if (value === undefined || value.trim() === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const readProviderModel = (specificKey: string, defaultKey: string, fallback: string): string => {
    return readEnv(specificKey, readEnv(defaultKey, fallback));
};

export const SERVICE_CONFIG = {
    // Can be overridden by env variable AI_PROVIDER
    provider: readEnv('AI_PROVIDER', 'copilot') as ServiceAIProviderType,

    // Google Gemini Configuration
    gemini: {
        models: {
            tripGenerator: readProviderModel('GEMINI_TRIP_GENERATOR_MODEL', 'GEMINI_MODEL', 'gemini-3-pro-preview'),
            tripUpdater: readProviderModel('GEMINI_TRIP_UPDATER_MODEL', 'GEMINI_MODEL', 'gemini-3-pro-preview'),
            recommender: readProviderModel('GEMINI_RECOMMENDER_MODEL', 'GEMINI_MODEL', 'gemini-3-flash-preview'),
        }
    },

    // Local Ollama Configuration
    ollama: {
        baseUrl: readEnv('OLLAMA_BASE_URL', 'https://17c6fa445bc9.ngrok-free.app'),
        models: {
            tripGenerator: readProviderModel('OLLAMA_TRIP_GENERATOR_MODEL', 'OLLAMA_MODEL', 'gpt-oss:120b'),
            tripUpdater: readProviderModel('OLLAMA_TRIP_UPDATER_MODEL', 'OLLAMA_MODEL', 'llama3.3:70b'),
            recommender: readProviderModel('OLLAMA_RECOMMENDER_MODEL', 'OLLAMA_MODEL', 'gemma3:12b'),
        }
    },

    // Local Custom API Configuration
    local_api: {
        baseUrl: readEnv('LOCAL_API_BASE_URL', '/local-api'),
        models: {
            tripGenerator: readProviderModel('LOCAL_API_TRIP_GENERATOR_MODEL', 'LOCAL_API_MODEL', 'gemini-3-pro-thinking'),
            tripUpdater: readProviderModel('LOCAL_API_TRIP_UPDATER_MODEL', 'LOCAL_API_MODEL', 'gemini-3-pro-thinking'),
            recommender: readProviderModel('LOCAL_API_RECOMMENDER_MODEL', 'LOCAL_API_MODEL', 'gemini-3-flash'),
        }
    },

    // Copilot SDK Configuration
    copilot: {
        models: {
            tripGenerator: readProviderModel('COPILOT_TRIP_GENERATOR_MODEL', 'COPILOT_MODEL', 'gpt-5.2'),
            tripUpdater: readProviderModel('COPILOT_TRIP_UPDATER_MODEL', 'COPILOT_MODEL', 'gpt-5.2'),
            recommender: readProviderModel('COPILOT_RECOMMENDER_MODEL', 'COPILOT_MODEL', 'gemini-3-flash'),
        }
    },

    // Google Cloud Vertex AI Gemini Configuration
    vertex: {
        projectId: readEnv('GOOGLE_CLOUD_PROJECT'),
        location: readEnv('GOOGLE_CLOUD_LOCATION', 'us-central1'),
        apiVersion: readEnv('VERTEX_API_VERSION', 'v1'),
        temperature: parseNumberEnv(process.env.VERTEX_TEMPERATURE, 0.2),
        maxOutputTokens: parseNumberEnv(process.env.VERTEX_MAX_OUTPUT_TOKENS, 4096),
        models: {
            tripGenerator: readProviderModel('VERTEX_TRIP_GENERATOR_MODEL', 'VERTEX_MODEL', 'gemini-2.5-flash'),
            tripUpdater: readProviderModel('VERTEX_TRIP_UPDATER_MODEL', 'VERTEX_MODEL', 'gemini-2.5-flash'),
            recommender: readProviderModel('VERTEX_RECOMMENDER_MODEL', 'VERTEX_MODEL', 'gemini-2.5-flash'),
        }
    }
};
