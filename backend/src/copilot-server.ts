
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { CopilotClient } from "@github/copilot-sdk";
import { COSTS, PointAction, calculateCost } from './config/costs';
import { constructTripPrompt, SYSTEM_INSTRUCTION } from './config/aiConfig';
import { TripInput } from './types';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    // Log simplified body to avoid massive logs but show action
    const logBody = { ...req.body };
    if (logBody.tripInput) logBody.tripInput = "[TripInput Object]";
    if (logBody.prompt) logBody.prompt = logBody.prompt.substring(0, 50) + "...";
    console.log('Body:', JSON.stringify(logBody));
    next();
});

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Copilot Client
const binPath = path.join(process.cwd(), 'node_modules', '.bin');
const env = { ...process.env, PATH: `${binPath}${path.delimiter}${process.env.PATH}` };
const copilotScript = path.join(process.cwd(), 'node_modules', '@github', 'copilot', 'index.js');

const client = new CopilotClient({
    cliPath: process.execPath,
    cliArgs: [copilotScript, '--allow-all'],
    logLevel: 'debug',
});

process.env.PATH = `${binPath}${path.delimiter}${process.env.PATH}`;

if (process.env.GITHUB_TOKEN) {
    console.log('[Auth] GITHUB_TOKEN detected in environment.');
} else {
    console.warn('[Auth] WARNING: GITHUB_TOKEN not found in environment.');
}

client.start()
    .then(() => console.log(`[Copilot] Client started successfully.`))
    .catch(err => console.error(`[Copilot] Failed to start client:`, err));

// Helper to deduct points based on ACTION and Cost
async function deductPoints(userId: string, cost: number, description: string, apiSecret: string): Promise<boolean> {
    if (cost <= 0) return true; // Free

    if (!userId) return true; // Anonymous (should restrict?)

    try {
        const response = await fetch(`http://localhost:3002/users/${userId}/transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-secret': apiSecret
            },
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
        const { prompt, model, systemInstruction, userId, action, description, tripInput } = req.body;
        const apiSecret = req.headers['x-api-secret'] as string;

        console.log(`[Copilot] Request from ${userId || 'anon'}. Action: ${action}`);

        let finalPrompt = prompt;
        let calculatedCost = 0;
        let costDescription = description || `AI Request (${action})`;

        // 1. Determine Cost and Prompt based on Action
        if (action === 'GENERATE_TRIP') {
            if (!tripInput) {
                return res.status(400).json({ error: "Missing 'tripInput' for GENERATE_TRIP action." });
            }
            // Securely calculate cost based on input days
            calculatedCost = calculateCost(action, { dateRange: tripInput.dateRange });

            // Securely construct prompt on server
            finalPrompt = constructTripPrompt(tripInput);
            costDescription = `Generate Trip: ${tripInput.destination} (${tripInput.dateRange})`;

            console.log(`[Security] Generated secure prompt for ${tripInput.destination}. Cost: ${calculatedCost}`);
        } else {
            // Legacy or other actions (e.g. Chat Update, Feasibility)
            // For these, we currently trust the prompt but enforce action cost
            if (!action || !COSTS[action as PointAction]) {
                return res.status(400).json({ error: "Invalid or missing 'action' parameter." });
            }
            calculatedCost = calculateCost(action);
        }

        // 2. Transact
        if (userId) {
            if (!apiSecret) {
                console.warn(`[Security] Request missing 'x-api-secret' header from ${userId}`);
                return res.status(401).json({ error: "Missing API Secret. Please log in again." });
            }

            const success = await deductPoints(userId, calculatedCost, costDescription, apiSecret);
            if (!success) {
                return res.status(403).json({ error: "Insufficient points or Unauthorized (Invalid Secret)." });
            }
        }

        console.log(`[Copilot] Generating content with model: ${model}`);

        const session = await client.createSession({
            model: model,
            systemMessage: systemInstruction ? { content: systemInstruction } : undefined
        });

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

            session.send({ prompt: finalPrompt }).catch(err => {
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
        const { prompt, model, systemInstruction, userId, action, description } = req.body;
        const apiSecret = req.headers['x-api-secret'] as string;

        // Server-side Point Deduction
        if (userId) {
            if (!action || !COSTS[action as PointAction]) {
                res.status(400).json({ error: "Invalid or missing 'action' parameter." });
                return;
            }

            if (!apiSecret) {
                res.status(401).json({ error: "Missing API Secret. Please log in again." });
                return;
            }

            // Updates usually have fixed cost
            const cost = calculateCost(action);
            const success = await deductPoints(userId, cost, description || `AI Request (${action})`, apiSecret);
            if (!success) {
                res.status(403).json({ error: "Insufficient points or Unauthorized." });
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
            } else if (event.type === "assistant.message") {
                if (event.data.content) {
                    res.write(`data: ${JSON.stringify({ type: 'content', chunk: event.data.content })}\n\n`);
                }
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
