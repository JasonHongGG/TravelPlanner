import type { Trip, TripVisibility, SharedTrip, SharedTripMeta, GalleryResponse, WorkspaceTripSummary } from '../types';
import { API_BASE_URL, apiUrl, getAuthHeaders, requestBlob, requestJson } from './http/apiClient';

// ==========================================
// TripShareService - Frontend API Client
// ==========================================

class TripShareService {
    // ==========================================
    // Trip Operations
    // ==========================================

    async createTripDocument(trip: Trip, visibility: TripVisibility): Promise<{ tripId: string; revision: number; lastModified: number }> {
        const tripId = trip.serverTripId || trip.id;
        return await requestJson<{ tripId: string; revision: number; lastModified: number }>('/api/trips', {
            method: 'POST',
            body: { tripId, tripData: trip, visibility },
            fallbackMessage: 'Failed to create trip document'
        });
    }

    async updateTripContent(tripId: string, trip: Trip, expectedRevision?: number): Promise<{ tripId: string; revision: number; lastModified: number }> {
        return await requestJson<{ tripId: string; revision: number; lastModified: number }>(`/api/trips/${tripId}/content`, {
            method: 'PATCH',
            body: { tripData: trip, expectedRevision },
            fallbackMessage: 'Failed to update trip content'
        });
    }

    async getTrip(tripId: string): Promise<SharedTrip> {
        return await requestJson<SharedTrip>(`/api/trips/${tripId}`, {
            fallbackMessage: 'Failed to get trip'
        });
    }

    async deleteServerTrip(tripId: string): Promise<void> {
        const response = await fetch(apiUrl(`/api/trips/${tripId}`), {
            method: 'DELETE',
            headers: getAuthHeaders()
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
        try {
            const result = await requestJson<{ tripIds?: string[] }>('/api/trips/my', {
                fallbackMessage: 'Failed to fetch shared trips'
            });
            return result.tripIds || [];
        } catch {
            return [];
        }
    }

    async getWorkspaceTrips(): Promise<WorkspaceTripSummary[]> {
        const result = await requestJson<{ trips?: WorkspaceTripSummary[] }>('/api/workspace/trips', {
            fallbackMessage: 'Failed to fetch workspace trips'
        });
        return result.trips || [];
    }

    async removeFromWorkspace(tripId: string): Promise<void> {
        await requestJson<{ message: string }>(`/api/workspace/trips/${tripId}`, {
            method: 'DELETE',
            fallbackMessage: 'Failed to remove trip from workspace'
        });
    }

    // ==========================================
    // Visibility & Permissions
    // ==========================================

    async updateVisibility(tripId: string, visibility: TripVisibility): Promise<void> {
        await requestJson<{ message: string }>(`/api/trips/${tripId}/visibility`, {
            method: 'PATCH',
            body: { visibility },
            fallbackMessage: 'Failed to update visibility'
        });
    }

    async upsertMember(tripId: string, email: string, permission: 'read' | 'write'): Promise<void> {
        await requestJson<{ message?: string }>(`/api/trips/${tripId}/members`, {
            method: 'POST',
            body: { email, permission },
            fallbackMessage: 'Failed to update member'
        });
    }

    async revokeMember(tripId: string, email: string): Promise<void> {
        await requestJson<{ message?: string }>(`/api/trips/${tripId}/members/${encodeURIComponent(email)}`, {
            method: 'DELETE',
            fallbackMessage: 'Failed to revoke member'
        });
    }

    async createTripEventToken(tripId: string): Promise<string> {
        const result = await requestJson<{ token: string }>(`/api/trips/${tripId}/events-token`, {
            method: 'POST',
            fallbackMessage: 'Failed to create trip event token'
        });
        return result.token;
    }

    subscribeToTrip(tripId: string, onMessage: (type: string, data: any) => void, token?: string): EventSource {
        const params = token ? `?token=${encodeURIComponent(token)}` : '';
        const url = `${API_BASE_URL}/api/trips/${tripId}/events${params}`;
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
        eventSource.addEventListener('trip_created', handler);
        eventSource.addEventListener('membership_updated', handler);
        eventSource.addEventListener('workspace_removed', handler);
        eventSource.addEventListener('trip_deleted', handler);
        eventSource.addEventListener('connected', (e) => console.log('SSE Connected', e.data));

        return eventSource;
    }

    // ==========================================
    // Engagement
    // ==========================================

    async likeTrip(tripId: string): Promise<number> {
        const result = await requestJson<{ likeCount: number }>(`/api/trips/${tripId}/like`, {
            method: 'POST',
            fallbackMessage: 'Failed to like trip'
        });
        return result.likeCount;
    }

    // ==========================================
    // Gallery
    // ==========================================

    async getGallery(page: number = 1, pageSize: number = 12): Promise<GalleryResponse> {
        return await requestJson<GalleryResponse>(`/api/gallery?page=${page}&pageSize=${pageSize}`, {
            fallbackMessage: 'Failed to get gallery'
        });
    }

    async getRandomTrips(count: number = 6): Promise<SharedTripMeta[]> {
        const result = await requestJson<{ trips: SharedTripMeta[] }>(`/api/gallery/random?count=${count}`, {
            fallbackMessage: 'Failed to get random trips'
        });
        return result.trips;
    }

    // ==========================================
    // Helpers
    // ==========================================

    getShareUrl(tripId: string): string {
        const baseUrl = window.location.origin;
        return `${baseUrl}/trip/${tripId}`;
    }

    async exportTripJson(tripData: Trip): Promise<Blob> {
        try {
            return await requestBlob('/api/exports/json', {
                method: 'POST',
                body: { tripData },
                fallbackMessage: 'Failed to export trip'
            });
        } catch (error: any) {
            if (error.message?.includes('403')) {
                throw new Error('Subscription required');
            }
            throw error;
        }
    }
}

export const tripShareService = new TripShareService();
export default tripShareService;
