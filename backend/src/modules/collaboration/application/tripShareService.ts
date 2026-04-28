import crypto from 'crypto';
import type { Response } from 'express';
import { calculateTrendingScore, canEditTrip, createOwnerMembership, createSharedTripSnapshot, createTripMetaSnapshot, normalizeUserId, permissionToMemberRole, resolveTripPermission, revokeMembership, upsertMembership } from '../domain/tripShareDomain.js';
import { tripShareEventBus, type TripShareEventBus } from './tripShareEvents.js';
import { tripShareRepository, type TripShareRepository } from '../infrastructure/json/tripShareRepository.js';
import type { Engagement, GalleryResponse, SaveTripParams, SharedTrip, SharedTripMeta, SharedTripWithPermission, Trip, TripPermission, TripVisibility, WorkspaceTripSummary } from '../domain/tripShareTypes.js';

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

    getWorkspaceTrips(userId: string): WorkspaceTripSummary[] {
        return this.repository.getWorkspaceTrips(userId);
    }

    getSharedTrip(tripId: string): SharedTrip | null {
        return this.repository.getSharedTrip(tripId);
    }

    createTripDocument(params: SaveTripParams): SharedTrip {
        const existing = this.repository.getSharedTrip(params.tripId);
        const normalizedOwner = normalizeUserId(params.ownerId);

        if (existing) {
            if (normalizeUserId(existing.ownerId) !== normalizedOwner) {
                throw new Error('Trip already exists and belongs to another owner.');
            }
            this.repository.restoreWorkspaceTrip(existing.ownerId, params.tripId);
            return existing;
        }

        const now = Date.now();
        const sharedTrip = createSharedTripSnapshot(params, null, now);
        const meta = createTripMetaSnapshot(params, null, null, now);
        const memberships = [createOwnerMembership(params.tripId, sharedTrip.ownerId, now)];

        this.repository.writeSharedTripBundle(sharedTrip, meta, memberships);
        this.repository.restoreWorkspaceTrip(sharedTrip.ownerId, params.tripId);
        this.publishTripEvent(params.tripId, 'trip_created', {
            tripId: params.tripId,
            visibility: sharedTrip.visibility,
            lastModified: now,
            revision: sharedTrip.revision,
            updatedBy: params.reqUserEmail
        }, sharedTrip.revision, params.reqUserEmail);

        console.log(`[TripShareService] Created trip document ${params.tripId} as ${sharedTrip.visibility} (by ${params.reqUserEmail})`);
        return sharedTrip;
    }

    updateTripContent(tripId: string, actorId: string, tripData: Trip, expectedRevision?: number): SharedTrip {
        const existing = this.repository.getSharedTrip(tripId);
        if (!existing) throw new Error('Trip not found.');
        if (!canEditTrip(existing, actorId)) throw new Error('Access denied: You do not have permission to edit this trip.');
        if (expectedRevision !== undefined && expectedRevision !== (existing.revision || 1)) {
            throw new Error(`Revision conflict: expected ${expectedRevision}, current ${existing.revision || 1}.`);
        }

        const now = Date.now();
        const existingMeta = this.repository.getTripMeta(tripId);
        const nextRevision = (existing.revision || 1) + 1;
        const nextTrip: SharedTrip = {
            ...existing,
            revision: nextRevision,
            lastModified: now,
            tripData: {
                ...tripData,
                ownerId: existing.ownerId,
                serverTripId: tripId,
                visibility: existing.visibility,
                userPermission: 'write',
                revision: nextRevision,
                lastSyncedAt: now
            }
        };
        const meta = createTripMetaSnapshot({
            tripId,
            ownerId: existing.ownerId,
            ownerName: existingMeta?.ownerName || existing.ownerId,
            ownerPicture: existingMeta?.ownerPicture,
            tripData: nextTrip.tripData,
            visibility: existing.visibility,
            reqUserEmail: actorId
        }, existing, existingMeta, now);

        this.repository.writeSharedTripBundle(nextTrip, meta);
        this.publishTripEvent(tripId, 'trip_updated', { tripId, revision: nextRevision, lastModified: now, updatedBy: actorId }, nextRevision, actorId);
        return nextTrip;
    }

    getTrip(tripId: string, requesterId?: string, userIp?: string): SharedTripWithPermission | null {
        const trip = this.repository.getSharedTrip(tripId);
        if (!trip) return null;

        const permission = resolveTripPermission(trip, requesterId);
        if (!permission) return null;

        this.recordEngagement(tripId, 'view', requesterId, userIp);
        return { ...trip, memberships: trip.memberships || [], permissions: trip.permissions || {}, userPermission: permission };
    }

    canAccessTrip(tripId: string, requesterId?: string): boolean {
        const trip = this.repository.getSharedTrip(tripId);
        return Boolean(trip && resolveTripPermission(trip, requesterId));
    }

    updateVisibility(tripId: string, ownerId: string, visibility: TripVisibility): boolean {
        const trip = this.repository.getSharedTrip(tripId);
        if (!trip || trip.ownerId !== ownerId) return false;

        const now = Date.now();
        const nextRevision = (trip.revision || 1) + 1;
        const nextTrip = { ...trip, visibility, revision: nextRevision, lastModified: now };

        const meta = this.repository.getTripMeta(tripId);
        if (meta) this.repository.writeSharedTripBundle(nextTrip, { ...meta, visibility, lastModified: now });
        else this.repository.writeSharedTrip(nextTrip);

        this.publishTripEvent(tripId, 'visibility_updated', { visibility, revision: nextRevision, updatedBy: ownerId }, nextRevision, ownerId);

        console.log(`[TripShareService] Updated visibility for ${tripId} to ${visibility}`);
        return true;
    }

    updateMemberPermission(tripId: string, ownerId: string, memberEmail: string, permission: TripPermission): SharedTrip | null {
        const trip = this.repository.getSharedTrip(tripId);
        const normalizedMember = normalizeUserId(memberEmail);
        if (!trip || trip.ownerId !== ownerId || !normalizedMember) return null;
        const now = Date.now();
        const nextRevision = (trip.revision || 1) + 1;
        const memberships = upsertMembership(this.repository.getTripMemberships(tripId, { includeRevoked: true }), tripId, normalizedMember, permissionToMemberRole(permission), now);
        const nextTrip = { ...trip, revision: nextRevision, lastModified: now };
        const meta = this.repository.getTripMeta(tripId);
        if (meta) this.repository.writeSharedTripBundle(nextTrip, { ...meta, lastModified: now }, memberships);
        else {
            this.repository.writeSharedTrip(nextTrip);
            this.repository.writeTripMemberships(tripId, memberships);
        }
        this.repository.restoreWorkspaceTrip(normalizedMember, tripId);
        this.publishTripEvent(tripId, 'membership_updated', { memberEmail: normalizedMember, permission, updatedBy: ownerId }, nextRevision, ownerId);
        return this.repository.getSharedTrip(tripId);
    }

    revokeMember(tripId: string, ownerId: string, memberEmail: string): SharedTrip | null {
        const trip = this.repository.getSharedTrip(tripId);
        const normalizedMember = normalizeUserId(memberEmail);
        if (!trip || trip.ownerId !== ownerId || !normalizedMember) return null;
        const now = Date.now();
        const nextRevision = (trip.revision || 1) + 1;
        const memberships = revokeMembership(this.repository.getTripMemberships(tripId, { includeRevoked: true }), normalizedMember, now);
        const nextTrip = { ...trip, revision: nextRevision, lastModified: now };
        const meta = this.repository.getTripMeta(tripId);
        if (meta) this.repository.writeSharedTripBundle(nextTrip, { ...meta, lastModified: now }, memberships);
        else {
            this.repository.writeSharedTrip(nextTrip);
            this.repository.writeTripMemberships(tripId, memberships);
        }
        this.repository.markWorkspaceTripRemoved(normalizedMember, tripId);
        this.publishTripEvent(tripId, 'membership_updated', { memberEmail: normalizedMember, permission: undefined, updatedBy: ownerId }, nextRevision, ownerId);
        return this.repository.getSharedTrip(tripId);
    }

    removeFromWorkspace(tripId: string, userId: string): 'success' | 'not_found' | 'owner_cannot_remove' | 'unauthorized' {
        const trip = this.repository.getSharedTrip(tripId);
        if (!trip) return 'not_found';
        if (normalizeUserId(trip.ownerId) === normalizeUserId(userId)) return 'owner_cannot_remove';
        if (!resolveTripPermission(trip, userId)) return 'unauthorized';
        this.repository.markWorkspaceTripRemoved(userId, tripId);
        this.publishTripEvent(tripId, 'workspace_removed', { tripId, userId }, trip.revision || 1, userId);
        return 'success';
    }

    deleteTrip(tripId: string, ownerId: string): 'success' | 'not_found' | 'unauthorized' {
        const trip = this.repository.getSharedTrip(tripId);
        if (!trip) return 'not_found';
        if (trip.ownerId !== ownerId) return 'unauthorized';

        this.publishTripEvent(tripId, 'trip_deleted', { tripId, updatedBy: ownerId }, trip.revision || 1, ownerId);
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

    private publishTripEvent(tripId: string, type: string, data: Record<string, unknown>, revision?: number, actorId?: string): void {
        const eventId = crypto.randomUUID();
        const occurredAt = Date.now();
        this.repository.appendTripEvent({ eventId, tripId, type, revision, actorId, occurredAt, data });
        this.events.publish(tripId, type, { eventId, tripId, type, revision, actorId, occurredAt, ...data });
    }
}

