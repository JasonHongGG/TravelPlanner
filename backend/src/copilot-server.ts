
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { CopilotClient } from "@github/copilot-sdk";
import path from 'path';
import {
    constructTripPrompt,
    constructUpdatePrompt,
    constructRecommendationPrompt,
    constructFeasibilityPrompt,
    constructExplorerUpdatePrompt
} from "./config/aiConfig";
import { SERVICE_CONFIG } from "./config/serviceConfig";

const app = express();
const port = 3003;

app.use(cors());
app.use(express.json());

// Copilot Client Setup
const binPath = path.join(process.cwd(), 'node_modules', '.bin');
const copilotScript = path.join(process.cwd(), 'node_modules', '@github', 'copilot', 'index.js');
const env = { ...process.env, PATH: `${binPath}${path.delimiter}${process.env.PATH}` };

let client: CopilotClient | null = null;
let isReady = false;

// Initialize Client
if (process.env.GITHUB_TOKEN) {
    try {
        process.env.PATH = env.PATH;
        client = new CopilotClient({
            cliPath: process.execPath,
            cliArgs: [copilotScript, '--allow-all'],
            logLevel: 'debug',
        });
        client.start().then(() => {
            console.log('[Copilot Server] Client started.');
            isReady = true;
        }).catch(err => console.error('[Copilot Server] Start failed:', err));
    } catch (e) {
        console.error('[Copilot Server] Init failed:', e);
    }
} else {
    console.warn('[Copilot Server] No GITHUB_TOKEN found. Service will fail.');
}

async function ensureClient() {
    if (!client) throw new Error("Copilot Client not initialized.");
    if (!isReady) await new Promise(r => setTimeout(r, 2000));
    if (!isReady) throw new Error("Copilot Client not ready.");
    return client;
}

app.post('/process', async (req, res) => {
    try {
        const { action, tripInput, currentData, history, language, location, interests, category, excludeNames, modificationContext, dayIndex, newMustVisit, newAvoid, keepExisting, removeExisting } = req.body;

        console.log(`[Copilot Server] Processing Action: ${action}`);
        const activeClient = await ensureClient();

        let prompt = "";
        let model = 'gpt-4o'; // Default

        // Select Prompt & Model based on Action & Config
        switch (action) {
            case 'GENERATE_TRIP':
                prompt = constructTripPrompt(tripInput);
                model = SERVICE_CONFIG.copilot.models.tripGenerator;
                break;
            case 'CHAT_UPDATE':
                prompt = constructUpdatePrompt(currentData, history, language);
                model = SERVICE_CONFIG.copilot.models.tripUpdater;
                break;
            case 'GET_RECOMMENDATIONS':
                prompt = constructRecommendationPrompt(location, interests, category, excludeNames, language);
                model = SERVICE_CONFIG.copilot.models.recommender;
                break;
            case 'CHECK_FEASIBILITY':
                prompt = constructFeasibilityPrompt(currentData, modificationContext, language);
                model = SERVICE_CONFIG.copilot.models.recommender; // Reuse recommender model
                break;
            case 'EXPLORER_UPDATE':
                prompt = constructExplorerUpdatePrompt(dayIndex, newMustVisit, newAvoid, keepExisting, removeExisting);
                model = SERVICE_CONFIG.copilot.models.tripUpdater;
                break;
            default:
                return res.status(400).json({ error: "Unknown Action" });
        }

        const session = await activeClient.createSession({ model });

        // Stream response
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const unsubscribe = session.on((event) => {
            if (event.type === "assistant.message_delta") {
                res.write(`data: ${JSON.stringify({ chunk: event.data.deltaContent })}\n\n`);
            } else if (event.type === "assistant.message") {
                // Full content update (optional to send)
            } else if (event.type === "session.idle") {
                unsubscribe();
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                res.end();
            }
        });

        session.send({ prompt }).catch(err => {
            unsubscribe();
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
        });

    } catch (e: any) {
        console.error("[Copilot Server] Error:", e);
        if (!res.headersSent) res.status(500).json({ error: e.message });
    }
});

app.listen(port, () => {
    console.log(`Copilot Dedicated Server running on http://localhost:${port}`);
});
