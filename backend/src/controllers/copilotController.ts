import type { Request, Response } from 'express';
import { CopilotClient } from "@github/copilot-sdk";
import path from 'path';
import { promises as fs } from 'fs';
import {
    constructTripPrompt,
    constructUpdatePrompt,
    constructRecommendationPrompt,
    constructFeasibilityPrompt,
    constructExplorerUpdatePrompt,
    constructAdvisoryPrompt,
    SYSTEM_INSTRUCTION
} from "../config/aiConfig.js";
import { SERVICE_CONFIG } from "../config/serviceConfig.js";
import { RECOMMENDATION_COUNT } from "../config/apiLimits.js";

// Copilot Client Setup
const binPath = path.join(process.cwd(), 'node_modules', '.bin');
const copilotScript = path.join(process.cwd(), 'node_modules', '@github', 'copilot', 'index.js');
const env = { ...process.env, PATH: `${binPath}${path.delimiter}${process.env.PATH}` };

let client: CopilotClient | null = null;
let isReady = false;

const COPILOT_LOG_DIR = path.join(process.cwd(), 'copilot_logs');

function formatTimestamp(date: Date) {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function sanitizeFilePart(value: string) {
    return value
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function getEmailPrefix(email?: string) {
    if (!email) return '';
    const atIndex = email.indexOf('@');
    return atIndex > 0 ? email.slice(0, atIndex) : email;
}

function buildActionLabel(action: string, data: {
    tripInput?: any;
    currentData?: any;
    location?: string;
}) {
    switch (action) {
        case 'GENERATE_TRIP':
            return `GeneratingTrip_${data.tripInput?.destination || 'Unknown'}`;
        case 'CHAT_UPDATE':
            return `UpdatingTrip_${data.currentData?.tripMeta?.destination || 'Unknown'}`;
        case 'GET_RECOMMENDATIONS':
            return `GettingRecommendations_${data.location || 'Unknown'}`;
        case 'CHECK_FEASIBILITY':
            return `CheckingFeasibility_${data.currentData?.tripMeta?.destination || 'Unknown'}`;
        case 'EXPLORER_UPDATE':
            return `UpdatingExplorer_${data.currentData?.tripMeta?.destination || 'Unknown'}`;
        case 'GENERATE_ADVISORY':
            return `GeneratingAdvisory_${data.currentData?.tripMeta?.title || 'Unknown'}`;
        default:
            return `UnknownAction_${action || 'Unknown'}`;
    }
}

async function writeCopilotLog(params: {
    action: string;
    actionLabel: string;
    userEmail?: string;
    model: string;
    input?: unknown;
    response: string;
}) {
    const timestamp = formatTimestamp(new Date());
    const emailPrefix = getEmailPrefix(params.userEmail);
    const userPart = emailPrefix ? `${emailPrefix}_` : '';
    const fileName = `${userPart}${timestamp}_${params.actionLabel}.json`;
    const safeFileName = sanitizeFilePart(fileName) || `copilot_log_${timestamp}.json`;
    const filePath = path.join(COPILOT_LOG_DIR, safeFileName);

    await fs.mkdir(COPILOT_LOG_DIR, { recursive: true });
    await fs.writeFile(
        filePath,
        JSON.stringify(
            {
                createdAt: new Date().toISOString(),
                action: params.action,
                actionLabel: params.actionLabel,
                userEmail: params.userEmail || null,
                model: params.model,
                input: params.input ?? null,
                response: params.response
            },
            null,
            2
        ),
        'utf8'
    );
}

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

export async function processCopilot(req: Request, res: Response) {
    try {
        const {
            action,
            tripInput,
            currentData,
            history,
            language,
            tripLanguage, // New param
            location,
            interests,
            category,
            excludeNames,
            modificationContext,
            dayIndex,
            newMustVisit,
            newAvoid,
            keepExisting,
            removeExisting
        } = req.body;
        const authUser = (req as Request & { user?: { email?: string } }).user;
        const userEmail = authUser?.email;

        console.log(`[Copilot Server] Processing Action: ${action}`);
        const activeClient = await ensureClient();

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let prompt = "";
        let model = 'gpt-4o';
        let actionLabel = "";

        // effectiveTripLanguage defaults to language (UI) if not provided, to maintain backward compatibility
        const effectiveTripLanguage = tripLanguage || language || "Traditional Chinese";
        const effectiveChatLanguage = language || "Traditional Chinese";

        switch (action) {
            case 'GENERATE_TRIP':
                console.log(`[Copilot Server] Generating Trip: ${tripInput.destination}`);
                prompt = constructTripPrompt(tripInput);
                model = SERVICE_CONFIG.copilot.models.tripGenerator;
                actionLabel = buildActionLabel(action, { tripInput });
                break;
            case 'CHAT_UPDATE':
                console.log(`[Copilot Server] Updating Trip: ${currentData.tripMeta.destination}`);
                // Pass (Data, History, ChatLang, TripLang)
                prompt = constructUpdatePrompt(currentData, history, effectiveChatLanguage, effectiveTripLanguage);
                model = SERVICE_CONFIG.copilot.models.tripUpdater;
                actionLabel = buildActionLabel(action, { currentData });
                break;
            case 'GET_RECOMMENDATIONS':
                console.log(`[Copilot Server] Getting Recommendations: ${location} (Count: ${RECOMMENDATION_COUNT})`);
                prompt = constructRecommendationPrompt(location, interests, category, excludeNames, effectiveChatLanguage, effectiveTripLanguage, RECOMMENDATION_COUNT);
                model = SERVICE_CONFIG.copilot.models.recommender;
                actionLabel = buildActionLabel(action, { location });
                break;
            case 'CHECK_FEASIBILITY':
                console.log(`[Copilot Server] Checking Feasibility: ${currentData.tripMeta.destination}`);
                prompt = constructFeasibilityPrompt(currentData, modificationContext, effectiveChatLanguage);
                model = SERVICE_CONFIG.copilot.models.recommender;
                actionLabel = buildActionLabel(action, { currentData });
                break;
            case 'EXPLORER_UPDATE':
                console.log(`[Copilot Server] Updating Explorer: ${currentData.tripMeta.destination}`);
                prompt = constructExplorerUpdatePrompt(dayIndex, newMustVisit, newAvoid, keepExisting, removeExisting, effectiveChatLanguage, effectiveTripLanguage);
                model = SERVICE_CONFIG.copilot.models.tripUpdater;
                actionLabel = buildActionLabel(action, { currentData });
                break;
            case 'GENERATE_ADVISORY':
                console.log(`[Copilot Server] Generating Advisory: ${currentData.tripMeta.title}`);
                prompt = constructAdvisoryPrompt(currentData, effectiveChatLanguage);
                model = SERVICE_CONFIG.copilot.models.tripGenerator; // Use strong model
                actionLabel = buildActionLabel(action, { currentData });
                break;
            default:
                return res.status(400).json({ error: "Unknown Action" });
        }

        console.log(`[Copilot Server] Using Model: ${model}`);
        const session = await activeClient.createSession({
            model,
            streaming: true,
            systemMessage: { mode: "append", content: SYSTEM_INSTRUCTION }
        });

        let fullResponse = "";
        let hasDelta = false;

        const unsubscribe = session.on((event) => {
            if (event.type !== "assistant.message_delta" && event.type !== "assistant.message" && event.type !== "assistant.reasoning_delta")
                console.log(`[Copilot Server] Event: ${event.type}`);

            if (event.type === "assistant.message_delta") {
                const delta = event.data?.deltaContent || "";
                if (delta) {
                    hasDelta = true;
                    fullResponse += delta;
                    res.write(`data: ${JSON.stringify({ type: 'chunk', chunk: delta })}\n\n`);
                }
            }

            if (event.type === "assistant.message") {
                const content = event.data?.content || "";
                if (content && !hasDelta) {
                    fullResponse += content;
                    res.write(`data: ${JSON.stringify({ type: 'chunk', chunk: content })}\n\n`);
                }
            }
        });

        const timeoutMs = action === 'GENERATE_TRIP' ? 600000 : 600000;
        const finalEvent = await session.sendAndWait({ prompt }, timeoutMs);
        unsubscribe();

        if (!fullResponse && finalEvent?.data?.content) {
            fullResponse = finalEvent.data.content;
            res.write(`data: ${JSON.stringify({ type: 'chunk', chunk: fullResponse })}\n\n`);
        }

        console.log("[Copilot Server] Output Preview:", fullResponse.substring(0, 200).replace(/\n/g, ' '));

        if (!fullResponse) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: 'Trip Generation Failed: No content returned from AI' })}\n\n`);
        } else {
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        }

        try {
            if (fullResponse) {
                await writeCopilotLog({
                    action,
                    actionLabel,
                    userEmail,
                    model,
                    input: {
                        requestBody: req.body,
                        prompt
                    },
                    response: fullResponse
                });
            }
        } catch (logError) {
            console.warn('[Copilot Server] Failed to write copilot log:', logError);
        }
        res.end();

    } catch (e: any) {
        console.error("[Copilot Server] Error:", e);
        if (!res.headersSent) {
            res.status(500).json({ error: e.message || 'Copilot server error' });
        } else {
            // Stream already started, send error event
            res.write(`data: ${JSON.stringify({ type: 'error', message: e.message || 'Copilot server error' })}\n\n`);
            res.end();
        }
    }
}
