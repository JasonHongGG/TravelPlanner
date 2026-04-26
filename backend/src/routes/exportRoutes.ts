import { Router } from 'express';
import { requireAuth } from '../utils/auth.js';
import { decryptTrip, encryptTrip, exportTripJson } from '../controllers/exportController.js';

const router = Router();

router.post('/json', requireAuth, exportTripJson);
router.post('/encrypt', encryptTrip);
router.post('/decrypt', decryptTrip);

export default router;
