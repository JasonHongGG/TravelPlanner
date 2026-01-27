import type { Request, Response } from 'express';
import { BackendAIService } from '../services/BackendAIService';
import { deductPoints } from '../services/business/pointsService';
import { pricingService } from '../services/business/pricingService';
import { packageService } from '../services/business/packageService';
import { RECOMMENDATION_COUNT } from '../config/apiLimits';
import { sessionStore } from '../services/recommendationSessionStore';

export function getConfig(req: Request, res: Response) {
    res.json(pricingService.getConfig());
}

export function getPackages(req: Request, res: Response) {
    res.json(packageService.list());
}

export async function generate(req: Request, res: Response) {
    try {
        const { userId: requestedUserId, action, description, tripInput, location, interests, category, excludeNames, language, titleLanguage, tripData, modificationContext } = req.body;
        const authToken = (req.headers.authorization || '').replace('Bearer ', '');
        const authUser = (req as Request & { user?: { email?: string } }).user;
        const userId = authUser?.email as string;
        if (requestedUserId && requestedUserId !== userId) {
            return res.status(403).json({ error: "User mismatch." });
        }
        const provider = BackendAIService.getProvider();

        // 1. Determine Cost
        let calculatedCost = 0;
        let costDescription = description || `AI Request (${action})`;

        if (action === 'GENERATE_TRIP') {
            calculatedCost = pricingService.calculate(action, { dateRange: tripInput?.dateRange });
            costDescription = `Generate Trip: ${tripInput?.destination}`;
        } else {
            calculatedCost = pricingService.calculate(action);
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
            const results = await provider.getRecommendations(location, interests, category, excludeNames, userId, undefined, language, titleLanguage);
            result = { text: JSON.stringify(results) };

        } else if (action === 'CHECK_FEASIBILITY') {
            const feasibility = await provider.checkFeasibility(tripData, modificationContext, userId, authToken, language);
            result = { text: JSON.stringify(feasibility) };

        } else if (action === 'GENERATE_TRIP') {
            const trip = await provider.generateTrip(tripInput, userId, authToken);
            result = { text: JSON.stringify(trip) };

        } else if (action === 'GENERATE_ADVISORY') {
            const advisory = await provider.generateAdvisory!(tripData, userId, authToken, language);
            result = { text: JSON.stringify(advisory) };

        } else {
            return res.status(400).json({ error: `Action ${action} not supported on /generate` });
        }

        res.json(result);

    } catch (error: any) {
        console.error("Error in /generate:", error);
        res.status(500).json({ error: error.message });
    }
}

