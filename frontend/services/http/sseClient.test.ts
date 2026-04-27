import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseSseBuffer } from './sseClient';

describe('parseSseBuffer', () => {
    it('parses complete SSE JSON frames', () => {
        const parsed = parseSseBuffer('data: {"type":"content","chunk":"a"}\n\ndata: {"type":"done"}\n\n');
        assert.deepEqual(parsed.events, [
            { type: 'content', chunk: 'a' },
            { type: 'done' }
        ]);
        assert.equal(parsed.remaining, '');
    });

    it('keeps incomplete frames in the remaining buffer', () => {
        const parsed = parseSseBuffer('data: {"type":"content"');
        assert.deepEqual(parsed.events, []);
        assert.equal(parsed.remaining, 'data: {"type":"content"');
    });

    it('ignores comment keepalive frames', () => {
        const parsed = parseSseBuffer(': keep-alive\n\ndata: {"type":"done"}\n\n');
        assert.deepEqual(parsed.events, [{ type: 'done' }]);
    });
});