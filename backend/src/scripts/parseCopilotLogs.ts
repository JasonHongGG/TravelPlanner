import fs from 'fs';
import path from 'path';
import { resolveCopilotLogDir } from '../platform/runtimePaths.js';

function stripJsonFence(text: string): string {
    const trimmed = text.trim();
    const fenceStart = /^```json\s*/i;
    const fenceEnd = /\s*```$/;
    if (fenceStart.test(trimmed) && fenceEnd.test(trimmed)) {
        return trimmed.replace(fenceStart, '').replace(fenceEnd, '').trim();
    }
    return trimmed;
}

function parseResponseContent(response: string): unknown {
    const cleaned = stripJsonFence(response);
    try {
        return JSON.parse(cleaned) as unknown;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown parse error';
        throw new Error(`Response is not valid JSON after cleanup. ${message}`);
    }
}

function parseSingleFile(filePath: string, outputDir: string): string {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw) as { response?: unknown };
    if (typeof data.response !== 'string') {
        throw new Error('Missing response string in log file.');
    }

    const parsedResponse = parseResponseContent(data.response);
    const baseName = path.basename(filePath).replace(/\.json$/i, '_parsed.json');
    const outputPath = path.join(outputDir, baseName);
    fs.writeFileSync(outputPath, JSON.stringify(parsedResponse, null, 2), 'utf8');
    return outputPath;
}

function parseDirectory(dirPath: string) {
    const outputDir = path.join(dirPath, 'parsed');
    fs.mkdirSync(outputDir, { recursive: true });

    const jsonFiles = fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.json') && !entry.name.toLowerCase().endsWith('_parsed.json'))
        .map(entry => path.join(dirPath, entry.name));

    return jsonFiles.map(filePath => {
        try {
            const outputName = path.basename(filePath).replace(/\.json$/i, '_parsed.json');
            const outputPath = path.join(outputDir, outputName);
            if (fs.existsSync(outputPath)) return { filePath, outputPath, status: 'skipped' };
            return { filePath, outputPath: parseSingleFile(filePath, outputDir), status: 'ok' };
        } catch (error) {
            return { filePath, status: 'error', message: error instanceof Error ? error.message : String(error) };
        }
    });
}

function printUsage(): void {
    console.log('Usage: npm run copilot:logs:parse -- [path-to-json-or-folder]');
    console.log('If no path is provided, the configured COPILOT_LOG_DIR is parsed.');
}

function main(): void {
    const target = process.argv[2] || resolveCopilotLogDir();
    const resolved = path.resolve(process.cwd(), target);

    if (!fs.existsSync(resolved)) {
        printUsage();
        console.error('Path not found:', resolved);
        process.exit(1);
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
        const results = parseDirectory(resolved);
        const summary = {
            total: results.length,
            success: results.filter(result => result.status === 'ok').length,
            skipped: results.filter(result => result.status === 'skipped').length,
            failed: results.filter(result => result.status === 'error').length
        };
        console.log(JSON.stringify({ summary, results }, null, 2));
        return;
    }

    const outputDir = path.join(path.dirname(resolved), 'parsed');
    fs.mkdirSync(outputDir, { recursive: true });
    const outputName = path.basename(resolved).replace(/\.json$/i, '_parsed.json');
    const outputPath = path.join(outputDir, outputName);
    if (fs.existsSync(outputPath)) {
        console.log('Parsed JSON already exists, skipped:', outputPath);
        return;
    }
    console.log('Parsed JSON saved to:', parseSingleFile(resolved, outputDir));
}

main();