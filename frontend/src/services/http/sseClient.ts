import { apiUrl, getAuthHeaders } from './apiClient';
import { parseErrorResponse } from './parseError';

export type SseJsonEvent = Record<string, any>;

export function parseSseBuffer(buffer: string): { events: SseJsonEvent[]; remaining: string } {
    const normalized = buffer.replace(/\r\n/g, '\n');
    const blocks = normalized.split('\n\n');
    const remaining = blocks.pop() || '';
    const events: SseJsonEvent[] = [];

    for (const block of blocks) {
        const dataLines = block
            .split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.replace(/^data:\s?/, ''));

        if (dataLines.length === 0) continue;
        events.push(JSON.parse(dataLines.join('\n')) as SseJsonEvent);
    }

    return { events, remaining };
}

export async function openSsePost(path: string, body: unknown, fallbackMessage = 'Server error'): Promise<Response> {
    const response = await fetch(apiUrl(path), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw await parseErrorResponse(response, fallbackMessage);
    }
    return response;
}

export async function streamJsonEvents(
    response: Response,
    onEvent: (event: SseJsonEvent) => void | Promise<void>
): Promise<void> {
    if (!response.body) {
        throw new Error('Failed to connect to streaming endpoint');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseBuffer(buffer);
        buffer = parsed.remaining;

        for (const event of parsed.events) {
            await onEvent(event);
        }
    }

    buffer += decoder.decode();
    const parsed = parseSseBuffer(`${buffer}\n\n`);
    for (const event of parsed.events) {
        await onEvent(event);
    }
}