import { Router } from 'express';
import { optionalAuth, requireAuth } from '../utils/auth';
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
    decryptTrip
} from '../controllers/tripShareController';

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

router.post('/trips/encrypt', encryptTrip);
router.post('/trips/decrypt', decryptTrip);
