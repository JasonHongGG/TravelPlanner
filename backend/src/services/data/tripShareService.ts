import type { Response } from 'express';
import { calculateTrendingScore, canEditTrip, createSharedTripSnapshot, createTripMetaSnapshot, resolveTripPermission } from './tripShareDomain.js';
import { tripShareEventBus, type TripShareEventBus } from './tripShareEvents.js';
import { tripShareRepository, type TripShareRepository } from './tripShareRepository.js';
import type { Engagement, GalleryResponse, SaveTripParams, SharedTrip, SharedTripMeta, SharedTripWithPermission, TripPermission, TripVisibility } from './tripShareTypes.js';

const VIEW_DEBOUNCE_MS = 60 * 1000;
const ENGAGEMENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export class TripShareService {
    constructor(
        private readonly repository: TripShareRepository = tripShareRepository,
        private readonly events: TripShareEventBus = tripShareEventBus
    ) { }

    subscribeToTrip(tripId: string, res: Response): void {
        this.events.subscribe(tripId, res);
    }

    getTripMeta(tripId: string): SharedTripMeta | null {
        return this.repository.getTripMeta(tripId);
    }

    getUserTrips(ownerId: string): SharedTripMeta[] {
        return this.repository.getUserTrips(ownerId);
    }

    getSharedTrip(tripId: string): SharedTrip | null {
        return this.repository.getSharedTrip(tripId);
    }

    saveTrip(params: SaveTripParams): string {
        const now = Date.now();
        const existing = this.repository.getSharedTrip(params.tripId);
        const existingMeta = this.repository.getTripMeta(params.tripId);

        if (existing && !canEditTrip(existing, params.reqUserEmail)) {
            throw new Error('Access denied: You do not have permission to edit this trip.');
        }

        const sharedTrip = createSharedTripSnapshot(params, existing, now);
        const meta = createTripMetaSnapshot(params, existing, existingMeta, now);

        this.repository.writeSharedTrip(sharedTrip);
        this.repository.writeTripMeta(meta);
        this.repository.upsertTripInIndex(params.tripId, params.visibility);

        this.events.publish(params.tripId, 'trip_updated', {
            tripId: params.tripId,
            lastModified: now,
            updatedBy: params.reqUserEmail
        });

        console.log(`[TripShareService] Saved trip ${params.tripId} as ${params.visibility} (by ${params.reqUserEmail})`);
        return params.tripId;
    }

    getTrip(tripId: string, requesterId?: string, userIp?: string): SharedTripWithPermission | null {
        const trip = this.repository.getSharedTrip(tripId);
        if (!trip) return null;

        const permission = resolveTripPermission(trip, requesterId);
        if (!permission) return null;

        this.recordEngagement(tripId, 'view', requesterId, userIp);
        return { ...trip, userPermission: permission };
    }

    canAccessTrip(tripId: string, requesterId?: string): boolean {
        const trip = this.repository.getSharedTrip(tripId);
        return Boolean(trip && resolveTripPermission(trip, requesterId));
    }

    updateVisibility(tripId: string, ownerId: string, visibility: TripVisibility): boolean {
        const trip = this.repository.getSharedTrip(tripId);
        if (!trip || trip.ownerId !== ownerId) return false;

        const now = Date.now();
        this.repository.writeSharedTrip({ ...trip, visibility, lastModified: now });

        const meta = this.repository.getTripMeta(tripId);
        if (meta) this.repository.writeTripMeta({ ...meta, visibility, lastModified: now });

        this.repository.upsertTripInIndex(tripId, visibility);
        this.events.publish(tripId, 'visibility_updated', { visibility });

        console.log(`[TripShareService] Updated visibility for ${tripId} to ${visibility}`);
        return true;
    }

    updatePermissions(tripId: string, ownerId: string, permissions: Record<string, TripPermission>): boolean {
        const trip = this.repository.getSharedTrip(tripId);
        if (!trip || trip.ownerId !== ownerId) return false;

        this.repository.writeSharedTrip({
            ...trip,
            permissions,
            allowedUsers: Object.keys(permissions),
            lastModified: Date.now()
        });

        this.events.publish(tripId, 'permissions_updated', { permissions });
        console.log(`[TripShareService] Updated permissions for ${tripId}`);
        return true;
    }

    deleteTrip(tripId: string, ownerId: string): 'success' | 'not_found' | 'unauthorized' {
        const trip = this.repository.getSharedTrip(tripId);
        if (!trip) return 'not_found';
        if (trip.ownerId !== ownerId) return 'unauthorized';

        this.events.publish(tripId, 'trip_deleted', { tripId });
        this.repository.deleteSharedTrip(tripId);
        this.repository.deleteTripMeta(tripId);
        this.repository.removeTripFromIndex(tripId);

        console.log(`[TripShareService] Deleted trip ${tripId}`);
        return 'success';
    }

    recordEngagement(tripId: string, type: 'view' | 'like', userId?: string, userIp?: string): void {
        const meta = this.repository.getTripMeta(tripId);
        if (!meta) return;

        const now = Date.now();
        if (type === 'view' && this.hasRecentView(meta.recentEngagements, now, userId, userIp)) {
            return;
        }

        const engagement: Engagement = { type, userId, userIp, timestamp: now };
        const recentEngagements = [...meta.recentEngagements, engagement]
            .filter(item => item.timestamp > now - ENGAGEMENT_RETENTION_MS);

        this.repository.writeTripMeta({
            ...meta,
            recentEngagements,
            viewCount: type === 'view' ? meta.viewCount + 1 : meta.viewCount,
            likeCount: type === 'like' ? meta.likeCount + 1 : meta.likeCount
        });
    }

    getPublicTrips(page = 1, pageSize = 12): GalleryResponse {
        const allMetas = this.repository.getPublicTripMetas()
            .sort((a, b) => calculateTrendingScore(b) - calculateTrendingScore(a));
        const start = (page - 1) * pageSize;
        return {
            trips: allMetas.slice(start, start + pageSize),
            total: allMetas.length,
            page,
            pageSize
        };
    }

    getRandomTrips(count = 6): SharedTripMeta[] {
        const allMetas = this.repository.getPublicTripMetas();
        for (let index = allMetas.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [allMetas[index], allMetas[swapIndex]] = [allMetas[swapIndex], allMetas[index]];
        }
        return allMetas.slice(0, count);
    }

    private hasRecentView(engagements: Engagement[], now: number, userId?: string, userIp?: string): boolean {
        return engagements.slice().reverse().some(engagement =>
            engagement.type === 'view' &&
            engagement.timestamp > now - VIEW_DEBOUNCE_MS &&
            Boolean((userId && engagement.userId === userId) || (userIp && engagement.userIp === userIp))
        );
    }
}

