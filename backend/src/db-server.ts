
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth, verifyIdToken } from './utils/auth';

const app = express();
const port = 3002;

app.use(cors());
app.use(express.json());

// Setup Data Directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(path.dirname(__dirname), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

type StoredUser = {
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
    }>;
    subscription?: {
        active: boolean;
        startDate: number;
        endDate: number;
        planId: string;
    };
    apiSecret?: string;
};

const toSafeUser = (user: StoredUser) => {
    const { apiSecret, ...safeUser } = user;
    return safeUser;
};

// Helper to read/write all users
const readUsers = (): Record<string, StoredUser> => {
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

const writeUsers = (users: Record<string, any>) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// --- Endpoints ---

// POST /auth/login - Secure Login & User Provisioning
app.post('/auth/login', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) return res.status(400).json({ error: "idToken required" });

        const authUser = await verifyIdToken(idToken);
        const email = authUser.email;
        const name = authUser.name;
        const picture = authUser.picture;

        const users = readUsers();

        if (!users[email]) {
            // Create new user
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
            // Existing User: Update profile
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
});

// GET /users/:email - PROTECTED
app.get('/users/:email', requireAuth, (req, res) => {
    try {
        const emailParam = req.params.email;
        const email = Array.isArray(emailParam) ? emailParam[0] : emailParam;
        const users = readUsers();
        const authUser = (req as any).user;

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
});


// POST /users/:email/transaction - SECURED
app.post('/users/:email/transaction', requireAuth, (req, res) => {
    try {
        const emailParam = req.params.email;
        const email = Array.isArray(emailParam) ? emailParam[0] : emailParam;
        const { transaction } = req.body;
        const authUser = (req as any).user;

        console.log(`[DB Server] Processing transaction for ${email}:`, transaction.type);

        const users = readUsers();

        if (!users[email]) {
            return res.status(404).json({ error: "User not found" });
        }

        if (!authUser?.email || authUser.email !== email) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        const userData = users[email];

        // STRICT ACCESS CONTROL
        // Check if transaction requires subscription (e.g. AI Assistant)
        if (transaction.metadata?.requiresSubscription) {
            const isSubscribed = userData.subscription?.active && userData.subscription.endDate > Date.now();
            if (!isSubscribed) {
                console.warn(`[DB Server] Rejected subscription-only feature for ${email}`);
                return res.status(403).json({ error: "此功能僅限會員使用 Subscription Required" });
            }
        }

        // Handle Subscription Purchase
        if (transaction.type === 'subscription_activation') {
            userData.subscription = {
                active: true,
                startDate: Date.now(),
                endDate: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
                planId: 'plan_unlimited'
            };
            console.log(`[DB Server] Activated subscription for ${email}. New State:`, userData.subscription);
        }

        // Check for sufficient funds if deducting
        // If subscribed, WAIVE the cost (set amount to 0) for spending transactions
        if (transaction.amount < 0) {
            const isSubscribed = userData.subscription?.active && userData.subscription.endDate > Date.now();

            if (isSubscribed) {
                console.log(`[DB Server] Waiving fee for subscriber ${email}`);
                transaction.originalAmount = transaction.amount; // Keep track of what it would have cost
                transaction.amount = 0;
                transaction.description = `[會員] ${transaction.description}`;
            } else {
                // Normal balance check
                const potentialBalance = (userData.points || 0) + transaction.amount;
                if (potentialBalance < 0) {
                    console.warn(`[DB Server] Insufficient funds for ${email}. Current: ${userData.points}, Attempted: ${transaction.amount}`);
                    return res.status(400).json({ error: "Insufficient points" });
                }
            }
        }

        // Update Balance
        userData.points = (userData.points || 0) + transaction.amount;

        // Add Transaction
        if (!userData.transactions) userData.transactions = [];
        userData.transactions.unshift(transaction); // Add to top

        // Save
        users[email] = userData;
        writeUsers(users);

        console.log(`[DB Server] Transaction recorded successfully for ${email}. New Balance: ${userData.points}`);
        res.json(userData);

    } catch (error: any) {
        console.error(`[DB Server] Error adding transaction for ${req.params.email}:`, error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Database Server (Single File) running at http://localhost:${port}`);
});

// Hack: Force keep-alive if event loop drains
setInterval(() => { }, 1 << 30);

process.on('SIGINT', () => {
    console.log("Received SIGINT. Exiting...");
    process.exit(0);
});

process.on('exit', (code) => {
    console.log(`Process exited with code: ${code}`);
});
