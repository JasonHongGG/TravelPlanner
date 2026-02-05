import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { BackendAIService } from './services/BackendAIService.js';
import apiRoutes from './routes/apiRoutes.js';
import dbRoutes from './routes/dbRoutes.js';
import tripShareRoutes from './routes/tripShareRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { configService } from './config/configService.js';
import { corsOptions } from './config/corsConfig.js';

import { requestLogger } from './middleware/requestLogger.js';
import { logger } from './utils/logger.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); // Increase limit for high-res cover images

// Request logging middleware
app.use(requestLogger);

app.use('/', apiRoutes);
app.use('/db', dbRoutes);
app.use('/api', tripShareRoutes);

app.use(errorHandler);

configService.validateAiServer();


app.listen(port, () => {
    logger.info(`AI Backend Server running at http://localhost:${port}`);
    logger.info(`Active Provider: ${BackendAIService.getProvider().constructor.name}`);
});