export const tripShareService = new TripShareService();

export const subscribeToTrip = (tripId: string, res: Response) => tripShareService.subscribeToTrip(tripId, res);
export const getTripMeta = (tripId: string) => tripShareService.getTripMeta(tripId);
export const getUserTrips = (ownerId: string) => tripShareService.getUserTrips(ownerId);
export const getSharedTrip = (tripId: string) => tripShareService.getSharedTrip(tripId);
export const saveTrip = (params: SaveTripParams) => tripShareService.saveTrip(params);
export const getTrip = (tripId: string, requesterId?: string, userIp?: string) => tripShareService.getTrip(tripId, requesterId, userIp);
export const canAccessTrip = (tripId: string, requesterId?: string) => tripShareService.canAccessTrip(tripId, requesterId);
export const updateVisibility = (tripId: string, ownerId: string, visibility: TripVisibility) => tripShareService.updateVisibility(tripId, ownerId, visibility);
export const updatePermissions = (tripId: string, ownerId: string, permissions: Record<string, TripPermission>) => tripShareService.updatePermissions(tripId, ownerId, permissions);
export const deleteTrip = (tripId: string, ownerId: string) => tripShareService.deleteTrip(tripId, ownerId);
export const recordEngagement = (tripId: string, type: 'view' | 'like', userId?: string, userIp?: string) => tripShareService.recordEngagement(tripId, type, userId, userIp);
export const getPublicTrips = (page?: number, pageSize?: number) => tripShareService.getPublicTrips(page, pageSize);
export const getRandomTrips = (count?: number) => tripShareService.getRandomTrips(count);