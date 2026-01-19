import { TRIP_BASE_COST, TRIP_DAILY_COST } from '../constants/pointsConfig';
import { Trip } from '../types';

export const calculateTripCost = (dateRange: string): number => {
    // Default to at least 1 day if parsing fails
    let days = 1;

    // Try to find "N 天" or "N days" pattern first (e.g. "共 7 天")
    const daysMatch = dateRange.match(/(\d+)\s*(?:天|Days|days|Day|day)/);
    if (daysMatch) {
        days = parseInt(daysMatch[1], 10);
    } else {
        // Try to parse date range "YYYY/MM/DD - YYYY/MM/DD" or "MM/DD - MM/DD"
        // This is a naive implementation assuming the input is relatively standard
        try {
            const parts = dateRange.split('-').map(s => s.trim());
            if (parts.length === 2) {
                // Heuristic: if no year, assume current year? 
                // Let's just try to parse directly.
                const start = new Date(parts[0]);
                const end = new Date(parts[1]);

                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    // If start == end, it's 1 day (diffDays is 0 usually if times match, or 1 if inclusive logic needed)
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

export const getTripCover = (trip: Trip): string => {
    if (!trip) return '';

    // 1. Priority: Custom User Upload
    if (trip.customCoverImage) {
        return trip.customCoverImage;
    }

    if (!trip.input || !trip.input.destination) return '';

    const city = trip.input.destination.split(',')[0].trim();

    // Deterministic random based on Trip ID
    // We sum the char codes of the trip ID to get a pseudo-random seed
    const seed = trip.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    const keywords = ["landmark", "scenery", "travel", "attraction", "view"];
    const index = seed % keywords.length;
    const keyword = keywords[index];

    return `https://th.bing.com/th?q=${encodeURIComponent(city + ' ' + keyword)}&w=1280&h=720&c=7&rs=1&p=0`;
};
