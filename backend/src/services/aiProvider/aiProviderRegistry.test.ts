import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AIProviderRegistry } from './aiProviderRegistry.js';
import { CopilotProvider } from './CopilotProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { VertexAIProvider } from './VertexAIProvider.js';

describe('AIProviderRegistry', () => {
    it('resolves the Vertex AI provider', () => {
        const registry = new AIProviderRegistry(() => 'vertex');

        assert.ok(registry.getProvider() instanceof VertexAIProvider);
    });

    it('keeps existing provider resolution intact', () => {
        assert.ok(new AIProviderRegistry(() => 'copilot').getProvider() instanceof CopilotProvider);
        assert.ok(new AIProviderRegistry(() => 'gemini').getProvider() instanceof GeminiProvider);
    });

    it('falls back to Gemini for unknown providers', () => {
        const registry = new AIProviderRegistry(() => 'unknown-provider');

        assert.ok(registry.getProvider() instanceof GeminiProvider);
    });
});