import path from 'path';

function fromEnvPath(name: string): string | undefined {
    const value = (process.env[name] || '').trim();
    return value ? path.resolve(value) : undefined;
}

export function resolveWorkspaceRoot(): string {
    const cwd = process.cwd();
    const folderName = path.basename(cwd).toLowerCase();
    if (folderName === 'backend' || folderName === 'frontend') {
        return path.dirname(cwd);
    }
    return cwd;
}

export function resolveRuntimeDir(): string {
    return fromEnvPath('RUNTIME_DIR') || path.join(resolveWorkspaceRoot(), '.runtime');
}

export function resolveArtifactsDir(): string {
    return fromEnvPath('ARTIFACTS_DIR') || path.join(resolveWorkspaceRoot(), '.artifacts');
}

export function resolveBackendRuntimeDir(): string {
    return path.join(resolveRuntimeDir(), 'backend');
}

export function resolveDataDir(): string {
    return fromEnvPath('DATA_DIR') || path.join(resolveBackendRuntimeDir(), 'data');
}

export function resolveLegacyBackendDataDir(): string {
    return path.join(resolveWorkspaceRoot(), 'backend', 'data');
}

export function resolveLogDir(): string {
    return fromEnvPath('LOG_DIR') || path.join(resolveBackendRuntimeDir(), 'logs');
}

export function resolveCopilotLogDir(): string {
    return fromEnvPath('COPILOT_LOG_DIR') || path.join(resolveBackendRuntimeDir(), 'copilot-logs');
}

export function resolveMigrationReportDir(): string {
    return fromEnvPath('MIGRATION_REPORT_DIR') || path.join(resolveArtifactsDir(), 'migration');
}