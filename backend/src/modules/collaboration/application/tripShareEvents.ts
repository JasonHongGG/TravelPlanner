import type { Response } from 'express';

export class TripShareEventBus {
    private readonly clients = new Map<string, Set<Response>>();

    subscribe(tripId: string, res: Response): void {
        if (!this.clients.has(tripId)) {
            this.clients.set(tripId, new Set());
        }
        const clients = this.clients.get(tripId)!;
        clients.add(res);

        console.log(`[TripShareService] Client subscribed to trip ${tripId}. Total clients: ${clients.size}`);

        res.on('close', () => {
            clients.delete(res);
            if (clients.size === 0) {
                this.clients.delete(tripId);
            }
            console.log(`[TripShareService] Client disconnected from trip ${tripId}.`);
        });
    }

    publish(tripId: string, event: string, data: unknown): void {
        const clients = this.clients.get(tripId);
        if (!clients) return;

        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        clients.forEach(client => client.write(message));
    }
}

export const tripShareEventBus = new TripShareEventBus();