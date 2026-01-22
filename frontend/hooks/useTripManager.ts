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

  const createTrip = async (input: TripInput) => {
    const newTrip: Trip = {
      id: crypto.randomUUID(),
      title: input.destination,
      createdAt: Date.now(),
      status: 'generating',
      input,
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
      .then((data) => {
        // Success implies deduction was successful on server side
        setTrips(prev => prev.map(t =>
          t.id === newTrip.id
            ? { ...t, status: 'complete', data, generationTimeMs: Date.now() - t.createdAt }
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

  // Sync cleanup: Delete orphaned trips from server that no longer exist locally
  const syncWithServer = async () => {
    if (!user?.email) return;

    try {
      // Get list of trip IDs the user has shared on the server
      const serverTripIds = await tripShareService.getMySharedTripIds();

      if (serverTripIds.length === 0) return;

      // Get local trip IDs (both id and serverTripId)
      const localTripIds = new Set<string>();
      trips.forEach(trip => {
        localTripIds.add(trip.id);
        if (trip.serverTripId) {
          localTripIds.add(trip.serverTripId);
        }
      });

      // Find orphaned trips (on server but not locally)
      const orphanedTripIds = serverTripIds.filter(id => !localTripIds.has(id));

      // Delete orphaned trips from server
      for (const tripId of orphanedTripIds) {
        console.log(`[TripManager] Cleaning up orphaned trip from server: ${tripId}`);
        await tripShareService.deleteServerTrip(tripId);
      }

      if (orphanedTripIds.length > 0) {
        console.log(`[TripManager] Cleaned up ${orphanedTripIds.length} orphaned trip(s) from server`);
      }
    } catch (error) {
      console.error('[TripManager] Error syncing with server:', error);
      // Don't throw - this is a background cleanup task
    }
  };

  return {
    trips,
    createTrip,
    updateTripData,
    updateTrip,
    deleteTrip,
    importTrip,
    retryTrip,
    syncWithServer
  };
};
