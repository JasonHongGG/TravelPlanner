import * as fs from 'fs';
import * as path from 'path';
import type { Response } from 'express';

// Type definitions (duplicated from shared to avoid cross-project imports)
type TripVisibility = 'private' | 'public';
type TripPermission = 'read' | 'write';

interface Engagement {
    type: 'view' | 'like';
    userId?: string;
    userIp?: string;
    timestamp: number;
}

interface TripInput {
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

interface Trip {
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
}

interface SharedTripMeta {
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

interface SharedTrip {
    tripId: string;
    ownerId: string;
    visibility: TripVisibility;
    // Legacy support: allowedUsers is string[]
    allowedUsers?: string[];
    // New support: permissions object
    permissions: Record<string, TripPermission>;
    createdAt: number;
    lastModified: number;
    tripData: Trip;
}

interface TripIndex {
    publicTrips: string[];
    sharedPrivateTrips: string[];
}

interface GalleryResponse {
    trips: SharedTripMeta[];
    total: number;
    page: number;
    pageSize: number;
}

// ==========================================
// File Path Helpers
// ==========================================

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../../data');
const TRIP_INDEX_PATH = path.join(DATA_DIR, 'trip_index.json');
const SHARED_TRIPS_DIR = path.join(DATA_DIR, 'shared_trips');
const TRIP_META_DIR = path.join(DATA_DIR, 'trip_meta');

// Ensure directories exist
function ensureDirectories() {
    if (!fs.existsSync(SHARED_TRIPS_DIR)) {
        fs.mkdirSync(SHARED_TRIPS_DIR, { recursive: true });
    }
    if (!fs.existsSync(TRIP_META_DIR)) {
        fs.mkdirSync(TRIP_META_DIR, { recursive: true });
    }
}

// ==========================================
// SSE Clients Management
// ==========================================
// Map<tripId, Set<Response>>
const sseClients = new Map<string, Set<Response>>();

export function subscribeToTrip(tripId: string, res: Response) {
    if (!sseClients.has(tripId)) {
        sseClients.set(tripId, new Set());
    }
    const clients = sseClients.get(tripId)!;
    clients.add(res);

    console.log(`[TripShareService] Client subscribed to trip ${tripId}. Total clients: ${clients.size}`);

    // Remove client on close
    res.on('close', () => {
        clients.delete(res);
        if (clients.size === 0) {
            sseClients.delete(tripId);
        }
        console.log(`[TripShareService] Client disconnected from trip ${tripId}.`);
    });
}

function notifyClients(tripId: string, event: string, data: any) {
    const clients = sseClients.get(tripId);
    if (!clients) return;

    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => {
        client.write(message);
    });
}

// ==========================================
// Index Operations
// ==========================================

function readTripIndex(): TripIndex {
    try {
        if (fs.existsSync(TRIP_INDEX_PATH)) {
            return JSON.parse(fs.readFileSync(TRIP_INDEX_PATH, 'utf-8'));
        }
    } catch (e) {
        console.error('[TripShareService] Error reading trip index:', e);
    }
    return { publicTrips: [], sharedPrivateTrips: [] };
}

function writeTripIndex(index: TripIndex): void {
    fs.writeFileSync(TRIP_INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
}

// ==========================================
// Trip Meta Operations
// ==========================================

export function getTripMeta(tripId: string): SharedTripMeta | null {
    const filePath = path.join(TRIP_META_DIR, `${tripId}.json`);
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
    } catch (e) {
        console.error(`[TripShareService] Error reading trip meta ${tripId}:`, e);
    }
    return null;
}



function writeTripMeta(meta: SharedTripMeta): void {
    ensureDirectories();
    const filePath = path.join(TRIP_META_DIR, `${meta.tripId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(meta, null, 2), 'utf-8');
}

function deleteTripMetaFile(tripId: string): void {
    const filePath = path.join(TRIP_META_DIR, `${tripId}.json`);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

export function getUserTrips(ownerId: string): SharedTripMeta[] {
    ensureDirectories();
    const files = fs.readdirSync(TRIP_META_DIR);
    const trips: SharedTripMeta[] = [];

    for (const file of files) {
        if (file.endsWith('.json')) {
            try {
                const content = fs.readFileSync(path.join(TRIP_META_DIR, file), 'utf-8');
                const meta = JSON.parse(content) as SharedTripMeta;
                if (meta.ownerId.toLowerCase() === ownerId.toLowerCase()) {
                    trips.push(meta);
                }
            } catch (e) {
                console.error(`[TripShareService] Error reading meta file ${file}:`, e);
            }
        }
    }
    return trips.sort((a, b) => b.lastModified - a.lastModified);
}

// ==========================================
// Shared Trip Operations
// ==========================================

export function getSharedTrip(tripId: string): SharedTrip | null {
    const filePath = path.join(SHARED_TRIPS_DIR, `${tripId}.json`);
    try {
        if (fs.existsSync(filePath)) {
            const trip = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SharedTrip;

            // Migration: Convert allowedUsers array to permissions object if needed
            if (!trip.permissions && trip.allowedUsers) {
                trip.permissions = {};
                trip.allowedUsers.forEach(email => {
                    trip.permissions[email] = 'read';
                });
            } else if (!trip.permissions) {
                trip.permissions = {};
            }

            return trip;
        }
    } catch (e) {
        console.error(`[TripShareService] Error reading shared trip ${tripId}:`, e);
    }
    return null;
}

function writeSharedTrip(trip: SharedTrip): void {
    ensureDirectories();
    const filePath = path.join(SHARED_TRIPS_DIR, `${trip.tripId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(trip, null, 2), 'utf-8');
}

function deleteSharedTripFile(tripId: string): void {
    const filePath = path.join(SHARED_TRIPS_DIR, `${tripId}.json`);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

// ==========================================
// Core Service Functions
// ==========================================

interface SaveTripParams {
    tripId: string;
    ownerId: string;
    ownerName: string;
    ownerPicture?: string;
    tripData: Trip;
    visibility: TripVisibility;
    reqUserEmail?: string; // Who is actually performing the save (could be different from owner)
}

export function saveTrip(params: SaveTripParams): string {
    const { tripId, ownerId, ownerName, ownerPicture, tripData, visibility, reqUserEmail } = params;
    const now = Date.now();

    // Check existing trip
    const existing = getSharedTrip(tripId);
    const existingMeta = getTripMeta(tripId);

    // Permission Check Logic
    // If trip exists, verify that reqUserEmail has write permission or is owner
    if (existing) {
        const isOwner = existing.ownerId === reqUserEmail;
        const hasWriteAccess = reqUserEmail && existing.permissions?.[reqUserEmail] === 'write';

        if (!isOwner && !hasWriteAccess) {
            throw new Error('Access denied: You do not have permission to edit this trip.');
        }
    }

    // Create/Update SharedTrip
    const sharedTrip: SharedTrip = {
        tripId,
        ownerId,
        visibility,
        permissions: existing?.permissions || {}, // Persist permissions
        createdAt: existing?.createdAt || now,
        lastModified: now,
        tripData: { ...tripData, serverTripId: tripId, lastSyncedAt: now }
    };
    writeSharedTrip(sharedTrip);

    // Create/Update TripMeta
    const meta: SharedTripMeta = {
        tripId,
        ownerId,
        ownerName,
        ownerPicture,
        visibility,
        title: tripData.title || tripData.input?.destination || 'Untitled Trip',
        destination: tripData.input?.destination || '',
        coverImage: tripData.customCoverImage,
        dateRange: tripData.input?.dateRange || '',
        days: tripData.data?.tripMeta?.days || 0,
        createdAt: existingMeta?.createdAt || now,
        lastModified: now,
        viewCount: existingMeta?.viewCount || 0,
        likeCount: existingMeta?.likeCount || 0,
        recentEngagements: existingMeta?.recentEngagements || [],
        language: tripData.input?.language || 'zh-TW'
    };
    writeTripMeta(meta);

    // Notify clients via SSE
    notifyClients(tripId, 'trip_updated', {
        tripId,
        lastModified: now,
        updatedBy: reqUserEmail
    });

    // Update index
    const index = readTripIndex();

    // Remove from both lists first (in case visibility changed)
    index.publicTrips = index.publicTrips.filter((id: string) => id !== tripId);
    index.sharedPrivateTrips = index.sharedPrivateTrips.filter((id: string) => id !== tripId);

    // Add to appropriate list
    if (visibility === 'public') {
        index.publicTrips.push(tripId);
    } else {
        index.sharedPrivateTrips.push(tripId);
    }
    writeTripIndex(index);

    console.log(`[TripShareService] Saved trip ${tripId} as ${visibility} (by ${reqUserEmail})`);
    return tripId;
}

export function getTrip(tripId: string, requesterId?: string, userIp?: string): SharedTrip & { userPermission?: TripPermission } | null {
    const trip = getSharedTrip(tripId);
    if (!trip) return null;

    let permission: TripPermission | undefined;

    // 1. Owner always has write
    if (requesterId && trip.ownerId === requesterId) {
        permission = 'write';
    }
    // 2. Check explicit permissions
    else if (requesterId && trip.permissions?.[requesterId]) {
        permission = trip.permissions[requesterId];
    }

    // 3. Public trips are 'read' by default if not strictly denied (not implemented yet, assuming public = read for all)
    if (trip.visibility === 'public' && !permission) {
        permission = 'read';
    }

    // 4. If no permission determined (private trip, non-owner, not in allowed list) -> return null
    if (!permission) {
        return null;
    }

    recordEngagement(tripId, 'view', requesterId, userIp);

    // Return trip mixed with the computed permission for the frontend to use
    return { ...trip, userPermission: permission };
}

export function updateVisibility(tripId: string, ownerId: string, visibility: TripVisibility): boolean {
    const trip = getSharedTrip(tripId);
    if (!trip || trip.ownerId !== ownerId) {
        return false;
    }

    trip.visibility = visibility;
    trip.lastModified = Date.now();
    writeSharedTrip(trip);

    // Update meta
    const meta = getTripMeta(tripId);
    if (meta) {
        meta.visibility = visibility;
        meta.lastModified = Date.now();
        writeTripMeta(meta);
    }

    // Update index
    const index = readTripIndex();
    index.publicTrips = index.publicTrips.filter((id: string) => id !== tripId);
    index.sharedPrivateTrips = index.sharedPrivateTrips.filter((id: string) => id !== tripId);

    if (visibility === 'public') {
        index.publicTrips.push(tripId);
    } else {
        index.sharedPrivateTrips.push(tripId);
    }
    writeTripIndex(index);

    // Notify
    notifyClients(tripId, 'visibility_updated', { visibility });

    console.log(`[TripShareService] Updated visibility for ${tripId} to ${visibility}`);
    return true;
}

export function updatePermissions(tripId: string, ownerId: string, permissions: Record<string, TripPermission>): boolean {
    const trip = getSharedTrip(tripId);
    if (!trip || trip.ownerId !== ownerId) {
        return false;
    }

    trip.permissions = permissions;
    // Sync legacy allowedUsers for backward compatibility if needed, or just let it rot.
    // Let's keep it somewhat in sync just in case:
    trip.allowedUsers = Object.keys(permissions);

    trip.lastModified = Date.now();
    writeSharedTrip(trip);

    // Notify (maybe nice to notify the specific user, but broadcast is fine for now)
    notifyClients(tripId, 'permissions_updated', { permissions });

    console.log(`[TripShareService] Updated permissions for ${tripId}`);
    return true;
}

export function deleteTrip(tripId: string, ownerId: string): 'success' | 'not_found' | 'unauthorized' {
    const trip = getSharedTrip(tripId);

    if (!trip) {
        return 'not_found';
    }

    if (trip.ownerId !== ownerId) {
        return 'unauthorized';
    }

    // Notify clients of deletion before actually deleting
    notifyClients(tripId, 'trip_deleted', { tripId });

    // Remove files
    deleteSharedTripFile(tripId);
    deleteTripMetaFile(tripId);

    // Update index
    const index = readTripIndex();
    index.publicTrips = index.publicTrips.filter((id: string) => id !== tripId);
    index.sharedPrivateTrips = index.sharedPrivateTrips.filter((id: string) => id !== tripId);
    writeTripIndex(index);

    console.log(`[TripShareService] Deleted trip ${tripId}`);
    return 'success';
}

// ==========================================
// Engagement Tracking
// ==========================================

export function recordEngagement(tripId: string, type: 'view' | 'like', userId?: string, userIp?: string): void {
    const meta = getTripMeta(tripId);
    if (!meta) return;

    // Deduplication logic for views
    if (type === 'view') {
        const now = Date.now();
        const DEBOUNCE_TIME = 60 * 1000; // 60 seconds

        // Check recent engagements
        const recentView = meta.recentEngagements.slice().reverse().find(e =>
            e.type === 'view' &&
            e.timestamp > now - DEBOUNCE_TIME &&
            (
                (userId && e.userId === userId) ||
                (userIp && e.userIp === userIp)
            )
        );

        if (recentView) {
            // console.log(`[TripShareService] Debounced view for trip ${tripId}`);
            return;
        }
    }

    const engagement: Engagement = {
        type,
        userId,
        userIp,
        timestamp: Date.now()
    };

    meta.recentEngagements.push(engagement);

    // Keep only last 7 days of engagements
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    meta.recentEngagements = meta.recentEngagements.filter((e: Engagement) => e.timestamp > sevenDaysAgo);

    // Update counts
    if (type === 'view') {
        meta.viewCount++;
    } else if (type === 'like') {
        meta.likeCount++;
    }

    writeTripMeta(meta);
}

// ==========================================
// Gallery Functions
// ==========================================

function calculateTrendingScore(meta: SharedTripMeta): number {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentEngagements = meta.recentEngagements.filter(e => e.timestamp > sevenDaysAgo);

    const viewCount = recentEngagements.filter((e: Engagement) => e.type === 'view').length;
    const likeCount = recentEngagements.filter((e: Engagement) => e.type === 'like').length;

    return viewCount * 1 + likeCount * 3;
}

export function getPublicTrips(page: number = 1, pageSize: number = 12): GalleryResponse {
    const index = readTripIndex();

    // Get all public trip metas
    const allMetas: SharedTripMeta[] = [];
    for (const tripId of index.publicTrips) {
        const meta = getTripMeta(tripId);
        if (meta) {
            allMetas.push(meta);
        }
    }

    // Sort by trending score (descending)
    allMetas.sort((a, b) => calculateTrendingScore(b) - calculateTrendingScore(a));

    // Paginate
    const start = (page - 1) * pageSize;
    const trips = allMetas.slice(start, start + pageSize);

    return {
        trips,
        total: allMetas.length,
        page,
        pageSize
    };
}

export function getRandomTrips(count: number = 6): SharedTripMeta[] {
    const index = readTripIndex();

    // Get all public trip metas
    const allMetas: SharedTripMeta[] = [];
    for (const tripId of index.publicTrips) {
        const meta = getTripMeta(tripId);
        if (meta) {
            allMetas.push(meta);
        }
    }

    // Shuffle using Fisher-Yates algorithm
    for (let i = allMetas.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allMetas[i], allMetas[j]] = [allMetas[j], allMetas[i]];
    }

    // Return requested count
    return allMetas.slice(0, count);
}
