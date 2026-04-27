import type { Response } from 'express';

export class SseWriter {
    constructor(private readonly res: Response) { }

    start(): void {
        this.res.setHeader('Content-Type', 'text/event-stream');
        this.res.setHeader('Cache-Control', 'no-cache');
        this.res.setHeader('Connection', 'keep-alive');
    }

    send(payload: unknown): void {
        this.res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }

    content(chunk: string): void {
        this.send({ type: 'content', chunk });
    }

    meta(meta: Record<string, unknown>): void {
        this.send({ type: 'meta', ...meta });
    }

    item(item: unknown): void {
        this.send({ type: 'item', item });
    }

    done(): void {
        this.send({ type: 'done' });
    }

    error(message: string, code?: string): void {
        this.send({ type: 'error', message, code });
    }

    startKeepAlive(intervalMs = 5000): () => void {
        const timer = setInterval(() => this.res.write(': keep-alive\n\n'), intervalMs);
        return () => clearInterval(timer);
    }

    end(): void {
        this.res.end();
    }
}