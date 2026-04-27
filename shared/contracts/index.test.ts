import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertGenerationJob, assertTripInput } from './index.js';

describe('shared contracts', () => {
  it('accepts a valid trip input contract', () => {
    assert.doesNotThrow(() => assertTripInput({
      dateRange: '2026-05-01 to 2026-05-03',
      destination: 'Tokyo',
      travelers: '2 adults',
      interests: 'food, temples',
      budget: 'medium',
      transport: 'train',
      accommodation: 'hotel',
      pace: 'balanced',
      mustVisit: 'Asakusa',
      language: 'en',
      constraints: ''
    }));
  });

  it('rejects incomplete trip input contracts', () => {
    assert.throws(() => assertTripInput({ destination: 'Tokyo' }), /TripInput\.dateRange/);
  });

  it('validates generation job contracts', () => {
    assert.doesNotThrow(() => assertGenerationJob({
      jobId: 'job-1',
      action: 'GENERATE_TRIP',
      userId: 'user-1',
      clientRequestId: 'request-1',
      tripInput: {
        dateRange: '2026-05-01 to 2026-05-03',
        destination: 'Tokyo',
        travelers: '2 adults',
        interests: 'food, temples',
        budget: 'medium',
        transport: 'train',
        accommodation: 'hotel',
        pace: 'balanced',
        mustVisit: 'Asakusa',
        language: 'en',
        constraints: ''
      },
      status: 'queued',
      billingStatus: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }));
  });
});