import 'dotenv/config';
import { configService } from './config/configService.js';
import { createCopilotApp } from './app.js';

const app = createCopilotApp();
const port = process.env.COPILOT_SERVER_PORT || 3003;

configService.validateCopilotServer();

app.listen(port, () => {
    console.log(`Copilot Dedicated Server running on http://localhost:${port}`);
});
