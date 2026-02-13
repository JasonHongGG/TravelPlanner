import { Router } from 'express';
import { requireAuth } from '../utils/auth.js';
import {
	getConfig,
	getPackages,
	generate,
	streamUpdate,
	streamRecommendations,
	createGenerationJobHandler,
	getGenerationJobHandler,
	claimGenerationJobHandler,
	ackGenerationJobHandler
} from '../controllers/aiController.js';
import { getCoverImage } from '../controllers/coverController.js';

const router = Router();

router.get('/config', getConfig);
router.get('/packages', getPackages);
router.get('/cover', getCoverImage);
router.post('/generate', requireAuth, generate);
router.post('/stream-update', requireAuth, streamUpdate);
router.post('/stream-recommendations', requireAuth, streamRecommendations);
router.post('/generation-jobs', requireAuth, createGenerationJobHandler);
router.get('/generation-jobs/:jobId', requireAuth, getGenerationJobHandler);
router.post('/generation-jobs/:jobId/claim', requireAuth, claimGenerationJobHandler);
router.post('/generation-jobs/:jobId/ack', requireAuth, ackGenerationJobHandler);

export default router;

