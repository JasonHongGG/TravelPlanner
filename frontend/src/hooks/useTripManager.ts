import { useState, useEffect, useRef } from 'react';
import { Trip, TripInput, TripData } from '../types';
import { aiService } from '../services';
import { tripShareService } from '../services/TripShareService';
import { usePoints } from '../context/PointsContext';
import { useAuth } from '../context/AuthContext';
import { calculateTripCost } from '../utils/tripUtils';
import { fetchMissingOwnedCloudTrips } from '../services/cloudTripSync';
import { useGenerationJobPolling } from './useGenerationJobPolling';
import {
  applyGenerationError,
  createGeneratingTrip,
  loadStoredTrips,
  markStaleGeneratingTrip,
  saveStoredTrips
} from '../services/tripRuntime';


export const useTripManager = () => {
  const { balance, openPurchaseModal, isSubscribed } = usePoints();
  const { user } = useAuth();
  const JOB_POLL_INTERVAL_MS = 3500;
  const STALE_GENERATING_MS = 10 * 60 * 1000;

  const [trips, setTrips] = useState<Trip[]>(() => loadStoredTrips(user?.email));
  const tripsRef = useRef<Trip[]>(trips);
  const { pollGenerationJob } = useGenerationJobPolling({ tripsRef, setTrips, jobPollIntervalMs: JOB_POLL_INTERVAL_MS });

  useEffect(() => {
    setTrips(loadStoredTrips(user?.email));
  }, [user?.email]);

  // Save to local storage whenever trips change
  useEffect(() => {
    tripsRef.current = trips;
    saveStoredTrips(trips, user?.email);
  }, [trips, user?.email]);

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
        const newTrips = await fetchMissingOwnedCloudTrips({
          ownerEmail: user.email,
          localTrips: tripsRef.current,
          client: tripShareService
        });

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
        setTrips(prev => markStaleGeneratingTrip(prev, trip.id));
      }
    }
  }, [trips]);

  const createTrip = async (input: TripInput) => {
    const clientRequestId = crypto.randomUUID();
    const newTrip = createGeneratingTrip(input, clientRequestId);

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
      setTrips(prev => applyGenerationError(prev, newTrip.id, err.message));
    }
  };

  const retryTrip = async (tripId: string) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    // Calculate Cost
    const cost = calculateTripCost(trip.input.dateRange);

    // Initial Frontend Check
    if (!isSubscribed && balance < cost) {
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
      setTrips(prev => applyGenerationError(prev, tripId, err.message));
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
      const isOwnedCloudTrip = !trip.ownerId || !user?.email || trip.ownerId.toLowerCase() === user.email.toLowerCase();
      const cloudDelete = isOwnedCloudTrip
        ? tripShareService.deleteServerTrip(serverTripId)
        : tripShareService.removeFromWorkspace(serverTripId);

      cloudDelete.catch(err => {
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
