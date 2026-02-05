import { Trip } from '../types';

// Defaults provided for safety, but usually passed from config
export const calculateTripCost = (dateRange: string, baseCost = 50, dailyCost = 10): number => {
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

    return baseCost + (days * dailyCost);
};

// Flexible interface to support both Trip (local) and SharedTripMeta (gallery)
interface TripCoverInput {
    id: string; // or tripId
    input?: { destination: string }; // Local Trip structure
    destination?: string; // SharedTripMeta structure
    customCoverImage?: string; // Local
    coverImage?: string; // Shared
}

export const getTripCover = (trip: any, size: 'large' | 'small' = 'large'): string => {
    if (!trip) return '';

    // 1. Priority: Custom User Upload
    const customImage = trip.customCoverImage || trip.coverImage;
    if (customImage) {
        return customImage;
    }

    // Resolve destination
    const destination = trip.destination || trip.input?.destination;
    if (!destination) return '';

    const city = destination.split(',')[0].trim();
    const tripId = trip.tripId || trip.id || 'default';

    // Deterministic random based on Trip ID
    // We sum the char codes of the trip ID to get a pseudo-random seed
    const seed = tripId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);

    // Expanded keywords from Random Cover logic (TripDetail.tsx)
    // Refined to "Safe" keywords that work for smaller locations (removed skyline, street view, etc.)
    const keywords = ["landmark", "landscape", "nature", "tourism", "scenery", "historic", "culture", "daytime", "vacation", "panoramic", "travel", "sightseeing"];
    const keywordIndex = seed % keywords.length;
    const keyword = keywords[keywordIndex];

    // Select index deterministically (0-19 for top 20 results)
    // We use a secondary hash (seed + keywordIndex) to ensure it's not identical correlation
    const index = (seed + keywordIndex) % 10;

    // Append negative keywords to verify strict compliance with user request
    const query = `${city} ${keyword}`;

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

    // Construct backend proxy URL
    // We use redirect=true so this URL can be used directly in <img src>
    return `${apiBaseUrl}/cover?query=${encodeURIComponent(query)}&redirect=true&index=${index}`;
};
