import { Router } from 'express';
import { requireAuth } from '../utils/auth.js';
import { addTransaction, getUser, login, getSettings, updateSettings } from '../controllers/dbController.js';

const router = Router();

router.post('/auth/login', login);
router.get('/users/:email', requireAuth, getUser);
router.post('/users/:email/transaction', requireAuth, addTransaction);

// Settings API
router.get('/users/:email/settings', requireAuth, getSettings);
router.put('/users/:email/settings', requireAuth, updateSettings);

export default router;
