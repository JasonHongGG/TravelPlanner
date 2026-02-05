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
  currency?: string; // e.g. 'TWD', 'JPY', 'USD', 'KRW'
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
  costAmount: number;
  costCategory: 'transport' | 'dining' | 'tickets' | 'shopping' | 'accommodation' | 'other';
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
  currency?: string; // Add currency here too for the dashboard view
  travelers?: string; // e.g. "2 adults, 1 child" or "3"

  transportStrategy: string;
  pace: string;
  budgetTargets?: Record<string, number>;
}

export interface TripData {
  tripMeta: TripMeta;
  days: TripDay[];
  totals: Record<string, any>;
  advisory?: TripAdvisory;
}

export interface StructuredAdvice {
  summary: string;
  details: string[];
}

export interface TripAdvisory {
  weather: {
    forecast: StructuredAdvice;
    clothing: StructuredAdvice;
  };
  logistics: {
    transport: StructuredAdvice;
    connectivity: StructuredAdvice;
    currency: StructuredAdvice;
    refund: StructuredAdvice;
  };
  safety: {
    emergency: StructuredAdvice;
    scams: StructuredAdvice;
    health: StructuredAdvice;
  };
  cultural: {
    dos: string[];
    donts: string[];
    tipping: StructuredAdvice; // Changed to structured
    diningEtiquette?: StructuredAdvice; // Changed to structured
  };
  itineraryAnalysis: {
    pace: StructuredAdvice; // Changed to structured
    issues: string[]; // Keep as simple list for now, or could be structured. riskLevel covers summary? Let's keep issues as list. 
    highlights?: string[];
  };
  packing?: {
    essentials: string[];
    weatherSpecific: string[];
  };
  localLingo?: {
    term: string;        // The phrase in local language
    translation: string; // The meaning in target language
    pronunciation: string; // Phonetic guide
    note?: string;       // Context (e.g., "Polite form")
  }[];

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
