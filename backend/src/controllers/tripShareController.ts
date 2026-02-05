import type { Request, Response } from 'express';
import * as tripShareService from '../services/data/tripShareService';
import * as cryptoService from '../services/security/cryptoService';
import { parseBoundedInt } from '../utils/params';
import { GALLERY_PAGE_MAX, GALLERY_PAGE_SIZE_DEFAULT, GALLERY_PAGE_SIZE_MAX, RANDOM_TRIPS_DEFAULT, RANDOM_TRIPS_MAX } from '../config/apiLimits';

// Local type definition (shared types not directly importable in backend)
type TripVisibility = 'private' | 'public';

// Helper to safely extract string param
function getStringParam(param: string | string[] | undefined): string {
    if (Array.isArray(param)) return param[0];
    return param || '';
}

// ==========================================
// Get Trip
// ==========================================

export function getTrip(req: Request, res: Response) {
    try {
        const tripId = getStringParam(req.params.tripId);
        const authUser = (req as Request & { user?: { email?: string } }).user;
        const userIp = req.ip || req.socket.remoteAddress || 'unknown';

        const trip = tripShareService.getTrip(tripId, authUser?.email, userIp);

        if (!trip) {
            return res.status(404).json({ error: 'Trip not found or access denied' });
        }

        res.json(trip);
    } catch (error: any) {
        console.error('[TripShareController] Error getting trip:', error);
        res.status(500).json({ error: error.message });
    }
}

// ==========================================
// Save/Update Trip
// ==========================================

export function saveTrip(req: Request, res: Response) {
    try {
        const tripId = getStringParam(req.params.tripId);
        const { tripData, visibility } = req.body;
        const authUser = (req as Request & { user?: { email?: string; name?: string; picture?: string } }).user;

        if (!authUser?.email) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!tripData) {
            return res.status(400).json({ error: 'tripData is required' });
        }

        // Logic moved to service: service now handles permission check via reqUserEmail
        const savedTripId = tripShareService.saveTrip({
            tripId,
            ownerId: authUser.email,
            ownerName: authUser.name || 'Anonymous',
            ownerPicture: authUser.picture,
            tripData,
            visibility: visibility || 'private',
            reqUserEmail: authUser.email // Pass for permission check
        });

        res.json({ tripId: savedTripId, message: 'Trip saved successfully' });
    } catch (error: any) {
        console.error('[TripShareController] Error saving trip:', error);
        if (error.message.includes('Access denied')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
}

// ==========================================
// Delete Trip
// ==========================================

export function deleteTrip(req: Request, res: Response) {
    try {
        const tripId = getStringParam(req.params.tripId);
        const authUser = (req as Request & { user?: { email?: string } }).user;

        if (!authUser?.email) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const result = tripShareService.deleteTrip(tripId, authUser.email);

        if (result === 'not_found') {
            return res.status(404).json({ error: 'Trip not found' });
        }

        if (result === 'unauthorized') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        res.json({ message: 'Trip deleted successfully' });
    } catch (error: any) {
        console.error('[TripShareController] Error deleting trip:', error);
        res.status(500).json({ error: error.message });
    }
}

// ==========================================
// Update Visibility
// ==========================================

export function updateVisibility(req: Request, res: Response) {
    try {
        const tripId = getStringParam(req.params.tripId);
        const { visibility } = req.body as { visibility: TripVisibility };
        const authUser = (req as Request & { user?: { email?: string } }).user;

        if (!authUser?.email) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!visibility || !['public', 'private'].includes(visibility)) {
            return res.status(400).json({ error: 'Invalid visibility value' });
        }

        const success = tripShareService.updateVisibility(tripId, authUser.email, visibility);

        if (!success) {
            return res.status(403).json({ error: 'Trip not found or not authorized' });
        }

        res.json({ message: `Visibility updated to ${visibility}` });
    } catch (error: any) {
        console.error('[TripShareController] Error updating visibility:', error);
        res.status(500).json({ error: error.message });
    }
}

// ==========================================
// Update Permissions
// ==========================================

export function updatePermissions(req: Request, res: Response) {
    try {
        const tripId = getStringParam(req.params.tripId);
        const { permissions } = req.body as { permissions: Record<string, 'read' | 'write'> };
        const authUser = (req as Request & { user?: { email?: string } }).user;

        if (!authUser?.email) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!permissions || typeof permissions !== 'object') {
            return res.status(400).json({ error: 'permissions object is required' });
        }

        const success = tripShareService.updatePermissions(tripId, authUser.email, permissions);

        if (!success) {
            return res.status(403).json({ error: 'Trip not found or not authorized' });
        }

        res.json({ message: 'Permissions updated successfully' });
    } catch (error: any) {
        console.error('[TripShareController] Error updating permissions:', error);
        res.status(500).json({ error: error.message });
    }
}

// ==========================================
// SSE Subscription
// ==========================================

