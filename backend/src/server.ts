import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { COSTS, PointAction, calculateCost, TRIP_DAILY_COST } from './config/costs';
import { BackendAIService } from './services/BackendAIService';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './utils/auth';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    const action = (req.body as { action?: string } | undefined)?.action;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Action: ${action ?? 'N/A'}`);
    next();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to deduct points based on ACTION and Cost
async function deductPoints(userId: string, cost: number, description: string, authToken: string, metadata?: any): Promise<boolean> {
    if (cost <= 0) return true; // Free
    if (!userId) return true;

    try {
        const response = await fetch(`http://localhost:3002/users/${userId}/transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                transaction: {
                    id: crypto.randomUUID(),
                    date: Date.now(),
                    amount: -cost, // Deduct
                    type: 'spend',
                    description: description,
                    metadata: metadata
                }
            })
        });

        if (!response.ok) {
            console.error(`[Server] Point deduction failed for ${userId}: ${response.statusText}`);
            return false;
        }
        return true;
    } catch (e) {
        console.error(`[Server] Error contacting DB server:`, e);
        return false;
    }
}

import { AVAILABLE_PACKAGES } from './config/packages';

// ==========================================
// UNIFIED ROUTE HANDLERS
// ==========================================

app.get('/config', (req, res) => {
    res.json({
        TRIP_BASE_COST: COSTS.GENERATE_TRIP,
        TRIP_DAILY_COST,
        NEW_USER_BONUS: 500, // Should import this but hardcoding for speed/safety matching types
        ATTRACTION_SEARCH_COST: 10
    });
});

app.get('/packages', (req, res) => {
    res.json(AVAILABLE_PACKAGES);
});

app.post('/generate', requireAuth, async (req, res) => {
    try {
        const { userId: requestedUserId, action, description, tripInput, location, interests, category, excludeNames, language, tripData, modificationContext } = req.body;
        const authToken = (req.headers.authorization || '').replace('Bearer ', '');
        const authUser = (req as any).user;
        const userId = authUser?.email as string;
        if (requestedUserId && requestedUserId !== userId) {
            return res.status(403).json({ error: "User mismatch." });
        }
        const provider = BackendAIService.getProvider();

        // 1. Determine Cost
        let calculatedCost = 0;
        let costDescription = description || `AI Request (${action})`;

        if (action === 'GENERATE_TRIP') {
            calculatedCost = calculateCost(action, { dateRange: tripInput?.dateRange });
            costDescription = `Generate Trip: ${tripInput?.destination}`;
        } else {
            calculatedCost = calculateCost(action as PointAction);
        }

        // 2. Transact
        if (userId) {
            if (!authToken) return res.status(401).json({ error: "Missing auth token." });
            const success = await deductPoints(userId, calculatedCost, costDescription, authToken);
            if (!success) return res.status(403).json({ error: "Insufficient points or Unauthorized." });
        }

        // 3. Dispatch to Provider (Unified)
        let result;
        if (action === 'GET_RECOMMENDATIONS') {
            const results = await provider.getRecommendations(location, interests, category, excludeNames, userId, undefined, language);
            // Frontend expects { text: JSON_STRING } because of legacy adapter
            result = { text: JSON.stringify(results) };

        } else if (action === 'CHECK_FEASIBILITY') {
            const feasibility = await provider.checkFeasibility(tripData, modificationContext, userId, undefined, language);
            result = { text: JSON.stringify(feasibility) };

        } else if (action === 'GENERATE_TRIP') {
            // Non-streaming generation (if supported or legacy fallbacks used this endpoint)
            // Typically /stream-update is used for generation now, but if /generate is hit:
            const trip = await provider.generateTrip(tripInput, userId, undefined);
            result = { text: JSON.stringify(trip) }; // Return as text/json structure
        } else {
            return res.status(400).json({ error: `Action ${action} not supported on /generate` });
        }

        res.json(result);

    } catch (error: any) {
        console.error("Error in /generate:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/stream-update', requireAuth, async (req, res) => {
    try {
        const { userId: requestedUserId, action, description, currentData, history, language, tripInput, dayIndex, newMustVisit, newAvoid, keepExisting, removeExisting } = req.body;
        const authToken = (req.headers.authorization || '').replace('Bearer ', '');
        const authUser = (req as any).user;
        const userId = authUser?.email as string;
        if (requestedUserId && requestedUserId !== userId) {
            return res.status(403).json({ error: "User mismatch." });
        }
        const provider = BackendAIService.getProvider();

        // 1. Transaction Logic
        if (userId) {
            let cost = calculateCost(action as PointAction);
            if (action === 'GENERATE_TRIP') cost = calculateCost(action, { dateRange: tripInput?.dateRange });

            if (!authToken) return res.status(401).json({ error: "Missing auth token." });
            const success = await deductPoints(userId, cost, description || action, authToken);
            if (!success) return res.status(403).json({ error: "Insufficient points" });
        }

        // 2. Set Headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // 3. Dispatch (Unified)
        const onThought = (chunk: string) => {
            res.write(`data: ${JSON.stringify({ type: 'content', chunk: chunk })}\n\n`);
        };

        if (action === 'CHAT_UPDATE') {
            await provider.updateTrip(currentData, history, onThought, userId, undefined, language);
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();

        } else if (action === 'EXPLORER_UPDATE') {
            await provider.updateTripWithExplorer(
                currentData,
                dayIndex,
                newMustVisit || [],
                newAvoid || [],
                keepExisting || [],
                removeExisting || [],
                onThought,
                userId,
                undefined,
                language
            );
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();

        } else if (action === 'GENERATE_TRIP') {
            // Simulate streaming for Generate Trip if provider returns Promise<TripData>
            const keepAlive = setInterval(() => res.write(`: keep-alive\n\n`), 5000);
            try {
                // TODO: enhance IAIProvider to support streaming generation if possible
                const tripData = await provider.generateTrip(tripInput, userId, undefined);
                clearInterval(keepAlive);
                res.write(`data: ${JSON.stringify({ type: 'content', chunk: "```json\n" + JSON.stringify(tripData) + "\n```" })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
                res.end();
            } catch (e: any) {
                clearInterval(keepAlive);
                res.write(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`);
                res.end();
            }
        } else {
            res.write(`data: ${JSON.stringify({ type: 'error', message: "Unknown Action" })}\n\n`);
            res.end();
        }

    } catch (error: any) {
        console.error("Error in /stream-update:", error);
        if (!res.headersSent) res.status(500).json({ error: error.message });
    }
});


app.listen(port, () => {
    console.log(`AI Backend Server running at http://localhost:${port}`);
    console.log(`Active Provider: ${BackendAIService.getProvider().constructor.name}`);
});
