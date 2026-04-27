import fs from 'fs';
import path from 'path';

export type JsonFileStoreOptions<T> = {
    filePath: string;
    defaultValue: () => T;
    validate?: (value: unknown) => T;
    onReadError?: (error: unknown) => void;
};

const activeMutations = new Set<string>();

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function ensureParentDirectory(filePath: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function tempPathFor(filePath: string): string {
    return `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
}

export function resolveDataDir(): string {
    return (process.env.DATA_DIR || '').trim() || path.join(process.cwd(), 'data');
}

export class JsonFileStore<T> {
    constructor(private readonly options: JsonFileStoreOptions<T>) { }

    exists(): boolean {
        return fs.existsSync(this.options.filePath);
    }

    read(): T {
        try {
            if (!this.exists()) {
                return cloneJson(this.options.defaultValue());
            }
            const parsed = JSON.parse(fs.readFileSync(this.options.filePath, 'utf-8')) as unknown;
            return cloneJson(this.options.validate ? this.options.validate(parsed) : parsed as T);
        } catch (error) {
            this.options.onReadError?.(error);
            return cloneJson(this.options.defaultValue());
        }
    }

    write(value: T): void {
        ensureParentDirectory(this.options.filePath);
        const tempPath = tempPathFor(this.options.filePath);
        fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf-8');
        fs.renameSync(tempPath, this.options.filePath);
    }

    mutate<Result>(mutator: (value: T) => Result): Result {
        if (activeMutations.has(this.options.filePath)) {
            throw new Error(`Nested JSON mutation detected for ${this.options.filePath}`);
        }

        activeMutations.add(this.options.filePath);
        try {
            const value = this.read();
            const result = mutator(value);
            this.write(value);
            return result;
        } finally {
            activeMutations.delete(this.options.filePath);
        }
    }
}

export function createJsonFileStore<T>(options: JsonFileStoreOptions<T>): JsonFileStore<T> {
    return new JsonFileStore(options);
}