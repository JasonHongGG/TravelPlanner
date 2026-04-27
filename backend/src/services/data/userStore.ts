import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createJsonFileStore } from './jsonFileStore.js';

function resolveDataDir() {
    // Preferred: explicit env var, or relative to runtime working dir (WORKDIR in Docker)
    const preferred = (process.env.DATA_DIR || '').trim() || path.join(process.cwd(), 'data');

    // Legacy fallback: older builds wrote under a dist-relative path (e.g. /app/backend/dist/backend/data)
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const legacy = path.join(path.dirname(path.dirname(path.dirname(__dirname))), 'data');

    return { preferred, legacy };
}

const { preferred: DATA_DIR, legacy: LEGACY_DATA_DIR } = resolveDataDir();
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LEGACY_USERS_FILE = path.join(LEGACY_DATA_DIR, 'users.json');

// User Settings Type
export type UserSettings = {
    explorerQueueSize: number;      // Range: 0-5, default: 0
    titleLanguageMode: 'local' | 'specified';  // default: 'local'
};

export const DEFAULT_SETTINGS: UserSettings = {
    explorerQueueSize: 0,
    titleLanguageMode: 'local'
};

export type StoredUser = {
    email: string;
    name?: string;
    picture?: string;
    points: number;
    transactions: Array<{
        id: string;
        date: number;
        amount: number;
        type: string;
        description: string;
        metadata?: Record<string, any>;
        originalAmount?: number;
    }>;
    idempotencyKeys?: Record<string, { transactionId: string; createdAt: number }>;
    subscription?: {
        active: boolean;
        startDate: number;
        endDate: number;
        planId: string;
    };
    settings?: UserSettings;  // New: User settings
    apiSecret?: string;
};

export const toSafeUser = (user: StoredUser) => {
    const { apiSecret, idempotencyKeys, ...safeUser } = user;
    return safeUser;
};

const userStore = createJsonFileStore<Record<string, StoredUser>>({
    filePath: USERS_FILE,
    defaultValue: () => ({}),
    validate: (value) => value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, StoredUser>
        : {},
    onReadError: (error) => console.error('Error reading users file, returning empty', error)
});

export const readUsers = (): Record<string, StoredUser> => {
    try {
        if (userStore.exists()) {
            return userStore.read();
        }

        // Auto-migrate legacy location if present
        if (fs.existsSync(LEGACY_USERS_FILE)) {
            const data = fs.readFileSync(LEGACY_USERS_FILE, 'utf-8');
            const parsed = JSON.parse(data) as Record<string, StoredUser>;
            try {
                userStore.write(parsed);
            } catch (e) {
                console.error('Error migrating legacy users file, continuing with legacy data', e);
            }
            return parsed;
        }

        return {};
    } catch (e) {
        console.error("Error reading users file, returning empty", e);
        return {};
    }
};

export const writeUsers = (users: Record<string, StoredUser>) => {
    userStore.write(users);
};
