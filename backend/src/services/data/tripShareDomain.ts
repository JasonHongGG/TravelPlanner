import type { Engagement, SaveTripParams, SharedTrip, SharedTripMeta, TripMemberRole, TripMembership, TripPermission, TripVisibility } from './tripShareTypes.js';

export function normalizeUserId(userId?: string): string | undefined {
    return userId?.trim().toLowerCase() || undefined;
}

export function normalizeSharedTripDocument(trip: SharedTrip): SharedTrip {
    const record = trip as SharedTrip & Record<string, unknown>;
    delete record['allowedUsers'];
    delete record['permissions'];
    delete record['memberships'];
    return trip;
}

export function roleToPermission(role: TripMemberRole): TripPermission {
    return role === 'viewer' ? 'read' : 'write';
}

export function permissionToMemberRole(permission: TripPermission): TripMemberRole {
    return permission === 'write' ? 'editor' : 'viewer';
}

export function permissionsFromMemberships(memberships: TripMembership[], ownerId?: string): Record<string, TripPermission> {
    const normalizedOwner = normalizeUserId(ownerId);
    const permissions: Record<string, TripPermission> = {};
    for (const membership of memberships) {
        const userId = normalizeUserId(membership.userId);
        if (!userId || userId === normalizedOwner || membership.status !== 'active') continue;
        permissions[userId] = roleToPermission(membership.role);
    }
    return permissions;
}

function activeMembershipFor(trip: SharedTrip, requesterId?: string): TripMembership | undefined {
    const normalizedRequester = normalizeUserId(requesterId);
    if (!normalizedRequester) return undefined;
    return trip.memberships?.find(membership => membership.status === 'active' && normalizeUserId(membership.userId) === normalizedRequester);
}

export function createOwnerMembership(tripId: string, ownerId: string, now: number): TripMembership {
    return { schemaVersion: 1, tripId, userId: normalizeUserId(ownerId) || ownerId, role: 'owner', status: 'active', createdAt: now, updatedAt: now };
}

export function upsertMembership(memberships: TripMembership[], tripId: string, userId: string, role: TripMemberRole, now: number): TripMembership[] {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) return memberships;
    const existing = memberships.find(membership => normalizeUserId(membership.userId) === normalizedUserId);
    if (!existing) {
        return [...memberships, { schemaVersion: 1, tripId, userId: normalizedUserId, role, status: 'active', createdAt: now, updatedAt: now }];
    }
    return memberships.map(membership => normalizeUserId(membership.userId) === normalizedUserId
        ? { ...membership, role, status: 'active', updatedAt: now }
        : membership
    );
}

export function revokeMembership(memberships: TripMembership[], userId: string, now: number): TripMembership[] {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) return memberships;
    return memberships.map(membership => normalizeUserId(membership.userId) === normalizedUserId
        ? { ...membership, status: 'revoked', updatedAt: now }
        : membership
    );
}

export function resolveTripPermission(trip: SharedTrip, requesterId?: string): TripPermission | undefined {
    const normalizedRequester = normalizeUserId(requesterId);
    const normalizedOwner = normalizeUserId(trip.ownerId);
    if (normalizedRequester && normalizedOwner === normalizedRequester) return 'write';
    const membership = activeMembershipFor(trip, requesterId);
    if (membership) return roleToPermission(membership.role);
    if (trip.visibility === 'public') return 'read';
    return undefined;
}

export function canEditTrip(trip: SharedTrip, requesterId?: string): boolean {
    const normalizedRequester = normalizeUserId(requesterId);
    const normalizedOwner = normalizeUserId(trip.ownerId);
    const membership = activeMembershipFor(trip, requesterId);
    return Boolean(normalizedRequester && (normalizedOwner === normalizedRequester || membership?.role === 'editor' || membership?.role === 'owner'));
}

export function isTripOwner(trip: SharedTrip, requesterId?: string): boolean {
    return Boolean(normalizeUserId(requesterId) && normalizeUserId(trip.ownerId) === normalizeUserId(requesterId));
}

export function permissionToRole(trip: SharedTrip, requesterId?: string): TripMemberRole | undefined {
    if (isTripOwner(trip, requesterId)) return 'owner';
    const membership = activeMembershipFor(trip, requesterId);
    if (membership?.role === 'editor') return 'editor';
    if (membership?.role === 'viewer') return 'viewer';
    if (trip.visibility === 'public') return 'viewer';
    return undefined;
}

export function permissionToWorkspaceRole(trip: SharedTrip, requesterId?: string): TripMemberRole | undefined {
    if (isTripOwner(trip, requesterId)) return 'owner';
    const membership = activeMembershipFor(trip, requesterId);
    if (membership?.role === 'editor') return 'editor';
    if (membership?.role === 'viewer') return 'viewer';
    return undefined;
}

export function createSharedTripSnapshot(input: SaveTripParams, existing: SharedTrip | null, now: number): SharedTrip {
    const requesterIsOwner = !existing || isTripOwner(existing, input.reqUserEmail);
    const visibility = existing && !requesterIsOwner ? existing.visibility : input.visibility;
    const revision = (existing?.revision || 0) + 1;
    return {
        tripId: input.tripId,
        ownerId: existing?.ownerId || input.ownerId,
        visibility,
        memberships: existing?.memberships || [],
        revision,
        createdAt: existing?.createdAt || now,
        lastModified: now,
        tripData: { ...input.tripData, ownerId: existing?.ownerId || input.ownerId, serverTripId: input.tripId, visibility, lastSyncedAt: now, revision }
    };
}

export function createTripMetaSnapshot(input: SaveTripParams, existingTrip: SharedTrip | null, existingMeta: SharedTripMeta | null, now: number): SharedTripMeta {
    const requesterIsOwner = !existingTrip || isTripOwner(existingTrip, input.reqUserEmail);
    const visibility = existingTrip && !requesterIsOwner ? existingTrip.visibility : input.visibility;
    return {
        tripId: input.tripId,
        ownerId: existingTrip?.ownerId || input.ownerId,
        ownerName: existingMeta?.ownerName || input.ownerName,
        ownerPicture: existingMeta?.ownerPicture || input.ownerPicture,
        visibility,
        title: input.tripData.title || input.tripData.input?.destination || 'Untitled Trip',
        destination: input.tripData.input?.destination || '',
        coverImage: input.tripData.customCoverImage,
        dateRange: input.tripData.input?.dateRange || '',
        days: input.tripData.data?.tripMeta?.days || 0,
        createdAt: existingMeta?.createdAt || now,
        lastModified: now,
        viewCount: existingMeta?.viewCount || 0,
        likeCount: existingMeta?.likeCount || 0,
        recentEngagements: existingMeta?.recentEngagements || [],
        language: input.tripData.input?.language || 'zh-TW'
    };
}

export function calculateTrendingScore(meta: SharedTripMeta, now = Date.now()): number {
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentEngagements = meta.recentEngagements.filter(engagement => engagement.timestamp > sevenDaysAgo);
    const viewCount = recentEngagements.filter((engagement: Engagement) => engagement.type === 'view').length;
    const likeCount = recentEngagements.filter((engagement: Engagement) => engagement.type === 'like').length;
    return viewCount + likeCount * 3;
}

export function removeTripFromIndexList(ids: string[], tripId: string): string[] {
    return ids.filter(id => id !== tripId);
}

export function selectIndexList(visibility: TripVisibility): 'publicTrips' | 'sharedPrivateTrips' {
    return visibility === 'public' ? 'publicTrips' : 'sharedPrivateTrips';
}