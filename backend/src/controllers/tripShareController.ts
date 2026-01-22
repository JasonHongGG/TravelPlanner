import type { Request, Response } from 'express';
import * as tripShareService from '../services/data/tripShareService';

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

        const trip = tripShareService.getTrip(tripId, authUser?.email);

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

        // Check if user is the owner (for updates)
        const existing = tripShareService.getSharedTrip(tripId);
        if (existing && existing.ownerId !== authUser.email) {
            return res.status(403).json({ error: 'Only the trip owner can update' });
        }

        const savedTripId = tripShareService.saveTrip({
            tripId,
            ownerId: authUser.email,
            ownerName: authUser.name || 'Anonymous',
            ownerPicture: authUser.picture,
            tripData,
            visibility: visibility || 'private'
        });

        res.json({ tripId: savedTripId, message: 'Trip saved successfully' });
    } catch (error: any) {
        console.error('[TripShareController] Error saving trip:', error);
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
        const { allowedUsers } = req.body as { allowedUsers: string[] };
        const authUser = (req as Request & { user?: { email?: string } }).user;

        if (!authUser?.email) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!Array.isArray(allowedUsers)) {
            return res.status(400).json({ error: 'allowedUsers must be an array' });
        }

        const success = tripShareService.updateAllowedUsers(tripId, authUser.email, allowedUsers);

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
        if (trip.visibility !== 'public' && authUser?.email !== trip.ownerId && !trip.allowedUsers.includes(authUser?.email || '')) {
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
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 12;

        const result = tripShareService.getPublicTrips(page, pageSize);
        res.json(result);
    } catch (error: any) {
        console.error('[TripShareController] Error getting gallery:', error);
        res.status(500).json({ error: error.message });
    }
}

export function getRandomTrips(req: Request, res: Response) {
    try {
        const count = parseInt(req.query.count as string) || 6;

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
