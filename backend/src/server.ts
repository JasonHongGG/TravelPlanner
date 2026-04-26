import 'dotenv/config';
import { BackendAIService } from './services/BackendAIService.js';
import { initGenerationJobMaintenance } from './controllers/aiController.js';
import { configService } from './config/configService.js';
import { logger } from './utils/logger.js';
import { createMainApp } from './app.js';

const app = createMainApp();
const port = process.env.PORT || 3001;

configService.validateAiServer();
initGenerationJobMaintenance();


app.listen(port, () => {
    logger.info(`AI Backend Server running at http://localhost:${port}`);
    logger.info(`Active Provider: ${BackendAIService.getProvider().constructor.name}`);
});
