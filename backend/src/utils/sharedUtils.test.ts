import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTripCost } from './sharedUtils.js';

test('calculateTripCost reads explicit day counts', () => {
    assert.equal(calculateTripCost('共 3 天'), 80);
    assert.equal(calculateTripCost('5 days'), 100);
});

test('calculateTripCost treats date ranges as inclusive', () => {
    assert.equal(calculateTripCost('2026-04-01 - 2026-04-03'), 80);
});
