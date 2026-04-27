export type TripVisibility = 'private' | 'public';
export type TripPermission = 'read' | 'write';
export type TripMemberRole = 'owner' | 'editor' | 'viewer';
export type TripMemberStatus = 'active' | 'revoked';
export type WorkspaceTripSource = 'owned' | 'shared' | 'imported';

export interface Engagement {
    type: 'view' | 'like';
    userId?: string;
    userIp?: string;
    timestamp: number;
}

export interface TripInput {
    dateRange: string;
    destination: string;
    travelers: string;
    interests: string;
    budget: string;
    transport: string;
    accommodation: string;
    pace: string;
    mustVisit: string;
    language: string;
    constraints: string;
}

export interface Trip {
    id: string;
    title: string;
    createdAt: number;
    status: 'generating' | 'complete' | 'error';
    input: TripInput;
    data?: any;
    errorMsg?: string;
    generationTimeMs?: number;
    customCoverImage?: string;
    visibility?: TripVisibility;
    serverTripId?: string;
    lastSyncedAt?: number;
    ownerId?: string;
    userPermission?: TripPermission;
    workspaceSource?: WorkspaceTripSource;
    revision?: number;
}

export interface SharedTripMeta {
    tripId: string;
    ownerId: string;
    ownerName: string;
    ownerPicture?: string;
    visibility: TripVisibility;
    title: string;
    destination: string;
    coverImage?: string;
    dateRange: string;
    days: number;
    createdAt: number;
    lastModified: number;
    viewCount: number;
    likeCount: number;
    recentEngagements: Engagement[];
    language?: string;
}

export interface SharedTrip {
    tripId: string;
    ownerId: string;
    visibility: TripVisibility;
    memberships?: TripMembership[];
    permissions?: Record<string, TripPermission>;
    revision?: number;
    createdAt: number;
    lastModified: number;
    tripData: Trip;
}

export interface TripMembership {
    schemaVersion: 1;
    tripId: string;
    userId: string;
    role: TripMemberRole;
    status: TripMemberStatus;
    createdAt: number;
    updatedAt: number;
}

export interface TripIndex {
    publicTrips: string[];
    sharedPrivateTrips: string[];
}

export interface GalleryResponse {
    trips: SharedTripMeta[];
    total: number;
    page: number;
    pageSize: number;
}

export interface SaveTripParams {
    tripId: string;
    ownerId: string;
    ownerName: string;
    ownerPicture?: string;
    tripData: Trip;
    visibility: TripVisibility;
    reqUserEmail?: string;
    expectedRevision?: number;
}

export type SharedTripWithPermission = SharedTrip & {
    userPermission?: TripPermission;
    memberships: TripMembership[];
    permissions: Record<string, TripPermission>;
};

export interface WorkspaceTripSummary extends SharedTripMeta {
    source: WorkspaceTripSource;
    role: TripMemberRole;
    revision: number;
}

export interface UserWorkspaceState {
    schemaVersion: 1;
    removedTripIds: string[];
}

export interface TripEventLogEntry {
    eventId: string;
    tripId: string;
    type: string;
    revision?: number;
    actorId?: string;
    occurredAt: number;
    data?: unknown;
}