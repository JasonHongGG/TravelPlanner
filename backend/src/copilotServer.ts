import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import copilotRoutes from './routes/copilotRoutes';
import { errorHandler } from './middleware/errorHandler';
import { configService } from './config/configService';
import { corsOptions } from './config/corsConfig';

const app = express();
const port = process.env.COPILOT_SERVER_PORT || 3003;

app.use(cors(corsOptions));
app.use(express.json());

app.use('/', copilotRoutes);

app.use(errorHandler);

configService.validateCopilotServer();

app.listen(port, () => {
    console.log(`Copilot Dedicated Server running on http://localhost:${port}`);
});
