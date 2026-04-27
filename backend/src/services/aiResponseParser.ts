import type { TripData } from '../types.js';

type ParseJsonOptions<T> = {
    strict?: boolean;
    fallback?: T;
};

export function stripJsonFence(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith('```json')) {
        return trimmed.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    }
    if (trimmed.startsWith('```')) {
        return trimmed.replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
    }
    return trimmed;
}

export function extractJsonText(text: string): string {
    const cleaned = stripJsonFence(text);
    const objectStart = cleaned.indexOf('{');
    const arrayStart = cleaned.indexOf('[');
    const starts = [objectStart, arrayStart].filter(index => index >= 0);
    const start = starts.length > 0 ? Math.min(...starts) : -1;
    if (start === -1) throw new Error('No JSON value found in AI response.');

    const opening = cleaned[start];
    const closing = opening === '{' ? '}' : ']';
    const end = cleaned.lastIndexOf(closing);
    if (end < start) throw new Error('Incomplete JSON value in AI response.');

    return cleaned.slice(start, end + 1);
}

export function parseJsonFromText<T = unknown>(text: string, options: ParseJsonOptions<T> = {}): T {
    try {
        return JSON.parse(extractJsonText(text)) as T;
    } catch (error) {
        if (options.strict === false) {
            return options.fallback as T;
        }
        throw error;
    }
}

export function mergeTripData(original: TripData, updates: Partial<TripData>): TripData {
    const next: TripData = { ...original };
    if (updates.tripMeta) next.tripMeta = { ...next.tripMeta, ...updates.tripMeta };

    if (updates.days && Array.isArray(updates.days)) {
        const mergedDays = [...next.days];
        updates.days.forEach(updatedDay => {
            const index = mergedDays.findIndex(day => day.day === updatedDay.day);
            if (index !== -1) mergedDays[index] = updatedDay;
            else mergedDays.push(updatedDay);
        });
        mergedDays.sort((a, b) => a.day - b.day);
        next.days = mergedDays;
    }

    if (updates.totals) next.totals = updates.totals;
    if (updates.advisory) next.advisory = updates.advisory;

    return next;
}