import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

// Interface extension express Request to include correlationId
declare global {
    namespace Express {
        interface Request {
            correlationId?: string;
        }
    }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    // 1. Generate or extract Correlation ID
    const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
    req.correlationId = correlationId;

    // Add correlation ID to response headers so frontend can track it
    res.setHeader('X-Correlation-ID', correlationId);

    // 2. Log Request Start
    const start = Date.now();
    const userId = (req as any).user?.email || 'anonymous';

    // Note: We avoid logging sensitive body data by default
    logger.http(`Incoming ${req.method} ${req.url}`, {
        correlationId,
        userId,
        ip: req.ip
    });

    // 3. Log Response (Hook into res.end to capture status)
    // We use 'finish' event which is standard in Express/Node
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;

        // Log level based on status
        if (status >= 500) {
            logger.error(`Response ${status} ${duration}ms`, { correlationId, userId });
        } else if (status >= 400) {
            logger.warn(`Response ${status} ${duration}ms`, { correlationId, userId });
        } else {
            logger.http(`Response ${status} ${duration}ms`, { correlationId, userId });
        }
    });

    next();
};
