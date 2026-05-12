import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { resolveDataDir } from '../../platform/runtimePaths.js';

type PersistentSecretOptions = {
    envKeys: string[];
    fileEnvKey: string;
    fileName: string;
    fallbackValue: string;
    byteLength?: number;
};

const secretCache = new Map<string, string>();

function readConfiguredSecret(envKeys: string[]): string | null {
    for (const key of envKeys) {
        const value = (process.env[key] || '').trim();
        if (value) return value;
    }
    return null;
}

function resolveSecretFilePath(fileEnvKey: string, fileName: string): string {
    const explicitPath = (process.env[fileEnvKey] || '').trim();
    return explicitPath
        ? path.resolve(explicitPath)
        : path.join(resolveDataDir(), '.secrets', fileName);
}

function readSecretFile(secretPath: string): string | null {
    try {
        const value = fs.readFileSync(secretPath, 'utf-8').trim();
        return value || null;
    } catch {
        return null;
    }
}

function writeSecretFile(secretPath: string, value: string): string {
    fs.mkdirSync(path.dirname(secretPath), { recursive: true });
    fs.writeFileSync(secretPath, `${value}\n`, { mode: 0o600 });
    return value;
}

export function getPersistentSecret(options: PersistentSecretOptions): string {
    const cacheKey = `${options.fileEnvKey}:${options.fileName}`;
    const cached = secretCache.get(cacheKey);
    if (cached) return cached;

    const configured = readConfiguredSecret(options.envKeys);
    if (configured) {
        secretCache.set(cacheKey, configured);
        return configured;
    }

    const secretPath = resolveSecretFilePath(options.fileEnvKey, options.fileName);
    const fromFile = readSecretFile(secretPath);
    if (fromFile) {
        secretCache.set(cacheKey, fromFile);
        return fromFile;
    }

    if (process.env.NODE_ENV !== 'production') {
        secretCache.set(cacheKey, options.fallbackValue);
        return options.fallbackValue;
    }

    const generated = crypto.randomBytes(options.byteLength ?? 32).toString('hex');
    const persisted = writeSecretFile(secretPath, generated);
    console.warn(`[Security] Generated persistent secret at ${secretPath}.`);
    secretCache.set(cacheKey, persisted);
    return persisted;
}