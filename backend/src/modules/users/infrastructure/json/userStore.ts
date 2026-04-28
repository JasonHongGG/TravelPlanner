import fs from 'fs';
import path from 'path';
import { createJsonFileStore } from '../../../../platform/persistence/jsonFileStore.js';
import { resolveDataDir, resolveLegacyBackendDataDir } from '../../../../platform/runtimePaths.js';

const DATA_DIR = resolveDataDir();
const LEGACY_DATA_DIR = resolveLegacyBackendDataDir();
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