export async function streamUpdate(req: Request, res: Response) {
    try {
        const { userId: requestedUserId, action, description, currentData, history, language, tripLanguage, tripInput, dayIndex, newMustVisit, newAvoid, keepExisting, removeExisting } = req.body;
        const authToken = (req.headers.authorization || '').replace('Bearer ', '');
        const authUser = (req as Request & { user?: { email?: string } }).user;
        const userId = authUser?.email as string;
        if (requestedUserId && requestedUserId !== userId) {
            return res.status(403).json({ error: "User mismatch." });
        }
        const provider = BackendAIService.getProvider();

        // 1. Transaction Logic
        if (userId) {
            let cost = pricingService.calculate(action);
            if (action === 'GENERATE_TRIP') cost = pricingService.calculate(action, { dateRange: tripInput?.dateRange });

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
            await provider.updateTrip(currentData, history, onThought, userId, authToken, language, tripLanguage);
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
                authToken,
                language,
                tripLanguage
            );
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();

        } else if (action === 'GENERATE_TRIP') {
            const keepAlive = setInterval(() => res.write(`: keep-alive\n\n`), 5000);
            try {
                const tripData = await provider.generateTrip(tripInput, userId, authToken);
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
}

export async function streamRecommendations(req: Request, res: Response) {
    try {
        const { userId: requestedUserId, location, interests, category, excludeNames, language, titleLanguage } = req.body;
        const authToken = (req.headers.authorization || '').replace('Bearer ', '');
        const authUser = (req as Request & { user?: { email?: string } }).user;
        const userId = authUser?.email as string;
        if (requestedUserId && requestedUserId !== userId) {
            return res.status(403).json({ error: "User mismatch." });
        }
        const provider = BackendAIService.getProvider();

        // 1. Transaction Logic
        // 1. Transaction Logic
        const baseCost = pricingService.calculate('GET_RECOMMENDATIONS');
        const { mode, sessionId, queueSize: requestedQueueSize } = req.body; // Expanded params

        let shouldDeduct = true;
        let finalCost = baseCost;
        let transactionDesc = `Recommendations: ${location} (${category})`;
        let activeSessionId = sessionId;

        if (mode === 'init') {
            // "Init" = Pay for Base Batch + Queue Size (Prepaid Batches)
            const qSize = typeof requestedQueueSize === 'number' ? requestedQueueSize : 0;
            finalCost = baseCost * (1 + qSize);
            transactionDesc = `Recommendations Session (Start + ${qSize} buffered)`;
        } else if (mode === 'next') {
            // "Next" = Consume Prepaid Quota
            if (!activeSessionId) return res.status(400).json({ error: "Session ID required for next batch" });

            // Security: Verify Session Ownership
            const session = sessionStore.getSession(activeSessionId);
            if (!session) {
                return res.status(404).json({ error: "Session not found or expired" });
            }
            if (session.userId !== userId) {
                return res.status(403).json({ error: "Unauthorized access to this session" });
            }

            const hasQuota = sessionStore.consumeQuota(activeSessionId);
            if (!hasQuota) {
                return res.status(402).json({ error: "Quota exceeded. Payment required.", code: "QUOTA_EXCEEDED" });
            }
            shouldDeduct = false; // Already paid via Session Init
        }
        // Default/Legacy: Pay-per-call (shouldDeduct=true, finalCost=baseCost)

        if (userId && shouldDeduct) {
            if (!authToken) return res.status(401).json({ error: "Missing auth token." });
            const success = await deductPoints(userId, finalCost, transactionDesc, authToken);
            if (!success) return res.status(403).json({ error: "Insufficient points" });
        }

        // If 'init' mode and successful deduction, create session
        if (mode === 'init' && userId) {
            const qSize = typeof requestedQueueSize === 'number' ? requestedQueueSize : 0;
            // Create session with 'qSize' credits (for *future* 'next' calls)
            activeSessionId = sessionStore.createSession(userId, qSize, { location, interests });
        }

        // 2. Set Headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // If we have a session (init or next), send the ID first
        if (activeSessionId) {
            res.write(`data: ${JSON.stringify({ type: 'meta', sessionId: activeSessionId })}\n\n`);
        }

        // 3. Stream Recommendations
        if (provider.getRecommendationsStream) {
            // Use streaming if available
            await provider.getRecommendationsStream(
                location,
                interests,
                category || 'attraction',
                excludeNames || [],
                (item) => {
                    res.write(`data: ${JSON.stringify({ type: 'item', item })}

`);
                },
                userId,
                authToken,
                language,
                titleLanguage,
                RECOMMENDATION_COUNT
            );
        } else {
            // Fallback to non-streaming
            const items = await provider.getRecommendations(
                location,
                interests,
                category || 'attraction',
                excludeNames || [],
                userId,
                undefined,
                language,
                titleLanguage
            );
            for (const item of items) {
                res.write(`data: ${JSON.stringify({ type: 'item', item })}

`);
            }
        }

        res.write(`data: ${JSON.stringify({ type: 'done' })}

`);
        res.end();

    } catch (error: any) {
        console.error("Error in /stream-recommendations:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        } else {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}

`);
            res.end();
        }
    }
}

