import type { Trip } from '../types';

const TRIPS_STORAGE_KEY = 'ai_travel_trips';

export function tripWorkspaceStorageKey(userEmail?: string): string {
    const normalized = userEmail?.trim().toLowerCase();
    if (!normalized) return TRIPS_STORAGE_KEY;
    return `${TRIPS_STORAGE_KEY}:${btoa(normalized).replace(/=+$/, '')}`;
}

export function loadWorkspaceTrips(userEmail?: string): Trip[] {
    try {
        const key = tripWorkspaceStorageKey(userEmail);
        const saved = localStorage.getItem(key) || (userEmail ? localStorage.getItem(TRIPS_STORAGE_KEY) : null);
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error('Failed to parse workspace trips', error);
        return [];
    }
}

export function saveWorkspaceTrips(trips: Trip[], userEmail?: string): void {
    localStorage.setItem(tripWorkspaceStorageKey(userEmail), JSON.stringify(trips));
}