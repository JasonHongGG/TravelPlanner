import type { Request, Response } from 'express';
import * as tripShareService from '../application/tripShareService.js';
import { createTripEventToken as signTripEventToken, verifyTripEventToken } from '../../../services/security/tripEventTokenService.js';
import { parseBoundedInt } from '../../../utils/params.js';
import { GALLERY_PAGE_MAX, GALLERY_PAGE_SIZE_DEFAULT, GALLERY_PAGE_SIZE_MAX, RANDOM_TRIPS_DEFAULT, RANDOM_TRIPS_MAX } from '../../../config/apiLimits.js';

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

export function createTripDocument(req: Request, res: Response) {
    try {
        const { tripData, visibility, tripId: explicitTripId } = req.body;
        const authUser = (req as Request & { user?: { email?: string; name?: string; picture?: string } }).user;

        if (!authUser?.email) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!tripData) {
            return res.status(400).json({ error: 'tripData is required' });
        }

        const tripId = typeof explicitTripId === 'string'
            ? explicitTripId
            : typeof tripData.serverTripId === 'string'
                ? tripData.serverTripId
                : typeof tripData.id === 'string'
                    ? tripData.id
                    : '';

        if (!tripId) {
            return res.status(400).json({ error: 'tripId is required' });
        }

        if (visibility && !['public', 'private'].includes(visibility)) {
            return res.status(400).json({ error: 'Invalid visibility value' });
        }

        const trip = tripShareService.createTripDocument({
            tripId,
            ownerId: authUser.email,
            ownerName: authUser.name || 'Anonymous',
            ownerPicture: authUser.picture,
            tripData,
            visibility: visibility || 'private',
            reqUserEmail: authUser.email
        });

        res.status(201).json({ tripId: trip.tripId, revision: trip.revision || 1, lastModified: trip.lastModified });
    } catch (error: any) {
        console.error('[TripShareController] Error creating trip document:', error);
        if (error.message.includes('already exists')) {
            return res.status(409).json({ error: error.message, code: 'TRIP_ALREADY_EXISTS' });
        }
        res.status(500).json({ error: error.message });
    }
}

export function updateTripContent(req: Request, res: Response) {
    try {
        const tripId = getStringParam(req.params.tripId);
        const { tripData, expectedRevision } = req.body;
        const authUser = (req as Request & { user?: { email?: string } }).user;

        if (!authUser?.email) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!tripData) {
            return res.status(400).json({ error: 'tripData is required' });
        }

        const trip = tripShareService.updateTripContent(
            tripId,
            authUser.email,
            tripData,
            typeof expectedRevision === 'number' ? expectedRevision : undefined
        );

        res.json({ tripId, revision: trip.revision || 1, lastModified: trip.lastModified });
    } catch (error: any) {
        console.error('[TripShareController] Error updating trip content:', error);
        if (error.message.includes('Access denied')) return res.status(403).json({ error: error.message });
        if (error.message.includes('Revision conflict')) return res.status(409).json({ error: error.message, code: 'REVISION_CONFLICT' });
        if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
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
// Update Members
// ==========================================

export function upsertMember(req: Request, res: Response) {
    try {
        const tripId = getStringParam(req.params.tripId);
        const memberEmail = getStringParam(req.params.memberEmail) || req.body?.email;
        const { permission } = req.body as { permission?: 'read' | 'write' };
        const authUser = (req as Request & { user?: { email?: string } }).user;

        if (!authUser?.email) return res.status(401).json({ error: 'Authentication required' });
        if (!memberEmail || typeof memberEmail !== 'string') return res.status(400).json({ error: 'member email is required' });
        if (!permission || !['read', 'write'].includes(permission)) return res.status(400).json({ error: 'Invalid permission value' });

        const trip = tripShareService.updateMemberPermission(tripId, authUser.email, memberEmail, permission);
        if (!trip) return res.status(403).json({ error: 'Trip not found or not authorized' });
        res.json({ tripId, memberEmail: memberEmail.toLowerCase(), permission, revision: trip.revision || 1 });
    } catch (error: any) {
        console.error('[TripShareController] Error upserting member:', error);
        res.status(500).json({ error: error.message });
    }
}

export function revokeMember(req: Request, res: Response) {
    try {
        const tripId = getStringParam(req.params.tripId);
        const memberEmail = getStringParam(req.params.memberEmail);
        const authUser = (req as Request & { user?: { email?: string } }).user;

        if (!authUser?.email) return res.status(401).json({ error: 'Authentication required' });
        if (!memberEmail) return res.status(400).json({ error: 'member email is required' });

        const trip = tripShareService.revokeMember(tripId, authUser.email, memberEmail);
        if (!trip) return res.status(403).json({ error: 'Trip not found or not authorized' });
        res.json({ tripId, memberEmail: memberEmail.toLowerCase(), revision: trip.revision || 1 });
    } catch (error: any) {
        console.error('[TripShareController] Error revoking member:', error);
        res.status(500).json({ error: error.message });
    }
}

// ==========================================
// SSE Subscription
// ==========================================

export function createTripEventToken(req: Request, res: Response) {
    try {
        const tripId = getStringParam(req.params.tripId);
        const authUser = (req as Request & { user?: { email?: string } }).user;

        if (!authUser?.email) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const trip = tripShareService.getTrip(tripId, authUser.email);
        if (!trip) {
            return res.status(403).json({ error: 'Trip not found or access denied' });
        }

        res.json(signTripEventToken(tripId, authUser.email, { role: trip.userPermission, revision: trip.revision }));
    } catch (error: any) {
        console.error('[TripShareController] Error creating trip event token:', error);
        res.status(500).json({ error: error.message });
    }
}

export function subscribeToTrip(req: Request, res: Response) {
    try {
        const tripId = getStringParam(req.params.tripId);
        const token = typeof req.query.token === 'string' ? req.query.token : undefined;
        const tokenPayload = token ? verifyTripEventToken(tripId, token) : null;

        if (!tripShareService.canAccessTrip(tripId, tokenPayload?.userId)) {
            return res.status(403).json({ error: 'Trip not found or access denied' });
        }

        // Headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

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

        if (!tripShareService.canAccessTrip(tripId, authUser?.email)) {
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

export function getWorkspaceTrips(req: Request, res: Response) {
    try {
        const authUser = (req as Request & { user?: { email?: string } }).user;

        if (!authUser?.email) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const trips = tripShareService.getWorkspaceTrips(authUser.email);
        res.json({ trips, tripIds: trips.map(t => t.tripId) });
    } catch (error: any) {
        console.error('[TripShareController] Error getting workspace trips:', error);
        res.status(500).json({ error: error.message });
    }
}

export function removeWorkspaceTrip(req: Request, res: Response) {
    try {
        const tripId = getStringParam(req.params.tripId);
        const authUser = (req as Request & { user?: { email?: string } }).user;

        if (!authUser?.email) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const result = tripShareService.removeFromWorkspace(tripId, authUser.email);
        if (result === 'not_found') return res.status(404).json({ error: 'Trip not found' });
        if (result === 'owner_cannot_remove') return res.status(409).json({ error: 'Owners must delete the canonical trip instead of removing it from workspace.' });
        if (result === 'unauthorized') return res.status(403).json({ error: 'Trip not found or access denied' });
        res.json({ message: 'Trip removed from workspace' });
    } catch (error: any) {
        console.error('[TripShareController] Error removing workspace trip:', error);
        res.status(500).json({ error: error.message });
    }
}

