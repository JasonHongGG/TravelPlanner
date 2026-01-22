import { Router } from 'express';
import { requireAuth } from '../utils/auth';
import { getConfig, getPackages, generate, streamUpdate, streamRecommendations } from '../controllers/aiController';
import { getCoverImage } from '../controllers/coverController';

const router = Router();

router.get('/config', getConfig);
router.get('/packages', getPackages);
router.get('/cover', getCoverImage);
router.post('/generate', requireAuth, generate);
router.post('/stream-update', requireAuth, streamUpdate);
router.post('/stream-recommendations', requireAuth, streamRecommendations);

export default router;

