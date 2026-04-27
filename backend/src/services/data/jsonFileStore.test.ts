import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createJsonFileStore } from './jsonFileStore.js';

type TestStore = {
    schemaVersion: 1;
    items: string[];
};

function tempFile(): string {
    return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'travel-json-store-')), 'store.json');
}

describe('JsonFileStore', () => {
    it('returns a cloned default value when the file is missing', () => {
        const store = createJsonFileStore<TestStore>({
            filePath: tempFile(),
            defaultValue: () => ({ schemaVersion: 1, items: [] })
        });

        const first = store.read();
        first.items.push('mutated');

        assert.deepEqual(store.read(), { schemaVersion: 1, items: [] });
    });

    it('writes JSON atomically through a temp file and rename', () => {
        const filePath = tempFile();
        const store = createJsonFileStore<TestStore>({
            filePath,
            defaultValue: () => ({ schemaVersion: 1, items: [] })
        });

        store.write({ schemaVersion: 1, items: ['a'] });

        assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf-8')), { schemaVersion: 1, items: ['a'] });
        assert.equal(fs.readdirSync(path.dirname(filePath)).some(file => file.endsWith('.tmp')), false);
    });

    it('mutates the latest on-disk value', () => {
        const store = createJsonFileStore<TestStore>({
            filePath: tempFile(),
            defaultValue: () => ({ schemaVersion: 1, items: [] })
        });

        const count = store.mutate((value) => {
            value.items.push('a', 'b');
            return value.items.length;
        });

        assert.equal(count, 2);
        assert.deepEqual(store.read().items, ['a', 'b']);
    });

    it('falls back to the default value when JSON is corrupt', () => {
        const filePath = tempFile();
        fs.writeFileSync(filePath, '{bad json', 'utf-8');
        let reported = false;

        const store = createJsonFileStore<TestStore>({
            filePath,
            defaultValue: () => ({ schemaVersion: 1, items: [] }),
            onReadError: () => {
                reported = true;
            }
        });

        assert.deepEqual(store.read(), { schemaVersion: 1, items: [] });
        assert.equal(reported, true);
    });
});