import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/apiRoutes.js';
import dbRoutes from './routes/dbRoutes.js';
import tripShareRoutes from './routes/tripShareRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import copilotRoutes from './routes/copilotRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { corsOptions } from './config/corsConfig.js';

export function createMainApp() {
    const app = express();

    app.use(cors(corsOptions));
    app.use(express.json({ limit: '50mb' }));
    app.use(requestLogger);

    app.use('/', apiRoutes);
    app.use('/db', dbRoutes);
    app.use('/api', tripShareRoutes);
    app.use('/api/exports', exportRoutes);

    app.use(errorHandler);
    return app;
}

export function createDbApp() {
    const app = express();

    app.use(cors(corsOptions));
    app.use(express.json());
    app.use(requestLogger);
    app.use('/', dbRoutes);
    app.use(errorHandler);

    return app;
}

export function createCopilotApp() {
    const app = express();

    app.use(cors(corsOptions));
    app.use(express.json());
    app.use(requestLogger);
    app.use('/', copilotRoutes);
    app.use(errorHandler);

    return app;
}
