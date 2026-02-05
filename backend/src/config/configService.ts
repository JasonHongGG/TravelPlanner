const warnMissing = (keys: string[], context: string) => {
    const missing = keys.filter(key => !process.env[key]);
    if (missing.length > 0) {
        console.warn(`[Config] Missing environment variables for ${context}: ${missing.join(', ')}`);
    }
};

export const configService = {
    validateAiServer() {
        warnMissing(['AI_PROVIDER'], 'AI Server');
    },
    validateDbServer() {
        warnMissing(['GOOGLE_CLIENT_ID'], 'DB Server');
    },
    validateCopilotServer() {
        warnMissing(['GITHUB_TOKEN'], 'Copilot Server');
    }
};
