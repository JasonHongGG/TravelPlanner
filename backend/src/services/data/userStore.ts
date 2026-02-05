import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup Data Directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(path.dirname(path.dirname(path.dirname(__dirname))), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

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

export const readUsers = (): Record<string, StoredUser> => {
    if (!fs.existsSync(USERS_FILE)) {
        return {};
    }
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf-8');
        return JSON.parse(data) as Record<string, StoredUser>;
    } catch (e) {
        console.error("Error reading users file, returning empty", e);
        return {};
    }
};

export const writeUsers = (users: Record<string, StoredUser>) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};
