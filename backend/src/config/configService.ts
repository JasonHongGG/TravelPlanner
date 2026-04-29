const warnMissing = (keys: string[], context: string) => {
    const missing = keys.filter(key => !process.env[key]);
    if (missing.length > 0) {
        console.warn(`[Config] Missing environment variables for ${context}: ${missing.join(', ')}`);
    }
};

const hasAny = (keys: string[]) => keys.some(key => Boolean(process.env[key]));

export const configService = {
    validateAiServer() {
        warnMissing(['AI_PROVIDER'], 'AI Server');
        const provider = (process.env.AI_PROVIDER || 'copilot').toLowerCase();

        if (provider === 'gemini' && !hasAny(['GEMINI_API_KEY', 'API_KEY'])) {
            console.warn('[Config] Missing environment variables for Gemini Provider: GEMINI_API_KEY');
        }

        if (provider === 'vertex') {
            warnMissing(['GOOGLE_CLOUD_PROJECT'], 'Vertex AI Provider');
        }
    },
    validateDbServer() {
        warnMissing(['GOOGLE_CLIENT_ID'], 'DB Server');
    },
    validateCopilotServer() {
        warnMissing(['GITHUB_TOKEN'], 'Copilot Server');
    }
};
