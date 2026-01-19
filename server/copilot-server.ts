
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { CopilotClient } from "@github/copilot-sdk";

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Body:', JSON.stringify(req.body).substring(0, 200) + '...');
    next();
});

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Copilot Client
// We add node_modules/.bin to PATH so that the SDK can find the copilot executable
const binPath = path.join(process.cwd(), 'node_modules', '.bin');
const env = { ...process.env, PATH: `${binPath}${path.delimiter}${process.env.PATH}` };

// On Windows, we must explicitly use .cmd if spawning without shell (which SDK likely does)
// BUT since we are running with 'node' executable directly, we must point to the JS file, NOT the .cmd shim.
const copilotScript = path.join(process.cwd(), 'node_modules', '@github', 'copilot', 'index.js');

const client = new CopilotClient({
    cliPath: process.execPath,
    cliArgs: [copilotScript, '--allow-all'],
    logLevel: 'debug', // Enable debug logging
});

// Update global PATH for this process
process.env.PATH = `${binPath}${path.delimiter}${process.env.PATH}`;

if (process.env.GITHUB_TOKEN) {
    console.log('[Auth] GITHUB_TOKEN detected in environment.');
} else {
    console.warn('[Auth] WARNING: GITHUB_TOKEN not found in environment. Authentication may fail unless "gh auth login" has been run.');
}

// Ensure client is started.
client.start()
    .then(() => console.log(`[Copilot] Client started successfully using script: ${copilotScript}`))
    .catch(err => console.error(`[Copilot] Failed to start client:`, err));

// Helper to deduct points
async function deductPoints(userId: string, cost: number, description: string): Promise<boolean> {
    if (!userId || cost <= 0) return true; // No cost or user, skip

    try {
        const response = await fetch(`http://localhost:3002/users/${userId}/transaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transaction: {
                    id: crypto.randomUUID(),
                    date: Date.now(),
                    amount: -cost,
                    type: 'spend',
                    description: description
                }
            })
        });

        if (!response.ok) {
            console.error(`[Copilot] Point deduction failed for ${userId}: ${response.statusText}`);
            return false;
        }
        return true;
    } catch (e) {
        console.error(`[Copilot] Error contacting DB server:`, e);
        return false;
    }
}

app.post('/generate', async (req, res) => {
    try {
        const { prompt, model, systemInstruction, userId, cost, description } = req.body;

        console.log(`[Copilot] Generating content for ${userId || 'anon'}. Cost: ${cost || 0}`);

        // Server-side Point Deduction
        if (userId && cost > 0) {
            const success = await deductPoints(userId, cost, description || `AI Request (${model})`);
            if (!success) {
                return res.status(403).json({ error: "Insufficient points or transaction failed." });
            }
        }

        console.log(`[Copilot] Generating content with model: ${model}`);

        const session = await client.createSession({
            model: model,
            systemMessage: systemInstruction ? { content: systemInstruction } : undefined
        });

        // Simple non-streaming implementation for now to match interface expectations, 
        // or we can stream if we want to be fancy. The frontend expects a promise that resolves to full text for generateTrip,
        // but updateTrip expects streaming/partial updates. 
        // For simplicity in this v1, we will buffer the response server-side and send it back.
        // TODO: Implement proper SSE for updates if needed.

        let fullContent = "";

        const done = new Promise<void>((resolve, reject) => {
            const unsubscribe = session.on((event) => {
                if (event.type === "assistant.message_delta") {
                    fullContent += event.data.deltaContent;
                } else if (event.type === "assistant.message") {
                    fullContent = event.data.content;
                } else if (event.type === "session.idle") {
                    unsubscribe();
                    resolve();
                }
            });

            session.send({ prompt }).catch(err => {
                unsubscribe();
                reject(err);
            });
        });

        await done;
        res.json({ text: fullContent });

    } catch (error: any) {
        console.error("Error in /generate:", error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint for streaming updates (used by updateTrip) - using SSE
app.post('/stream-update', async (req, res) => {
    try {
        const { prompt, model, systemInstruction, userId, cost, description } = req.body;

        // Server-side Point Deduction
        if (userId && cost > 0) {
            const success = await deductPoints(userId, cost, description || `AI Request (${model})`);
            if (!success) {
                res.status(403).json({ error: "Insufficient points or transaction failed." });
                return;
            }
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const session = await client.createSession({
            model: model,
            systemMessage: systemInstruction ? { content: systemInstruction } : undefined
        });

        const unsubscribe = session.on((event) => {
            if (event.type === "assistant.message_delta") {
                // Send chunk
                res.write(`data: ${JSON.stringify({ type: 'content', chunk: event.data.deltaContent })}\n\n`);
            } else if (event.type === "session.idle") {
                unsubscribe();
                res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
                res.end();
            }
        });

        session.send({ prompt }).catch(err => {
            unsubscribe();
            res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
            res.end();
        });

    } catch (error: any) {
        console.error("Error in /stream-update:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});


app.listen(port, () => {
    console.log(`Copilot Backend Server running at http://localhost:${port}`);
});
