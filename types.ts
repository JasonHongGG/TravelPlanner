
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

export interface AttractionRecommendation {
  name: string;
  description: string;
  category: string;
  reason: string;
  openHours: string; // Added field for opening hours
}

// JSON Schema from the prompt
export interface TripStop {
  name: string;
  lat: number;
  lng: number;
  startTime: string;
  endTime: string;
  openHours: string;
  transport: string; // e.g., "Walk 10m", "Subway 20m"
  costEstimate: string;
  placeLink: string;
  routeLinkToNext: string;
  notes: string;
  alternatives: string[]; // Simple strings for UI display
}

export interface TripDay {
  day: number;
  date: string;
  theme: string;
  stops: TripStop[];
  dailyChecklist: string[];
}

export interface TripMeta {
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
}

export type MessageRole = 'user' | 'model';

export interface Message {
  role: MessageRole;
  text: string;
  timestamp: number;
}
