import type { Trip, TripVisibility, SharedTrip, SharedTripMeta, GalleryResponse } from '../types';

// ==========================================
// TripShareService - Frontend API Client
// ==========================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

class TripShareService {
    private getAuthHeaders(): HeadersInit {
        const token = localStorage.getItem('google_auth_token');
        const headers: HeadersInit = {
            'Content-Type': 'application/json'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    // ==========================================
    // Trip Operations
    // ==========================================

    async saveTrip(trip: Trip, visibility: TripVisibility): Promise<string> {
        const tripId = trip.serverTripId || trip.id;

        const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}`, {
            method: 'PUT',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ tripData: trip, visibility })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save trip');
        }

        const result = await response.json();
        return result.tripId;
    }

    async getTrip(tripId: string): Promise<SharedTrip> {
        const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}`, {
            method: 'GET',
            headers: this.getAuthHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get trip');
        }

        return response.json();
    }

    async deleteServerTrip(tripId: string): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}`, {
            method: 'DELETE',
            headers: this.getAuthHeaders()
        });

        // If 404, it means trip is already gone, which corresponds to "unshared" state.
        if (response.status === 404) {
            return;
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete trip');
        }
    }

    async getMySharedTripIds(): Promise<string[]> {
        const response = await fetch(`${API_BASE_URL}/api/trips/my`, {
            method: 'GET',
            headers: this.getAuthHeaders()
        });

        if (!response.ok) {
            // If unauthorized or error, return empty array
            return [];
        }

        const result = await response.json();
        return result.tripIds || [];
    }

    // ==========================================
    // Visibility & Permissions
    // ==========================================

    async updateVisibility(tripId: string, visibility: TripVisibility): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/visibility`, {
            method: 'PATCH',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ visibility })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update visibility');
        }
    }

    async updatePermissions(tripId: string, permissions: Record<string, 'read' | 'write'>): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/permissions`, {
            method: 'PATCH',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ permissions })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update permissions');
        }
    }

    subscribeToTrip(tripId: string, onMessage: (type: string, data: any) => void): EventSource {
        const url = `${API_BASE_URL}/api/trips/${tripId}/events`;
        // Note: EventSource does not support custom headers. 
        // If auth is needed, we must pass token in query param.
        const eventSource = new EventSource(url);

        const handler = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                onMessage(event.type, data);
            } catch (e) {
                console.error('Failed to parse SSE message', e);
            }
        };

        eventSource.addEventListener('trip_updated', handler);
        eventSource.addEventListener('visibility_updated', handler);
        eventSource.addEventListener('permissions_updated', handler);
        eventSource.addEventListener('trip_deleted', handler);
        eventSource.addEventListener('connected', (e) => console.log('SSE Connected', e.data));

        return eventSource;
    }

    // ==========================================
    // Engagement
    // ==========================================

    async likeTrip(tripId: string): Promise<number> {
        const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/like`, {
            method: 'POST',
            headers: this.getAuthHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to like trip');
        }

        const result = await response.json();
        return result.likeCount;
    }

    // ==========================================
    // Gallery
    // ==========================================

    async getGallery(page: number = 1, pageSize: number = 12): Promise<GalleryResponse> {
        const response = await fetch(
            `${API_BASE_URL}/api/gallery?page=${page}&pageSize=${pageSize}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get gallery');
        }

        return response.json();
    }

    async getRandomTrips(count: number = 6): Promise<SharedTripMeta[]> {
        const response = await fetch(
            `${API_BASE_URL}/api/gallery/random?count=${count}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get random trips');
        }

        const result = await response.json();
        return result.trips;
    }

    // ==========================================
    // Helpers
    // ==========================================

    getShareUrl(tripId: string): string {
        const baseUrl = window.location.origin;
        return `${baseUrl}/trip/${tripId}`;
    }
}

export const tripShareService = new TripShareService();
export default tripShareService;
