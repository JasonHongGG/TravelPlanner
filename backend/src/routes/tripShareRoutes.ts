import { Router } from 'express';
import { optionalAuth, requireAuth } from '../utils/auth.js';
import {
    getTrip,
    saveTrip,
    deleteTrip,
    updateVisibility,
    updatePermissions,
    likeTrip,
    getGallery,
    getRandomTrips,
    getMyTrips,
    encryptTrip,
    decryptTrip,
    subscribeToTrip
} from '../controllers/tripShareController.js';

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

// Get trip (optional auth for permission check)
router.get('/trips/:tripId', optionalAuth, getTrip);

// SSE Subscription (Optional auth handled in controller/service logic if needed, 
// usually browser EventSource doesn't send headers easily, so we might rely on query param token if strict security needed. 
// For now, open or query token. Let's keep it simple.)
router.get('/trips/:tripId/events', subscribeToTrip);

// Save/Update trip (requires auth)
router.put('/trips/:tripId', requireAuth, saveTrip);

// Delete trip (requires auth)
router.delete('/trips/:tripId', requireAuth, deleteTrip);

// Update visibility (requires auth)
router.patch('/trips/:tripId/visibility', requireAuth, updateVisibility);

// Update permissions (requires auth)
router.patch('/trips/:tripId/permissions', requireAuth, updatePermissions);

// Like trip (optional auth)
router.post('/trips/:tripId/like', optionalAuth, likeTrip);

export default router;

// ==========================================
// Encryption Routes (Public)
// ==========================================

import { exportTripJson } from '../controllers/tripShareController';

router.post('/trips/export/json', requireAuth, exportTripJson);
router.post('/trips/encrypt', encryptTrip);
router.post('/trips/decrypt', decryptTrip);
