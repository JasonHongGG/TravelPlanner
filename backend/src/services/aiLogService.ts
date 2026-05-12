import path from 'path';
import { promises as fs } from 'fs';
import type { ServiceAIProviderType } from '../config/serviceConfig.js';
import { parseJsonFromText } from './aiResponseParser.js';
import { resolveAiLogDir } from '../platform/runtimePaths.js';
import { formatCompactLocalTimestamp, formatOffsetTimestamp } from '../utils/time.js';

export type AiLogAction = 'GENERATE_TRIP' | 'GET_RECOMMENDATIONS' | 'CHECK_FEASIBILITY' | 'GENERATE_ADVISORY' | 'CHAT_UPDATE' | 'EXPLORER_UPDATE';

type AiLogRecord = {
    createdAt: string;
    durationMs: number;
    status: 'success' | 'error';
    action: AiLogAction;
    actionLabel: string;
    provider: {
        type: ServiceAIProviderType;
        implementation: string;
        model: string;
    };
    userId: string | null;
    input: {
        request: unknown;
        prompt: string | null;
    };
    output: {
        normalizedResponse: unknown;
        rawResponseText: string | null;
    } | null;
    error: {
        message: string;
        stack?: string;
    } | null;
};

type WriteAiLogParams = {
    action: AiLogAction;
    actionLabel: string;
    providerType: ServiceAIProviderType;
    providerImplementation: string;
    model: string;
    userId?: string;
    request: unknown;
    prompt?: string | null;
    durationMs: number;
    response?: unknown;
    rawResponseText?: string | null;
    error?: unknown;
};

const REDACTED_KEYS = /^(authorization|authtoken|apitoken|apisecret|token|secret|key)$/i;

function sanitizeFilePart(value: string) {
    return value
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function getEmailPrefix(email?: string) {
    if (!email) return '';
    const atIndex = email.indexOf('@');
    return atIndex > 0 ? email.slice(0, atIndex) : email;
}

function tryParseJsonLikeText(text: string): unknown {
    try {
        return parseJsonFromText(text);
    } catch {
        return text.trim();
    }
}

function sanitizeForLog(value: unknown, seen = new WeakSet<object>()): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Date) return formatOffsetTimestamp(value);
    if (value instanceof Error) {
        return {
            message: value.message,
            stack: value.stack,
            name: value.name,
        };
    }

    if (Array.isArray(value)) {
        return value.map(item => sanitizeForLog(item, seen));
    }

    if (typeof value === 'object') {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
        const sanitized: Record<string, unknown> = {};

        for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
            sanitized[key] = REDACTED_KEYS.test(key)
                ? '[REDACTED]'
                : sanitizeForLog(nestedValue, seen);
        }

        seen.delete(value);
        return sanitized;
    }

    return String(value);
}

function serializeError(error: unknown) {
    if (error instanceof Error) {
        return {
            message: error.message,
            stack: error.stack,
        };
    }

    return {
        message: String(error),
    };
}

export function normalizeAiOutput(value: unknown): unknown {
    if (typeof value === 'string') {
        return tryParseJsonLikeText(value);
    }

    if (Array.isArray(value)) {
        return value.map(item => normalizeAiOutput(item));
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [key, normalizeAiOutput(nestedValue)])
        );
    }

    return value;
}

export function buildAiActionLabel(action: AiLogAction, request: Record<string, unknown>) {
    const tripInput = request.tripInput as { destination?: string } | undefined;
    const currentData = request.currentData as { tripMeta?: { destination?: string; title?: string } } | undefined;
    const tripData = request.tripData as { tripMeta?: { destination?: string; title?: string } } | undefined;
    const location = typeof request.location === 'string' ? request.location : undefined;

    switch (action) {
        case 'GENERATE_TRIP':
            return `GeneratingTrip_${tripInput?.destination || 'Unknown'}`;
        case 'CHAT_UPDATE':
            return `UpdatingTrip_${currentData?.tripMeta?.destination || 'Unknown'}`;
        case 'GET_RECOMMENDATIONS':
            return `GettingRecommendations_${location || 'Unknown'}`;
        case 'CHECK_FEASIBILITY':
            return `CheckingFeasibility_${tripData?.tripMeta?.destination || currentData?.tripMeta?.destination || 'Unknown'}`;
        case 'EXPLORER_UPDATE':
            return `UpdatingExplorer_${currentData?.tripMeta?.destination || 'Unknown'}`;
        case 'GENERATE_ADVISORY':
            return `GeneratingAdvisory_${tripData?.tripMeta?.title || 'Unknown'}`;
        default:
            return `${action}_Unknown`;
    }
}

export async function writeAiLog(params: WriteAiLogParams): Promise<string> {
    const now = new Date();
    const timestamp = formatCompactLocalTimestamp(now);
    const emailPrefix = getEmailPrefix(params.userId);
    const userPart = emailPrefix ? `${emailPrefix}_` : '';
    const fileName = `${userPart}${timestamp}_${params.providerType}_${params.actionLabel}.json`;
    const safeFileName = sanitizeFilePart(fileName) || `ai_log_${timestamp}.json`;
    const targetDir = resolveAiLogDir();
    const filePath = path.join(targetDir, safeFileName);

    await fs.mkdir(targetDir, { recursive: true });

    const rawResponseText = typeof params.rawResponseText === 'string'
        ? params.rawResponseText
        : typeof params.response === 'string'
            ? params.response
            : null;

    const record: AiLogRecord = {
        createdAt: formatOffsetTimestamp(now),
        durationMs: params.durationMs,
        status: params.error ? 'error' : 'success',
        action: params.action,
        actionLabel: params.actionLabel,
        provider: {
            type: params.providerType,
            implementation: params.providerImplementation,
            model: params.model,
        },
        userId: params.userId || null,
        input: {
            request: sanitizeForLog(params.request),
            prompt: params.prompt || null,
        },
        output: params.error
            ? null
            : {
                normalizedResponse: sanitizeForLog(normalizeAiOutput(params.response)),
                rawResponseText,
            },
        error: params.error ? serializeError(params.error) : null,
    };

    await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf8');
    return filePath;
}