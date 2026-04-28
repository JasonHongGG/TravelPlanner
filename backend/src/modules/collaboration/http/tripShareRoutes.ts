import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../../utils/auth.js';
import {
    getTrip,
    deleteTrip,
    updateVisibility,
    upsertMember,
    revokeMember,
    likeTrip,
    getGallery,
    getRandomTrips,
    getMyTrips,
    getWorkspaceTrips,
    removeWorkspaceTrip,
    subscribeToTrip,
    createTripEventToken,
    updateTripContent,
    createTripDocument
} from './tripShareController.js';

const router = Router();

// ==========================================
// Gallery Routes (Public)
// ==========================================

router.get('/gallery', getGallery);
router.get('/gallery/random', getRandomTrips);

// ==========================================
// Trip Routes
// ==========================================

// Get user's own shared trips (for sync cleanup) - MUST be before :tripId routes
router.get('/trips/my', requireAuth, getMyTrips);
router.get('/workspace/trips', requireAuth, getWorkspaceTrips);
router.delete('/workspace/trips/:tripId', requireAuth, removeWorkspaceTrip);

// Get trip (optional auth for permission check)
router.get('/trips/:tripId', optionalAuth, getTrip);

// SSE Subscription (Optional auth handled in controller/service logic if needed, 
// usually browser EventSource doesn't send headers easily, so we might rely on query param token if strict security needed. 
// For now, open or query token. Let's keep it simple.)
router.post('/trips/:tripId/events-token', requireAuth, createTripEventToken);
router.get('/trips/:tripId/events', subscribeToTrip);

// Save/Update trip (requires auth)
router.post('/trips', requireAuth, createTripDocument);
router.patch('/trips/:tripId/content', requireAuth, updateTripContent);

// Delete trip (requires auth)
router.delete('/trips/:tripId', requireAuth, deleteTrip);

// Update visibility (requires auth)
router.patch('/trips/:tripId/visibility', requireAuth, updateVisibility);

// Update members (requires auth)
router.post('/trips/:tripId/members', requireAuth, upsertMember);
router.patch('/trips/:tripId/members/:memberEmail', requireAuth, upsertMember);
router.delete('/trips/:tripId/members/:memberEmail', requireAuth, revokeMember);

// Like trip (optional auth)
router.post('/trips/:tripId/like', optionalAuth, likeTrip);

export default router;