export function subscribeToTrip(req: Request, res: Response) {
    try {
        const tripId = getStringParam(req.params.tripId);

        // Headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Optional: Check permission before subscribing?
        // Ideally yes, but since events just say "updated", it's low risk.
        // We'll let the service handle the subscription.

        tripShareService.subscribeToTrip(tripId, res);

        // Initial ping to confirm connection
        res.write(`event: connected\ndata: "Connected to trip ${tripId}"\n\n`);

    } catch (error: any) {
        console.error('[TripShareController] Error subscribing to trip:', error);
        res.status(500).end();
    }
}

// ==========================================
// Like Trip
// ==========================================

export function likeTrip(req: Request, res: Response) {
    try {
        const tripId = getStringParam(req.params.tripId);
        const authUser = (req as Request & { user?: { email?: string } }).user;

        // Check if trip exists and is accessible
        const trip = tripShareService.getSharedTrip(tripId);
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        // Only allow liking public trips or if user has access
        // Modified to permit liking if allowListed
        const hasAccess = trip.visibility === 'public' ||
            trip.ownerId === authUser?.email ||
            (authUser?.email && trip.permissions?.[authUser.email]);

        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        tripShareService.recordEngagement(tripId, 'like', authUser?.email);

        const meta = tripShareService.getTripMeta(tripId);
        res.json({ likeCount: meta?.likeCount || 0 });
    } catch (error: any) {
        console.error('[TripShareController] Error liking trip:', error);
        res.status(500).json({ error: error.message });
    }
}

// ==========================================
// Gallery Endpoints
// ==========================================

export function getGallery(req: Request, res: Response) {
    try {
        const page = parseBoundedInt(req.query.page, 1, { min: 1, max: GALLERY_PAGE_MAX });
        const pageSize = parseBoundedInt(req.query.pageSize, GALLERY_PAGE_SIZE_DEFAULT, { min: 1, max: GALLERY_PAGE_SIZE_MAX });

        const result = tripShareService.getPublicTrips(page, pageSize);
        res.json(result);
    } catch (error: any) {
        console.error('[TripShareController] Error getting gallery:', error);
        res.status(500).json({ error: error.message });
    }
}

export function getRandomTrips(req: Request, res: Response) {
    try {
        const count = parseBoundedInt(req.query.count, RANDOM_TRIPS_DEFAULT, { min: 1, max: RANDOM_TRIPS_MAX });

        const trips = tripShareService.getRandomTrips(count);
        res.json({ trips });
    } catch (error: any) {
        console.error('[TripShareController] Error getting random trips:', error);
        res.status(500).json({ error: error.message });
    }
}

// ==========================================
// Get My Trips (for sync cleanup)
// ==========================================

export function getMyTrips(req: Request, res: Response) {
    try {
        const authUser = (req as Request & { user?: { email?: string } }).user;

        if (!authUser?.email) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const trips = tripShareService.getUserTrips(authUser.email);
        const tripIds = trips.map(t => t.tripId);

        res.json({ tripIds });
    } catch (error: any) {
        console.error('[TripShareController] Error getting my trips:', error);
        res.status(500).json({ error: error.message });
    }
}

// ==========================================
// Encryption Endpoints
// ==========================================

export function encryptTrip(req: Request, res: Response) {
    try {
        const { tripData } = req.body;
        if (!tripData) {
            return res.status(400).json({ error: 'tripData is required' });
        }

        const encrypted = cryptoService.encryptTripData(tripData);
        // We return plain text body so client can save directly as file content,
        // or JSON object containing the string.
        // Let's return JSON to be consistent.
        res.json({ encryptedContent: encrypted });
    } catch (error: any) {
        console.error('[TripShareController] Encryption error:', error);
        res.status(500).json({ error: 'Encryption failed' });
    }
}

export function decryptTrip(req: Request, res: Response) {
    try {
        const { encryptedContent } = req.body;
        if (!encryptedContent) {
            return res.status(400).json({ error: 'encryptedContent is required' });
        }

        const tripData = cryptoService.decryptTripData(encryptedContent);
        res.json({ tripData });
    } catch (error: any) {
        console.error('[TripShareController] Decryption error:', error);
        res.status(400).json({ error: 'Invalid or corrupted file' });
    }
}

// ==========================================
// Export Endpoints
// ==========================================

import { readUsers } from '../services/data/userStore';

export function exportTripJson(req: Request, res: Response) {
    try {
        const { tripData } = req.body;
        const authUser = (req as Request & { user?: { email?: string } }).user;

        if (!authUser?.email) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!tripData) {
            return res.status(400).json({ error: 'tripData is required' });
        }

        // Backend Validation: Check Subscription
        const users = readUsers();
        const user = users[authUser.email.toLowerCase()]; // Keys are usually lowercased

        if (!user || !user.subscription || !user.subscription.active) {
            console.warn(`[TripShareController] Blocked JSON export for unauthorized user: ${authUser.email}`);
            return res.status(403).json({ error: 'Subscription required for JSON export.' });
        }

        // If valid, return the JSON data
        // We set headers to force download
        const filename = `trip_${tripData.title || 'export'}.json`;
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Content-Type', 'application/json');

        res.json(tripData);

    } catch (error: any) {
        console.error('[TripShareController] Export error:', error);
        res.status(500).json({ error: 'Export failed' });
    }
}
