import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTripCost, calculateTripDays } from './tripUtils';

test('calculateTripDays reads explicit day counts', () => {
    assert.equal(calculateTripDays('共 4 天'), 4);
    assert.equal(calculateTripDays('2 days'), 2);
});

test('calculateTripCost uses base plus daily cost', () => {
    assert.equal(calculateTripCost('共 4 天'), 90);
});
