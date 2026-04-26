import type { TripData } from '../types';

export function stripMarkdownJsonFence(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith('```json')) {
        return trimmed.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    }
    if (trimmed.startsWith('```')) {
        return trimmed.replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
    }
    return trimmed;
}

export function parseJsonFromText<T>(text: string, failureMessage = 'Failed to parse response data.'): T {
    const cleanText = stripMarkdownJsonFence(text);
    const start = cleanText.indexOf('{');
    const arrayStart = cleanText.indexOf('[');
    const jsonStartCandidates = [start, arrayStart].filter(index => index !== -1);
    const jsonStart = jsonStartCandidates.length > 0 ? Math.min(...jsonStartCandidates) : -1;
    const jsonEnd = cleanText.lastIndexOf('}') > cleanText.lastIndexOf(']') ? cleanText.lastIndexOf('}') : cleanText.lastIndexOf(']');

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
        throw new Error('Invalid response format: No JSON value found.');
    }

    try {
        return JSON.parse(cleanText.substring(jsonStart, jsonEnd + 1)) as T;
    } catch (error) {
        console.error('JSON Parse Error:', error);
        throw new Error(failureMessage);
    }
}

export function mergeTripData(original: TripData, updates: Partial<TripData>): TripData {
    const nextData = { ...original };
    if (updates.tripMeta) nextData.tripMeta = { ...nextData.tripMeta, ...updates.tripMeta };

    if (updates.days && Array.isArray(updates.days)) {
        const days = [...nextData.days];
        updates.days.forEach(updatedDay => {
            const index = days.findIndex(day => day.day === updatedDay.day);
            if (index !== -1) days[index] = updatedDay;
            else days.push(updatedDay);
        });
        days.sort((a, b) => a.day - b.day);
        nextData.days = days;
    }

    if (updates.totals) nextData.totals = updates.totals;
    if (updates.advisory) nextData.advisory = updates.advisory;

    return nextData;
}
