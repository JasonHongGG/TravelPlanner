import { deductPoints } from './pointsService.js';
import { pricingService } from './pricingService.js';

export class HttpError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string,
        public readonly code?: string
    ) {
        super(message);
    }
}

type ChargePointsInput = {
    userId?: string;
    authToken?: string;
    cost: number;
    description: string;
    metadata?: Record<string, unknown>;
    idempotencyKey?: string;
    transactionId?: string;
    insufficientMessage?: string;
};

type ChargeActionInput = Omit<ChargePointsInput, 'cost'> & {
    action: string;
    dateRange?: string;
};

export class BillingService {
    calculate(action: string, params?: Record<string, unknown>): number {
        return pricingService.calculate(action, params);
    }

    async chargePoints(input: ChargePointsInput): Promise<boolean> {
        if (!input.userId || input.cost <= 0) return true;
        if (!input.authToken) throw new HttpError(401, 'Missing auth token.');

        const success = await deductPoints(
            input.userId,
            input.cost,
            input.description,
            input.authToken,
            input.metadata,
            {
                idempotencyKey: input.idempotencyKey,
                transactionId: input.transactionId
            }
        );

        if (!success) {
            throw new HttpError(403, input.insufficientMessage || 'Insufficient points or Unauthorized.');
        }
        return true;
    }

    async chargeAction(input: ChargeActionInput): Promise<number> {
        const params = input.dateRange ? { dateRange: input.dateRange } : undefined;
        const cost = this.calculate(input.action, params);
        await this.chargePoints({ ...input, cost });
        return cost;
    }
}

export const billingService = new BillingService();