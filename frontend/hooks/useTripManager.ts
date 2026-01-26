import { useState, useEffect } from 'react';
import { Trip, TripInput, TripData } from '../types';
import { aiService } from '../services';
import { tripShareService } from '../services/TripShareService';
import { usePoints } from '../context/PointsContext';
import { useAuth } from '../context/AuthContext';
import { calculateTripCost } from '../utils/tripUtils';


export const useTripManager = () => {
  const { balance, openPurchaseModal, isSubscribed } = usePoints();
  const { user } = useAuth();

  // Initialize state directly from localStorage
  const [trips, setTrips] = useState<Trip[]>(() => {
    try {
      const saved = localStorage.getItem('ai_travel_trips');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse saved trips", e);
      return [];
    }
  });

  // Save to local storage whenever trips change
  useEffect(() => {
    localStorage.setItem('ai_travel_trips', JSON.stringify(trips));
  }, [trips]);

  // Sync Cloud Trips when user logs in
  useEffect(() => {
    const syncCloudTrips = async () => {
      if (!user?.email) return;

      // Optional: Restrict to Pro members if desired, though prompt implies "sync feature" is for Pro.
      // If we want to allow free users to access their own shared trips, we can remove this check.
      // But based on "cloud synchronization feature... allow Pro members", we'll keep it safe.
      // Update: User said "Pro members... allow to access and sync".
      if (!isSubscribed) return;

      try {
        console.log('[TripManager] Syncing cloud trips...');
        const serverTripIds = await tripShareService.getMySharedTripIds();
        console.log('[TripManager] Found cloud trips:', serverTripIds);

        if (serverTripIds.length === 0) return;

        // Find trips that are on server but NOT locally
        // We check against both local ID and serverTripId
        const missingTripIds = serverTripIds.filter(serverId => {
          return !trips.some(t => t.id === serverId || t.serverTripId === serverId);
        });

        if (missingTripIds.length === 0) {
          console.log('[TripManager] All cloud trips are already synced.');
          return;
        }

        console.log(`[TripManager] Found ${missingTripIds.length} missing cloud trips. Fetching...`);

        const newTrips: Trip[] = [];

        for (const tripId of missingTripIds) {
          try {
            const sharedTrip = await tripShareService.getTrip(tripId);

            // STRICT CONSTRAINT: Only sync trips *they have shared* (owned by them)
            // Backend sets ownerId to email.
            if (sharedTrip.ownerId.toLowerCase() === user.email.toLowerCase()) {
              const tripData = sharedTrip.tripData;

              // Ensure critical fields are set to link correctly
              tripData.serverTripId = sharedTrip.tripId;
              tripData.visibility = sharedTrip.visibility;

              // If ID collision happens (rare but possible if logic changes), generate new ID?
              // But here we want to restore *exact* trip if possible.
              // If local ID matches server ID, great. If not, simple import.
              // tripData already has an ID.

              // Verify again it's not in trips (just in case)
              if (!trips.some(t => t.id === tripData.id)) {
                newTrips.push(tripData);
              }
            }
          } catch (fetchErr) {
            console.error(`[TripManager] Failed to fetch shared trip ${tripId}`, fetchErr);
          }
        }

        if (newTrips.length > 0) {
          console.log(`[TripManager] Importing ${newTrips.length} cloud trips.`);
          setTrips(prev => [...prev, ...newTrips]);
        }

      } catch (err) {
        console.error('[TripManager] Cloud sync failed', err);
      }
    };

    syncCloudTrips();
    // Depends on user.email and isSubscribed. 
    // We intentionally don't include 'trips' in dependency to avoid loops, 
    // although the logic checks validity inside. 
    // We only want this to run when User connects (Login).
  }, [user?.email, isSubscribed]);

  const createTrip = async (input: TripInput) => {
    // 1. Generate High-Res Cover Image IMMEDIATELY (Fail-Safe)
    const city = input.destination.split(',')[0].trim();
    const keywords = ["landmark", "landscape", "street view", "aerial view", "architecture", "night view", "nature", "tourism", "skyline", "scenery", "historic", "culture", "daytime", "vacation", "panoramic", "travel", "sightseeing"];
    const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
    const randomPage = Math.floor(Math.random() * 10);
    const timestamp = Date.now();
    const query = `${city} ${randomKeyword}`;

    // This URL is guaranteed to be High-Res (1920x1080) and uses the diverse keywords
    const initialHdCoverUrl = `https://th.bing.com/th?q=${encodeURIComponent(query)}&w=1920&h=1080&c=7&rs=1&p=${randomPage}&t=${timestamp}`;

    const newTrip: Trip = {
      id: crypto.randomUUID(),
      title: input.destination,
      createdAt: Date.now(),
      status: 'generating',
      input,
      customCoverImage: initialHdCoverUrl // Set immediately so it shows during generation
    };

    // Calculate Cost
    const cost = calculateTripCost(input.dateRange);

    // Initial Frontend Check (UX only)
    if (!isSubscribed && balance < cost) {
      alert(`點數不足！產生此行程需要 ${cost} 點，目前餘額 ${balance} 點。`);
      openPurchaseModal();
      return;
    }

    setTrips(prev => [newTrip, ...prev]);

    // Trigger AI Generation
    // SECURITY: We pass user.email to backend. Backend executes deduction based on ACTION.
    aiService.generateTrip(input, user?.email)
      .then(async (data) => {
        // Success implies deduction was successful on server side

        // Try to fetch a potentially better one from API, but we already have a good one
        let finalCoverUrl = initialHdCoverUrl;

        try {
          const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
          const response = await fetch(`${apiBaseUrl}/cover?query=${encodeURIComponent(query)}&t=${timestamp}&p=${randomPage}`);

          if (response.ok) {
            const coverData = await response.json();
            if (coverData?.url) {
              finalCoverUrl = coverData.url;
            }
          }
        } catch (e) {
          // Ignore, we already have the fallback
        }

        setTrips(prev => prev.map(t =>
          t.id === newTrip.id
            ? {
              ...t,
              status: 'complete',
              data,
              generationTimeMs: Date.now() - t.createdAt,
              customCoverImage: finalCoverUrl
            }
            : t
        ));
      })
      .catch(err => {
        // If error involves "Insufficient points", we should probably handle it gracefully
        console.error("Generation failed:", err);
        setTrips(prev => prev.map(t =>
          t.id === newTrip.id
            ? { ...t, status: 'error', errorMsg: err.message, generationTimeMs: Date.now() - t.createdAt }
            : t
        ));
      });
  };

  const retryTrip = async (tripId: string) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    // Calculate Cost
    const cost = calculateTripCost(trip.input.dateRange);

    // Initial Frontend Check
    if (balance < cost) {
      alert(`點數不足！重試此行程需要 ${cost} 點，目前餘額 ${balance} 點。`);
      openPurchaseModal();
      return;
    }

    // Set status to generating
    setTrips(prev => prev.map(t =>
      t.id === tripId
        ? { ...t, status: 'generating', errorMsg: undefined, createdAt: Date.now() } // Reset createdAt for timer
        : t
    ));

    // Trigger AI Generation
    aiService.generateTrip(trip.input, user?.email)
      .then((data) => {
        setTrips(prev => prev.map(t =>
          t.id === tripId
            ? { ...t, status: 'complete', data, generationTimeMs: Date.now() - (t.createdAt || Date.now()) }
            : t
        ));
      })
      .catch(err => {
        setTrips(prev => prev.map(t =>
          t.id === tripId
            ? { ...t, status: 'error', errorMsg: err.message, generationTimeMs: Date.now() - (t.createdAt || Date.now()) }
            : t
        ));
      });
  };

  const updateTripData = (tripId: string, newData: TripData) => {
    setTrips(prev => prev.map(t =>
      t.id === tripId
        ? { ...t, data: newData }
        : t
    ));
  };

  const updateTrip = (tripId: string, updates: Partial<Trip>) => {
    setTrips(prev => prev.map(t =>
      t.id === tripId
        ? { ...t, ...updates }
        : t
    ));
  };

  const deleteTrip = (tripId: string) => {
    // Find the trip before deleting to check if it has server data
    const trip = trips.find(t => t.id === tripId);

    // Delete from local state first
    setTrips(prev => prev.filter(t => t.id !== tripId));

    // If the trip was shared (has serverTripId or visibility), also delete from server
    if (trip && (trip.serverTripId || trip.visibility)) {
      const serverTripId = trip.serverTripId || trip.id;
      tripShareService.deleteServerTrip(serverTripId).catch(err => {
        console.error('Failed to delete trip from server:', err);
        // We don't throw because local deletion already succeeded
      });
    }
  };

  const importTrip = (tripData: Trip) => {
    const newTrip = {
      ...tripData,
      id: crypto.randomUUID(),
      title: tripData.title,
      createdAt: Date.now()
    };
    setTrips(prev => [newTrip, ...prev]);
    return newTrip;
  };

  return {
    trips,
    createTrip,
    updateTripData,
    updateTrip,
    deleteTrip,
    importTrip,
    retryTrip
  };
};
