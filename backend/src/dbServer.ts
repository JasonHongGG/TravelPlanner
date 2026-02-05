import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import dbRoutes from './routes/dbRoutes';
import { errorHandler } from './middleware/errorHandler';
import { configService } from './config/configService';
import { corsOptions } from './config/corsConfig';

const app = express();
const port = process.env.DB_SERVER_PORT || 3002;

app.use(cors(corsOptions));
app.use(express.json());

app.use('/', dbRoutes);

app.use(errorHandler);

configService.validateDbServer();

app.listen(port, () => {
    console.log(`Database Server (Single File) running at http://localhost:${port}`);
});

// Hack: Force keep-alive if event loop drains
setInterval(() => { }, 1 << 30);

process.on('SIGINT', () => {
    console.log("Received SIGINT. Exiting...");
    process.exit(0);
});

process.on('exit', (code) => {
    console.log(`Process exited with code: ${code}`);
});
