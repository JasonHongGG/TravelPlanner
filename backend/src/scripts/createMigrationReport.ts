import 'dotenv/config';
import { writeMigrationReport } from '../modules/collaboration/infrastructure/json/migrationReport.js';

const outputArg = process.argv.find(arg => arg.startsWith('--out='));
const outputPath = outputArg ? outputArg.slice('--out='.length) : undefined;
const report = writeMigrationReport(outputPath);

console.log(JSON.stringify(report, null, 2));
