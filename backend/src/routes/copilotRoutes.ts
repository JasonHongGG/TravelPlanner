import { Router } from 'express';
import { requireAuth } from '../utils/auth.js';
import { processCopilot } from '../controllers/copilotController.js';

const router = Router();

router.post('/process', requireAuth, processCopilot);

export default router;
