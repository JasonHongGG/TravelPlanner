import { Router } from 'express';
import { requireAuth } from '../utils/auth';
import { processCopilot } from '../controllers/copilotController';

const router = Router();

router.post('/process', requireAuth, processCopilot);

export default router;
