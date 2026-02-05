
import { TRIP_BASE_COST, TRIP_DAILY_COST } from "../config/costConfig";

export const calculateTripCost = (dateRange: string): number => {
    // Default to at least 1 day if parsing fails
    let days = 1;

    // Try to find "N 天" or "N days" pattern first (e.g. "共 7 天")
    const daysMatch = dateRange.match(/(\d+)\s*(?:天|Days|days|Day|day)/);
    if (daysMatch) {
        days = parseInt(daysMatch[1], 10);
    } else {
        // Try to parse date range "YYYY/MM/DD - YYYY/MM/DD" or "MM/DD - MM/DD"
        try {
            const parts = dateRange.split('-').map(s => s.trim());
            if (parts.length === 2) {
                const start = new Date(parts[0]);
                const end = new Date(parts[1]);

                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    // Usually trips are inclusive, so diffDays + 1
                    days = diffDays + 1;
                }
            }
        } catch (e) {
            console.warn("Failed to parse date range for cost calculation:", dateRange, e);
        }
    }

    // Safety check
    if (days < 1) days = 1;

    return TRIP_BASE_COST + (days * TRIP_DAILY_COST);
};
