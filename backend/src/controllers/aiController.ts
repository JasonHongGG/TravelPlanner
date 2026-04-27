import type { Request, Response } from 'express';
import { pricingService } from '../services/business/pricingService.js';
import { packageService } from '../services/business/packageService.js';
import { SseWriter } from '../services/http/sseWriter.js';
import { HttpError } from '../services/business/billingService.js';
import { runGenerateAction, runRecommendationStream, runStreamUpdateAction } from '../services/business/aiRequestUseCases.js';
import {
    ackGenerationJobForUser,
    claimGenerationJobForUser,
    createOrReuseGenerationJob,
    getGenerationJobForUser,
    initGenerationJobMaintenance as initGenerationJobMaintenanceService
} from '../services/business/generationJobService.js';

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

        const result = await runGenerateAction({
            action,
            description,
            tripInput,
            location,
            interests,
            category,
            excludeNames,
            language,
            titleLanguage,
            tripData,
            modificationContext,
            userId,
            authToken
        });

        res.json(result);

    } catch (error: any) {
        console.error("Error in /generate:", error);
        if (error instanceof HttpError) {
            return res.status(error.statusCode).json({ error: error.message, code: error.code });
        }
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

        await runStreamUpdateAction({
            action,
            description,
            currentData,
            history,
            language,
            tripLanguage,
            tripInput,
            dayIndex,
            newMustVisit,
            newAvoid,
            keepExisting,
            removeExisting,
            userId,
            authToken
        }, new SseWriter(res));

    } catch (error: any) {
        console.error("Error in /stream-update:", error);
        if (error instanceof HttpError && !res.headersSent) {
            return res.status(error.statusCode).json({ error: error.message, code: error.code });
        }
        if (!res.headersSent) res.status(500).json({ error: error.message });
    }
}

export async function createGenerationJobHandler(req: Request, res: Response) {
    try {
        const { userId: requestedUserId, action, tripInput, tripLocalId, clientRequestId, description } = req.body;
        const authToken = (req.headers.authorization || '').replace('Bearer ', '');
        const authUser = (req as Request & { user?: { email?: string } }).user;
        const userId = authUser?.email as string;

        if (!userId) return res.status(401).json({ error: 'Missing authenticated user.' });
        if (requestedUserId && requestedUserId !== userId) {
            return res.status(403).json({ error: 'User mismatch.' });
        }
        if (action !== 'GENERATE_TRIP') {
            return res.status(400).json({ error: 'Only GENERATE_TRIP supports durable generation job.' });
        }
        if (!tripInput || typeof tripInput !== 'object') {
            return res.status(400).json({ error: 'tripInput is required.' });
        }
        if (!clientRequestId || typeof clientRequestId !== 'string') {
            return res.status(400).json({ error: 'clientRequestId is required.' });
        }

        if (!authToken) return res.status(401).json({ error: 'Missing auth token.' });

        const result = createOrReuseGenerationJob({
            userId,
            authToken,
            tripLocalId,
            clientRequestId,
            tripInput,
            description
        });

        return res.status(result.statusCode).json(result.job);
    } catch (error: any) {
        console.error('Error in /generation-jobs:', error);
        return res.status(500).json({ error: error.message });
    }
}

export async function getGenerationJobHandler(req: Request, res: Response) {
    try {
        const jobIdParam = req.params.jobId;
        const jobId = Array.isArray(jobIdParam) ? jobIdParam[0] : jobIdParam;
        const authUser = (req as Request & { user?: { email?: string } }).user;
        const userId = authUser?.email as string;

        if (!userId) return res.status(401).json({ error: 'Missing authenticated user.' });
        if (!jobId) return res.status(400).json({ error: 'jobId is required.' });

        const result = getGenerationJobForUser(jobId, userId);
        return res.status(result.statusCode).json(result.body);
    } catch (error: any) {
        console.error('Error in GET /generation-jobs/:jobId:', error);
        return res.status(500).json({ error: error.message });
    }
}

export async function claimGenerationJobHandler(req: Request, res: Response) {
    try {
        const jobIdParam = req.params.jobId;
        const jobId = Array.isArray(jobIdParam) ? jobIdParam[0] : jobIdParam;
        const authUser = (req as Request & { user?: { email?: string } }).user;
        const userId = authUser?.email as string;

        if (!userId) return res.status(401).json({ error: 'Missing authenticated user.' });
        if (!jobId) return res.status(400).json({ error: 'jobId is required.' });

        const result = claimGenerationJobForUser(jobId, userId);
        return res.status(result.statusCode).json(result.body);
    } catch (error: any) {
        console.error('Error in POST /generation-jobs/:jobId/claim:', error);
        return res.status(500).json({ error: error.message });
    }
}

export async function ackGenerationJobHandler(req: Request, res: Response) {
    try {
        const jobIdParam = req.params.jobId;
        const jobId = Array.isArray(jobIdParam) ? jobIdParam[0] : jobIdParam;
        const { claimToken } = req.body || {};
        const authUser = (req as Request & { user?: { email?: string } }).user;
        const userId = authUser?.email as string;

        if (!userId) return res.status(401).json({ error: 'Missing authenticated user.' });
        if (!jobId) return res.status(400).json({ error: 'jobId is required.' });
        if (!claimToken || typeof claimToken !== 'string') {
            return res.status(400).json({ error: 'claimToken is required.' });
        }

        const result = ackGenerationJobForUser(jobId, userId, claimToken);
        return res.status(result.statusCode).json(result.body);
    } catch (error: any) {
        console.error('Error in POST /generation-jobs/:jobId/ack:', error);
        return res.status(500).json({ error: error.message });
    }
}

export function initGenerationJobMaintenance() {
    initGenerationJobMaintenanceService();
}

export async function streamRecommendations(req: Request, res: Response) {
    try {
        const { userId: requestedUserId, location, interests, category, excludeNames, language, titleLanguage, mode, sessionId, queueSize } = req.body;
        const authToken = (req.headers.authorization || '').replace('Bearer ', '');
        const authUser = (req as Request & { user?: { email?: string } }).user;
        const userId = authUser?.email as string;
        if (requestedUserId && requestedUserId !== userId) {
            return res.status(403).json({ error: "User mismatch." });
        }
        await runRecommendationStream({
            userId,
            authToken,
            location,
            interests,
            category,
            excludeNames,
            language,
            titleLanguage,
            mode,
            sessionId,
            queueSize
        }, new SseWriter(res));

    } catch (error: any) {
        console.error("Error in /stream-recommendations:", error);
        if (!res.headersSent) {
            if (error instanceof HttpError) {
                res.status(error.statusCode).json({ error: error.message, code: error.code });
            } else {
                res.status(500).json({ error: error.message });
            }
        } else {
            new SseWriter(res).error(error.message);
            res.end();
        }
    }
}

