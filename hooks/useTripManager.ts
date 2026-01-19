import { useState, useEffect } from 'react';
import { Trip, TripInput, TripData } from '../types';
import { aiService } from '../services';
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
    // SECURITY: We pass user.email and cost to backend. Backend executes deduction.
    aiService.generateTrip(input, user?.email, cost)
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
    aiService.generateTrip(trip.input, user?.email, cost)
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
    setTrips(prev => prev.filter(t => t.id !== tripId));
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
