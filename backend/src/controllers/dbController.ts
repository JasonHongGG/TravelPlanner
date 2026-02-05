import type { Request, Response } from 'express';
import { verifyIdToken } from '../utils/auth';
import { readUsers, toSafeUser, writeUsers, DEFAULT_SETTINGS, UserSettings } from '../services/data/userStore';

type TransactionPayload = {
    id: string;
    date: number;
    amount: number;
    type: string;
    description: string;
    metadata?: Record<string, any>;
    originalAmount?: number;
};

export async function login(req: Request, res: Response) {
    try {
        const { idToken } = req.body;
        if (!idToken) return res.status(400).json({ error: "idToken required" });

        const authUser = await verifyIdToken(idToken);
        const email = authUser.email;
        const name = authUser.name;
        const picture = authUser.picture;

        const users = readUsers();

        if (!users[email]) {
            const newUser = {
                email,
                name,
                picture,
                points: 500,
                transactions: [
                    {
                        id: 'welcome-bonus',
                        date: Date.now(),
                        amount: 500,
                        type: 'purchase',
                        description: '歡迎好禮：新戶入會點數'
                    }
                ]
            };
            users[email] = newUser;
            writeUsers(users);
            console.log(`[DB Server] Created new user: ${email}`);
            res.json(toSafeUser(newUser));
        } else {
            let changed = false;
            if (name && users[email].name !== name) { users[email].name = name; changed = true; }
            if (picture && users[email].picture !== picture) { users[email].picture = picture; changed = true; }

            if (changed) writeUsers(users);

            res.json(toSafeUser(users[email]));
        }
    } catch (error: any) {
        console.error(`[DB Server] Login error:`, error);
        res.status(500).json({ error: error.message });
    }
}

