import { useState, useEffect, useRef } from 'react';
import { Trip, TripInput, TripData } from '../types';
import { aiService } from '../services';
import type { GenerationJob } from '../services/TravelAIService';
import { tripShareService } from '../services/TripShareService';
import { usePoints } from '../context/PointsContext';
import { useAuth } from '../context/AuthContext';
import { calculateTripCost } from '../utils/tripUtils';
import { useStatusAlert } from '../context/StatusAlertContext';
import { useTranslation } from 'react-i18next';


export const useTripManager = () => {
  const { balance, openPurchaseModal, isSubscribed } = usePoints();
  const { user } = useAuth();
  const { showAlert } = useStatusAlert(); // Hook
  const { t } = useTranslation();
  const JOB_POLL_INTERVAL_MS = 3500;
  const STALE_GENERATING_MS = 10 * 60 * 1000;
  const activeJobPollingRef = useRef<Set<string>>(new Set());

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
  const tripsRef = useRef<Trip[]>(trips);

  // Save to local storage whenever trips change
  useEffect(() => {
    tripsRef.current = trips;
    localStorage.setItem('ai_travel_trips', JSON.stringify(trips));
  }, [trips]);

  const applyGenerationJobToTrip = (tripId: string, job: GenerationJob) => {
    setTrips(prev => prev.map(t => {
      if (t.id !== tripId) return t;

      if (job.status === 'failed') {
        return {
          ...t,
          status: 'error',
          errorMsg: job.error || 'Generation failed',
          generationTimeMs: Date.now() - t.createdAt,
          lastJobCheckAt: Date.now()
        };
      }

      return {
        ...t,
        status: 'generating',
        lastJobCheckAt: Date.now()
      };
    }));
  };

  const applyCompletedTripResult = (tripId: string, result: TripData) => {
    setTrips(prev => prev.map(t => {
      if (t.id !== tripId) return t;
      return {
        ...t,
        status: 'complete',
        data: result,
        errorMsg: undefined,
        generationTimeMs: Date.now() - t.createdAt,
        lastJobCheckAt: Date.now()
      };
    }));
  };

  const pollGenerationJob = async (tripId: string, jobId: string) => {
    const activeJobPolling = activeJobPollingRef.current;
    if (activeJobPolling.has(jobId)) return;
    activeJobPolling.add(jobId);

    try {
      while (true) {
        const currentTrip = tripsRef.current.find(t => t.id === tripId);
        if (!currentTrip) break;

        const job = await aiService.getGenerationJob(jobId);
        applyGenerationJobToTrip(tripId, job);

        if (job.status === 'completed') {
          const claimed = await aiService.claimGenerationJob(jobId);
          applyCompletedTripResult(tripId, claimed.result);
          try {
            await aiService.ackGenerationJob(jobId, claimed.claimToken);
          } catch (ackErr) {
            console.warn('[TripManager] Ack generation job failed, will expire by TTL:', ackErr);
          }
          break;
        }

        if (job.status === 'failed') {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, JOB_POLL_INTERVAL_MS));
      }
    } catch (err: any) {
      setTrips(prev => prev.map(t =>
        t.id === tripId
          ? {
            ...t,
            status: 'error',
            errorMsg: err?.message || 'Failed to fetch generation status',
            generationTimeMs: Date.now() - t.createdAt
          }
          : t
      ));
    } finally {
      activeJobPolling.delete(jobId);
    }
  };

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

  // Resume pending generation jobs after page reload / reconnect
  useEffect(() => {
    const pending = trips.filter(t => t.status === 'generating');
    if (pending.length === 0) return;

    for (const trip of pending) {
      if (trip.generationJobId) {
        void pollGenerationJob(trip.id, trip.generationJobId);
      } else if (Date.now() - trip.createdAt > STALE_GENERATING_MS) {
        setTrips(prev => prev.map(t =>
          t.id === trip.id
            ? {
              ...t,
              status: 'error',
              errorMsg: t.errorMsg || 'Generation session expired. Please retry.',
              generationTimeMs: Date.now() - t.createdAt
            }
            : t
        ));
      }
    }
  }, [trips]);

  const createTrip = async (input: TripInput) => {
    const clientRequestId = crypto.randomUUID();
    const newTrip: Trip = {
      id: crypto.randomUUID(),
      title: input.destination,
      createdAt: Date.now(),
      status: 'generating',
      input,
      generationClientRequestId: clientRequestId
    };

    // Calculate Cost
    const cost = calculateTripCost(input.dateRange);

    // Initial Frontend Check (UX only)
    if (!isSubscribed && balance < cost) {
      openPurchaseModal();
      return;
    }

    setTrips(prev => [newTrip, ...prev]);

    try {
      const job = await aiService.createGenerationJob(input, user?.email, {
        tripLocalId: newTrip.id,
        clientRequestId
      });

      setTrips(prev => prev.map(t =>
        t.id === newTrip.id
          ? {
            ...t,
            generationJobId: job.jobId,
            lastJobCheckAt: Date.now()
          }
          : t
      ));

      void pollGenerationJob(newTrip.id, job.jobId);
    } catch (err: any) {
      console.error("Generation failed:", err);
      setTrips(prev => prev.map(t =>
        t.id === newTrip.id
          ? { ...t, status: 'error', errorMsg: err.message, generationTimeMs: Date.now() - t.createdAt }
          : t
      ));
    }
  };

  const retryTrip = async (tripId: string) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    // Calculate Cost
    const cost = calculateTripCost(trip.input.dateRange);

    // Initial Frontend Check
    if (balance < cost) {
      openPurchaseModal();
      return;
    }

    // Set status to generating
    setTrips(prev => prev.map(t =>
      t.id === tripId
        ? { ...t, status: 'generating', errorMsg: undefined, createdAt: Date.now() } // Reset createdAt for timer
        : t
    ));

    try {
      const clientRequestId = crypto.randomUUID();
      const job = await aiService.createGenerationJob(trip.input, user?.email, {
        tripLocalId: tripId,
        clientRequestId
      });

      setTrips(prev => prev.map(t =>
        t.id === tripId
          ? {
            ...t,
            generationJobId: job.jobId,
            generationClientRequestId: clientRequestId,
            lastJobCheckAt: Date.now()
          }
          : t
      ));

      void pollGenerationJob(tripId, job.jobId);
    } catch (err: any) {
      setTrips(prev => prev.map(t =>
        t.id === tripId
          ? { ...t, status: 'error', errorMsg: err.message, generationTimeMs: Date.now() - (t.createdAt || Date.now()) }
          : t
      ));
    }
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
