import { randomUUID } from 'crypto';
import path from 'path';
import { createJsonFileStore, resolveDataDir } from './data/jsonFileStore.js';

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

type SessionStoreFile = {
    schemaVersion: 1;
    sessions: Record<string, SessionData>;
};

class RecommendationSessionStore {
    private readonly CLEANUP_INTERVAL = 1000 * 60 * 60;
    private readonly SESSION_TTL = 1000 * 60 * 60 * 24;
    private readonly store = createJsonFileStore<SessionStoreFile>({
        filePath: path.join(resolveDataDir(), 'recommendation_sessions.json'),
        defaultValue: () => ({ schemaVersion: 1, sessions: {} }),
        validate: (value) => {
            const parsed = value as Partial<SessionStoreFile>;
            return {
                schemaVersion: 1,
                sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {}
            };
        },
        onReadError: (error) => console.error('[RecommendationSessionStore] Failed to read sessions:', error)
    });

    constructor() {
        const timer = setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
        timer.unref?.();
    }

    createSession(userId: string, initialQuota: number, context?: any): string {
        const sessionId = randomUUID();
        this.store.mutate((store) => {
            store.sessions[sessionId] = {
                userId,
                remainingQuota: initialQuota,
                createdAt: Date.now(),
                context
            };
        });
        return sessionId;
    }

    getSession(sessionId: string): SessionData | undefined {
        return this.store.read().sessions[sessionId];
    }

    consumeQuota(sessionId: string): boolean {
        return this.store.mutate((store) => {
            const session = store.sessions[sessionId];
            if (!session || session.remainingQuota <= 0) return false;
            session.remainingQuota--;
            return true;
        });
    }

    addQuota(sessionId: string, amount: number): boolean {
        return this.store.mutate((store) => {
            const session = store.sessions[sessionId];
            if (!session) return false;
            session.remainingQuota += amount;
            return true;
        });
    }

    getQuota(sessionId: string): number {
        return this.getSession(sessionId)?.remainingQuota || 0;
    }

    private cleanup() {
        const now = Date.now();
        this.store.mutate((store) => {
            for (const [id, session] of Object.entries(store.sessions)) {
                if (now - session.createdAt > this.SESSION_TTL) {
                    delete store.sessions[id];
                }
            }
        });
    }
}

export const sessionStore = new RecommendationSessionStore();