export function getUser(req: Request, res: Response) {
    try {
        const emailParam = req.params.email;
        const email = Array.isArray(emailParam) ? emailParam[0] : emailParam;
        const users = readUsers();
        const authUser = (req as Request & { user?: { email?: string } }).user;

        if (!authUser?.email || authUser.email !== email) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        if (users[email]) {
            res.json(toSafeUser(users[email]));
        } else {
            res.status(404).json({ error: "User not found. Please login." });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

export function addTransaction(req: Request, res: Response) {
    try {
        const emailParam = req.params.email;
        const email = Array.isArray(emailParam) ? emailParam[0] : emailParam;
        const { transaction } = req.body as { transaction?: TransactionPayload };
        const authUser = (req as Request & { user?: { email?: string } }).user;
        const idempotencyKey = req.headers['idempotency-key'];
        if (!idempotencyKey || typeof idempotencyKey !== 'string') {
            return res.status(400).json({ error: "Idempotency-Key header is required." });
        }
        if (!transaction || !transaction.id) {
            return res.status(400).json({ error: "Transaction with id is required." });
        }

        if (typeof transaction.amount !== 'number' || typeof transaction.type !== 'string') {
            return res.status(400).json({ error: "Invalid transaction payload." });
        }

        console.log(`[DB Server] Processing transaction for ${email}:`, transaction.type);

        const users = readUsers();

        if (!users[email]) {
            return res.status(404).json({ error: "User not found" });
        }

        if (!authUser?.email || authUser.email !== email) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        const userData = users[email];

        if (!userData.idempotencyKeys) userData.idempotencyKeys = {};
        const existingKey = userData.idempotencyKeys[idempotencyKey];
        if (existingKey) {
            if (existingKey.transactionId && transaction?.id && existingKey.transactionId !== transaction.id) {
                return res.status(409).json({ error: "Idempotency-Key reuse with different transaction." });
            }
            return res.json(toSafeUser(userData));
        }

        if (transaction.metadata?.requiresSubscription) {
            const isSubscribed = userData.subscription?.active && userData.subscription.endDate > Date.now();
            if (!isSubscribed) {
                console.warn(`[DB Server] Rejected subscription-only feature for ${email}`);
                return res.status(403).json({ error: "此功能僅限會員使用 Subscription Required" });
            }
        }

        if (transaction.type === 'subscription_activation') {
            userData.subscription = {
                active: true,
                startDate: Date.now(),
                endDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
                planId: 'plan_unlimited'
            };
            console.log(`[DB Server] Activated subscription for ${email}. New State:`, userData.subscription);
        }

        if (transaction.amount < 0) {
            const isSubscribed = userData.subscription?.active && userData.subscription.endDate > Date.now();

            if (isSubscribed) {
                console.log(`[DB Server] Waiving fee for subscriber ${email}`);
                transaction.originalAmount = transaction.amount;
                transaction.amount = 0;
                transaction.description = `[會員] ${transaction.description}`;
            } else {
                const potentialBalance = (userData.points || 0) + transaction.amount;
                if (potentialBalance < 0) {
                    console.warn(`[DB Server] Insufficient funds for ${email}. Current: ${userData.points}, Attempted: ${transaction.amount}`);
                    return res.status(400).json({ error: "Insufficient points" });
                }
            }
        }

        userData.points = (userData.points || 0) + transaction.amount;

        if (!userData.transactions) userData.transactions = [];
        userData.transactions.unshift(transaction);

        userData.idempotencyKeys[idempotencyKey] = {
            transactionId: transaction.id,
            createdAt: Date.now()
        };

        const keyList = Object.entries(userData.idempotencyKeys);
        if (keyList.length > 100) {
            const sorted = keyList.sort((a, b) => a[1].createdAt - b[1].createdAt);
            const toRemove = sorted.slice(0, Math.max(0, sorted.length - 100));
            for (const [key] of toRemove) {
                delete userData.idempotencyKeys[key];
            }
        }

        users[email] = userData;
        writeUsers(users);

        console.log(`[DB Server] Transaction recorded successfully for ${email}. New Balance: ${userData.points}`);
        res.json(toSafeUser(userData));

    } catch (error: any) {
        console.error(`[DB Server] Error adding transaction for ${req.params.email}:`, error);
        res.status(500).json({ error: error.message });
    }
}

// ============================================================
// Settings API
// ============================================================

export function getSettings(req: Request, res: Response) {
    try {
        const emailParam = req.params.email;
        const email = Array.isArray(emailParam) ? emailParam[0] : emailParam;
        const users = readUsers();
        const authUser = (req as Request & { user?: { email?: string } }).user;

        if (!authUser?.email || authUser.email !== email) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        if (!users[email]) {
            return res.status(404).json({ error: "User not found" });
        }

        // Return user settings or defaults
        const settings = users[email].settings || DEFAULT_SETTINGS;
        console.log(`[DB Server] Retrieved settings for ${email}`);
        res.json(settings);
    } catch (error: any) {
        console.error(`[DB Server] Error getting settings:`, error);
        res.status(500).json({ error: error.message });
    }
}

export function updateSettings(req: Request, res: Response) {
    try {
        const emailParam = req.params.email;
        const email = Array.isArray(emailParam) ? emailParam[0] : emailParam;

        const { settings } = req.body;
        console.log(`[DB Debug] Received updateSettings:`, JSON.stringify(settings));

        const authUser = (req as Request & { user?: { email?: string } }).user;

        if (!authUser?.email || authUser.email !== email) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        if (!settings) {
            return res.status(400).json({ error: "Settings object is required" });
        }

        const users = readUsers();

        if (!users[email]) {
            return res.status(404).json({ error: "User not found" });
        }

        // Validate and merge settings
        const currentSettings = users[email].settings || DEFAULT_SETTINGS;
        const updatedSettings: UserSettings = {
            explorerQueueSize: typeof settings.explorerQueueSize === 'number'
                ? Math.min(5, Math.max(0, settings.explorerQueueSize))  // Clamp 0-5
                : currentSettings.explorerQueueSize,
            titleLanguageMode: settings.titleLanguageMode === 'local' || settings.titleLanguageMode === 'specified'
                ? settings.titleLanguageMode
                : currentSettings.titleLanguageMode
        };
        console.log(`[DB Debug] Validated settings:`, JSON.stringify(updatedSettings));

        users[email].settings = updatedSettings;
        writeUsers(users);

        console.log(`[DB Server] Updated settings for ${email}:`, updatedSettings);
        res.json(updatedSettings);
    } catch (error: any) {
        console.error(`[DB Server] Error updating settings:`, error);
        res.status(500).json({ error: error.message });
    }
}
