import { calculateTripCost } from '../utils/sharedUtils';

export const TRIP_BASE_COST = 50;
export const TRIP_DAILY_COST = 10;
export const NEW_USER_BONUS = 500;
export const ATTRACTION_SEARCH_COST = 10;

export const COSTS = {
    GENERATE_TRIP: TRIP_BASE_COST,
    CHAT_UPDATE: 10,
    GET_RECOMMENDATIONS: 20,
    CHECK_FEASIBILITY: 0
};


export type PointAction = keyof typeof COSTS;

export const calculateCost = (action: string, params?: any): number => {
    if (action === 'GENERATE_TRIP') {
        if (params && params.dateRange) {
            return calculateTripCost(params.dateRange);
        }
        return COSTS.GENERATE_TRIP;
    }
    return (COSTS as any)[action] || 9999;
};
