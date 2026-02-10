
// =================================================================
// Service Configuration
// This is where you manually select which AI provider to use.
// Options: 'gemini' | 'ollama' | 'local_api' | 'copilot'
// =================================================================

export const SERVICE_CONFIG = {
    // Can be overridden by env variable AI_PROVIDER
    provider: (process.env.AI_PROVIDER || 'copilot') as 'gemini' | 'ollama' | 'local_api' | 'copilot',

    // Google Gemini Configuration
    gemini: {
        models: {
            tripGenerator: 'gemini-3-pro-preview', // 負責生成完整行程 (需邏輯強)
            tripUpdater: 'gemini-3-pro-preview',   // 負責修改行程 (需理解上下文)
            recommender: 'gemini-3-flash-preview', // 負責推薦景點 (速度快)
        }
    },

    // Local Ollama Configuration
    ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'https://17c6fa445bc9.ngrok-free.app',
        models: {
            tripGenerator: 'gpt-oss:120b', // 生成完整 JSON 需要較強的模型 (如 llama3, mistral)
            tripUpdater: 'llama3.3:70b',   // 處理對話修改
            recommender: 'gemma3:12b',   // 簡單列表生成 (可以用較小的模型如 gemma:7b 以加速)
        }
    },

    // Local Custom API Configuration
    local_api: {
        baseUrl: '/local-api',
        models: {
            tripGenerator: 'gemini-3-pro-thinking',
            tripUpdater: 'gemini-3-pro-thinking',
            recommender: 'gemini-3-flash',
        }
    },

    // Copilot SDK Configuration
    copilot: {
        models: {
            tripGenerator: 'gpt-5.2', // gpt-5.2 gemini-3-pro
            tripUpdater: 'gpt-5.2',
            recommender: 'gemini-3-flash',
        }
    }
};
