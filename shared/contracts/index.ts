export type TripVisibility = 'private' | 'public';
export type TripPermission = 'read' | 'write';
export type GenerationJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type GenerationBillingStatus = 'pending' | 'charged' | 'charge_failed';

export interface TripInputContract {
  dateRange: string;
  destination: string;
  travelers: string;
  interests: string;
  budget: string;
  transport: string;
  accommodation: string;
  pace: string;
  mustVisit: string;
  language: string;
  constraints: string;
  currency?: string;
  titleLanguage?: string;
}

export interface GenerationJobContract {
  jobId: string;
  action: 'GENERATE_TRIP';
  userId: string;
  tripLocalId?: string;
  clientRequestId: string;
  tripInput: TripInputContract;
  status: GenerationJobStatus;
  billingStatus: GenerationBillingStatus;
  hasResult?: boolean;
  error?: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  finishedAt?: number;
  billedAt?: number;
  claimedAt?: number;
  acknowledgedAt?: number;
}

export interface SharedTripContract<TTrip = unknown> {
  tripId: string;
  ownerId: string;
  visibility: TripVisibility;
  permissions: Record<string, TripPermission>;
  userPermission?: TripPermission;
  createdAt: number;
  lastModified: number;
  tripData: TTrip;
}

export interface UserSettingsContract {
  explorerQueueSize: number;
  titleLanguageMode: 'local' | 'specified';
}

export interface ErrorEnvelopeContract {
  error: string;
  code?: string;
  correlationId?: string;
}

export type TripEventType = 'connected' | 'trip_updated' | 'visibility_updated' | 'permissions_updated' | 'trip_deleted';

export interface TripEventTokenContract {
  token: string;
  expiresAt: number;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertTripInput(value: unknown): asserts value is TripInputContract {
  if (!isRecord(value)) throw new Error('TripInput must be an object.');
  const required = [
    'dateRange',
    'destination',
    'travelers',
    'interests',
    'budget',
    'transport',
    'accommodation',
    'pace',
    'mustVisit',
    'language',
    'constraints'
  ];
  for (const key of required) {
    if (typeof value[key] !== 'string') {
      throw new Error(`TripInput.${key} must be a string.`);
    }
  }
}

export function assertGenerationJob(value: unknown): asserts value is GenerationJobContract {
  if (!isRecord(value)) throw new Error('GenerationJob must be an object.');
  if (typeof value.jobId !== 'string') throw new Error('GenerationJob.jobId must be a string.');
  if (value.action !== 'GENERATE_TRIP') throw new Error('GenerationJob.action is invalid.');
  if (typeof value.userId !== 'string') throw new Error('GenerationJob.userId must be a string.');
  if (typeof value.clientRequestId !== 'string') throw new Error('GenerationJob.clientRequestId must be a string.');
  if (!['queued', 'running', 'completed', 'failed'].includes(String(value.status))) {
    throw new Error('GenerationJob.status is invalid.');
  }
  if (!['pending', 'charged', 'charge_failed'].includes(String(value.billingStatus))) {
    throw new Error('GenerationJob.billingStatus is invalid.');
  }
  assertTripInput(value.tripInput);
}