export const tripShareService = new TripShareService();

export const subscribeToTrip = (tripId: string, res: Response) => tripShareService.subscribeToTrip(tripId, res);
export const getTripMeta = (tripId: string) => tripShareService.getTripMeta(tripId);
export const getUserTrips = (ownerId: string) => tripShareService.getUserTrips(ownerId);
export const getWorkspaceTrips = (userId: string) => tripShareService.getWorkspaceTrips(userId);
export const getSharedTrip = (tripId: string) => tripShareService.getSharedTrip(tripId);
export const createTripDocument = (params: SaveTripParams) => tripShareService.createTripDocument(params);
export const updateTripContent = (tripId: string, actorId: string, tripData: Trip, expectedRevision?: number) => tripShareService.updateTripContent(tripId, actorId, tripData, expectedRevision);
export const getTrip = (tripId: string, requesterId?: string, userIp?: string) => tripShareService.getTrip(tripId, requesterId, userIp);
export const canAccessTrip = (tripId: string, requesterId?: string) => tripShareService.canAccessTrip(tripId, requesterId);
export const updateVisibility = (tripId: string, ownerId: string, visibility: TripVisibility) => tripShareService.updateVisibility(tripId, ownerId, visibility);
export const updateMemberPermission = (tripId: string, ownerId: string, memberEmail: string, permission: TripPermission) => tripShareService.updateMemberPermission(tripId, ownerId, memberEmail, permission);
export const revokeMember = (tripId: string, ownerId: string, memberEmail: string) => tripShareService.revokeMember(tripId, ownerId, memberEmail);
export const removeFromWorkspace = (tripId: string, userId: string) => tripShareService.removeFromWorkspace(tripId, userId);
export const deleteTrip = (tripId: string, ownerId: string) => tripShareService.deleteTrip(tripId, ownerId);
export const recordEngagement = (tripId: string, type: 'view' | 'like', userId?: string, userIp?: string) => tripShareService.recordEngagement(tripId, type, userId, userIp);
export const getPublicTrips = (page?: number, pageSize?: number) => tripShareService.getPublicTrips(page, pageSize);
export const getRandomTrips = (count?: number) => tripShareService.getRandomTrips(count);