export type TripVisibility = 'private' | 'public';
export type TripPermission = 'read' | 'write';
export type TripMemberRole = 'owner' | 'editor' | 'viewer';
export type TripMemberStatus = 'active' | 'revoked';
export type WorkspaceTripSource = 'owned' | 'shared' | 'imported';
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
  memberships: TripMembershipContract[];
  permissions?: Record<string, TripPermission>;
  userPermission?: TripPermission;
  revision?: number;
  createdAt: number;
  lastModified: number;
  tripData: TTrip;
}

export interface TripDocumentContract<TContent = unknown> {
  schemaVersion: 1;
  tripId: string;
  ownerId: string;
  visibility: TripVisibility;
  revision: number;
  content: TContent;
  createdAt: number;
  updatedAt: number;
}

export interface TripMembershipContract {
  schemaVersion: 1;
  tripId: string;
  userId: string;
  role: TripMemberRole;
  status: TripMemberStatus;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceTripProjectionContract {
  schemaVersion: 1;
  workspaceUserId: string;
  localTripId: string;
  tripId: string;
  source: WorkspaceTripSource;
  roleSnapshot: TripMemberRole;
  lastSeenRevision: number;
  lastOpenedAt?: number;
  removedAt?: number;
}

export interface TripRevisionContract<TOperation = unknown> {
  tripId: string;
  revision: number;
  baseRevision: number;
  actorId: string;
  operationType: 'replace_document' | 'patch_document' | 'visibility_changed' | 'membership_changed' | 'deleted';
  operation?: TOperation;
  createdAt: number;
}

export interface WorkspaceTripSummaryContract {
  tripId: string;
  ownerId: string;
  source: WorkspaceTripSource;
  role: TripMemberRole;
  visibility: TripVisibility;
  revision: number;
  title: string;
  destination: string;
  coverImage?: string;
  dateRange: string;
  days: number;
  createdAt: number;
  lastModified: number;
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

export type TripEventType = 'connected' | 'trip_updated' | 'visibility_updated' | 'membership_updated' | 'workspace_removed' | 'trip_deleted';

export interface TripEventContract<TData = unknown> {
  eventId: string;
  tripId: string;
  type: TripEventType;
  revision?: number;
  actorId?: string;
  occurredAt: number;
  data?: TData;
}

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

export function assertSharedTrip(value: unknown): asserts value is SharedTripContract {
  if (!isRecord(value)) throw new Error('SharedTrip must be an object.');
  if (typeof value.tripId !== 'string') throw new Error('SharedTrip.tripId must be a string.');
  if (typeof value.ownerId !== 'string') throw new Error('SharedTrip.ownerId must be a string.');
  if (!['private', 'public'].includes(String(value.visibility))) throw new Error('SharedTrip.visibility is invalid.');
  if (!Array.isArray(value.memberships)) throw new Error('SharedTrip.memberships must be an array.');
  if (value.permissions !== undefined && !isRecord(value.permissions)) throw new Error('SharedTrip.permissions must be an object.');
  if (value.revision !== undefined && typeof value.revision !== 'number') throw new Error('SharedTrip.revision must be a number.');
  if (typeof value.createdAt !== 'number') throw new Error('SharedTrip.createdAt must be a number.');
  if (typeof value.lastModified !== 'number') throw new Error('SharedTrip.lastModified must be a number.');
}

export function assertTripDocument(value: unknown): asserts value is TripDocumentContract {
  if (!isRecord(value)) throw new Error('TripDocument must be an object.');
  if (value.schemaVersion !== 1) throw new Error('TripDocument.schemaVersion is invalid.');
  if (typeof value.tripId !== 'string') throw new Error('TripDocument.tripId must be a string.');
  if (typeof value.ownerId !== 'string') throw new Error('TripDocument.ownerId must be a string.');
  if (!['private', 'public'].includes(String(value.visibility))) throw new Error('TripDocument.visibility is invalid.');
  if (typeof value.revision !== 'number' || value.revision < 1) throw new Error('TripDocument.revision must be a positive number.');
  if (typeof value.createdAt !== 'number') throw new Error('TripDocument.createdAt must be a number.');
  if (typeof value.updatedAt !== 'number') throw new Error('TripDocument.updatedAt must be a number.');
}

export function assertWorkspaceTripProjection(value: unknown): asserts value is WorkspaceTripProjectionContract {
  if (!isRecord(value)) throw new Error('WorkspaceTripProjection must be an object.');
  if (value.schemaVersion !== 1) throw new Error('WorkspaceTripProjection.schemaVersion is invalid.');
  if (typeof value.workspaceUserId !== 'string') throw new Error('WorkspaceTripProjection.workspaceUserId must be a string.');
  if (typeof value.localTripId !== 'string') throw new Error('WorkspaceTripProjection.localTripId must be a string.');
  if (typeof value.tripId !== 'string') throw new Error('WorkspaceTripProjection.tripId must be a string.');
  if (!['owned', 'shared', 'imported'].includes(String(value.source))) throw new Error('WorkspaceTripProjection.source is invalid.');
  if (!['owner', 'editor', 'viewer'].includes(String(value.roleSnapshot))) throw new Error('WorkspaceTripProjection.roleSnapshot is invalid.');
  if (typeof value.lastSeenRevision !== 'number') throw new Error('WorkspaceTripProjection.lastSeenRevision must be a number.');
}