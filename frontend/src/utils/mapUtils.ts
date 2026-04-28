/**
 * Generates a Google Maps Search Link for a specific query (place name).
 */
export const getGoogleMapsSearchLink = (query: string): string => {
    if (!query) return '#';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

/**
 * Generates a Google Maps Directions Link between two points.
 * Defaults to 'transit' mode.
 */
export const getGoogleMapsDirectionsLink = (origin: string, destination: string): string => {
    if (!origin || !destination) return '#';
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=transit`;
};
