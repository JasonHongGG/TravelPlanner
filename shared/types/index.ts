// Input form data
export interface TripInput {
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
}

// JSON Schema from the prompt
export interface TripStop {
  name: string;
  type?: 'attraction' | 'landmark' | 'nature' | 'history' | 'dining' | 'cafe' | 'shopping' | 'transport' | 'activity' | 'accommodation' | 'other';
  lat: number;
  lng: number;
  startTime: string;
  endTime: string;
  openHours: string;
  transport: string;
  costEstimate: string;
  placeLink: string;
  routeLinkToNext: string;
  notes: string;
  alternatives: string[];
}

export interface TripDay {
  day: number;
  date: string;
  theme: string;
  stops: TripStop[];
  dailyChecklist: string[];
}

export interface TripMeta {
  title?: string;
  dateRange: string;
  days: number;
  budgetEstimate: {
    transport?: number;
    dining?: number;
    tickets?: number;
    other?: number;
    total?: number;
  };
  transportStrategy: string;
  pace: string;
}

export interface TripData {
  tripMeta: TripMeta;
  days: TripDay[];
  totals: Record<string, any>;
  risks: string[];
}

export type TripStatus = 'generating' | 'complete' | 'error';

export interface Trip {
  id: string;
  title: string;
  createdAt: number;
  status: TripStatus;
  input: TripInput;
  data?: TripData;
  errorMsg?: string;
  generationTimeMs?: number;
  customCoverImage?: string;
  // Sharing fields
  visibility?: TripVisibility;
  serverTripId?: string;      // Server-side ID (exists after sharing)
  lastSyncedAt?: number;      // Last sync timestamp
}

export type MessageRole = 'user' | 'model';

export interface Message {
  role: MessageRole;
  text: string;
  timestamp: number;
}

export interface AttractionRecommendation {
  name: string;
  description: string;
  category: string;
  reason: string;
  openHours: string;
}

export interface FeasibilityResult {
  feasible: boolean;
  riskLevel: 'low' | 'moderate' | 'high';
  issues: string[];
  suggestions: string[];
}

export interface UpdateResult {
  responseText: string;
  updatedData?: TripData;
}

// ==========================================
// Trip Sharing Types
// ==========================================

export type TripVisibility = 'private' | 'public';

export interface Engagement {
  type: 'view' | 'like';
  userId?: string;
  userIp?: string;
  timestamp: number;
}

export interface SharedTripMeta {
  tripId: string;
  ownerId: string;
  ownerName: string;
  ownerPicture?: string;
  visibility: TripVisibility;
  title: string;
  destination: string;
  coverImage?: string;
  language?: string;
  dateRange: string;
  days: number;
  createdAt: number;
  lastModified: number;
  viewCount: number;
  likeCount: number;
  recentEngagements: Engagement[];
}

// ... (previous types omitted)

export type TripPermission = 'read' | 'write';

export interface SharedTrip {
  tripId: string;
  ownerId: string;
  visibility: TripVisibility;
  // Legacy support
  allowedUsers?: string[];
  // New permissions
  permissions?: Record<string, TripPermission>;
  // Computed permission for current viewer
  userPermission?: TripPermission;
  createdAt: number;
  lastModified: number;
  tripData: Trip;
}

export interface TripIndex {
  publicTrips: string[];
  sharedPrivateTrips: string[];
}

export interface GalleryResponse {
  trips: SharedTripMeta[];
  total: number;
  page: number;
  pageSize: number;
}
