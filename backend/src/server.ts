import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { BackendAIService } from './services/BackendAIService';
import apiRoutes from './routes/apiRoutes';
import { errorHandler } from './middleware/errorHandler';
import { configService } from './config/configService';
import { corsOptions } from './config/corsConfig';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors(corsOptions));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    const action = (req.body as { action?: string } | undefined)?.action;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Action: ${action ?? 'N/A'}`);
    next();
});

app.use('/', apiRoutes);

app.use(errorHandler);

configService.validateAiServer();


app.listen(port, () => {
    console.log(`AI Backend Server running at http://localhost:${port}`);
    console.log(`Active Provider: ${BackendAIService.getProvider().constructor.name}`);
});
