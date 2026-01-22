// Recommendations: fixed server-side batch size (frontend does NOT send count)
export const RECOMMENDATION_COUNT = 12;

// Gallery pagination: frontend may send page/pageSize, server clamps with these limits
export const GALLERY_PAGE_SIZE_DEFAULT = 12;
export const GALLERY_PAGE_SIZE_MAX = 24;
// Max allowed page index to avoid abusive deep pagination scans
export const GALLERY_PAGE_MAX = 1000;

// Random trips: frontend may send count, server clamps with these limits
export const RANDOM_TRIPS_DEFAULT = 6;
export const RANDOM_TRIPS_MAX = 12;