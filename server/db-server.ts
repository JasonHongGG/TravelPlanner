
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Helper to read/write all users
const readUsers = (): Record<string, any> => {
    if (!fs.existsSync(USERS_FILE)) {
        return {};
    }
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Error reading users file, returning empty", e);
        return {};
    }
};

const writeUsers = (users: Record<string, any>) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// --- Endpoints ---

// GET /users/:email
app.get('/users/:email', (req, res) => {
    try {
        const { email } = req.params;
        const users = readUsers();

        if (!users[email]) {
            // Create new user if not exists
            const newUser = {
                email,
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
            res.json(newUser);
        } else {
            res.json(users[email]);
        }
    } catch (error: any) {
        console.error(`[DB Server] Error fetching user ${req.params.email}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// POST /users/:email/transaction
app.post('/users/:email/transaction', (req, res) => {
    try {
        const { email } = req.params;
        const { transaction } = req.body;

        const users = readUsers();

        if (!users[email]) {
            return res.status(404).json({ error: "User not found" });
        }

        const userData = users[email];

        // Update Balance
        userData.points = (userData.points || 0) + transaction.amount;

        // Add Transaction
        if (!userData.transactions) userData.transactions = [];
        userData.transactions.unshift(transaction); // Add to top

        // Save
        users[email] = userData;
        writeUsers(users);

        console.log(`[DB Server] Transaction recorded for ${email}. New Balance: ${userData.points}`);
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
