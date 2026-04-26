import 'dotenv/config';
import { configService } from './config/configService.js';
import { createDbApp } from './app.js';

const app = createDbApp();
const port = process.env.DB_SERVER_PORT || 3002;

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
