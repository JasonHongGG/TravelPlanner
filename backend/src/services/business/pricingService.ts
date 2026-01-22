import { COSTS, TRIP_DAILY_COST, NEW_USER_BONUS, ATTRACTION_SEARCH_COST, calculateCost, PointAction } from "../../config/costConfig";
import { GALLERY_PAGE_MAX, GALLERY_PAGE_SIZE_DEFAULT, GALLERY_PAGE_SIZE_MAX, RANDOM_TRIPS_DEFAULT, RANDOM_TRIPS_MAX, RECOMMENDATION_COUNT } from "../../config/apiLimits";

export class PricingService {
    getConfig() {
        return {
            TRIP_BASE_COST: COSTS.GENERATE_TRIP,
            TRIP_DAILY_COST,
            NEW_USER_BONUS,
            ATTRACTION_SEARCH_COST,
            RECOMMENDATION_COUNT,
            GALLERY_PAGE_SIZE_DEFAULT,
            GALLERY_PAGE_SIZE_MAX,
            GALLERY_PAGE_MAX,
            RANDOM_TRIPS_DEFAULT,
            RANDOM_TRIPS_MAX
        };
    }

    calculate(action: string, params?: any): number {
        return calculateCost(action as PointAction, params);
    }
}

export const pricingService = new PricingService();
