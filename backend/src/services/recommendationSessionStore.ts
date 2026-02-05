import { randomUUID } from 'crypto';

interface SessionData {
    userId: string;
    remainingQuota: number;
    createdAt: number;
    // We could store context here if we wanted to enforce context consistency
    context?: {
        location: string;
        interests: string;
    };
}

class RecommendationSessionStore {
    private sessions: Map<string, SessionData> = new Map();
    private CLEANUP_INTERVAL = 1000 * 60 * 60; // 1 hour
    private SESSION_TTL = 1000 * 60 * 60 * 24; // 24 hours

    constructor() {
        setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
    }

    createSession(userId: string, initialQuota: number, context?: any): string {
        const sessionId = randomUUID();
        this.sessions.set(sessionId, {
            userId,
            remainingQuota: initialQuota,
            createdAt: Date.now(),
            context
        });
        return sessionId;
    }

    getSession(sessionId: string): SessionData | undefined {
        return this.sessions.get(sessionId);
    }

    consumeQuota(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        if (session.remainingQuota > 0) {
            session.remainingQuota--;
            return true;
        }
        return false;
    }

    addQuota(sessionId: string, amount: number): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        session.remainingQuota += amount;
        return true;
    }

    getQuota(sessionId: string): number {
        return this.sessions.get(sessionId)?.remainingQuota || 0;
    }

    private cleanup() {
        const now = Date.now();
        for (const [id, session] of this.sessions.entries()) {
            if (now - session.createdAt > this.SESSION_TTL) {
                this.sessions.delete(id);
            }
        }
    }
}

export const sessionStore = new RecommendationSessionStore();
