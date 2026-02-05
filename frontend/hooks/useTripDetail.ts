import { useEffect, useState } from 'react';
import { Trip, TripStop } from '../types';
import { getDayMapConfig } from '../utils/mapHelpers';

export const useTripDetail = (trip: Trip) => {
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'itinerary' | 'budget' | 'advisory'>('itinerary');
  const [isMapOpen, setIsMapOpen] = useState(true);
  const [mapState, setMapState] = useState<{ url: string; label: string }>({
    url: '',
    label: ''
  });

  useEffect(() => {
    const days = trip.data?.days || [];
    const day = days.find(d => d.day === selectedDay);
    const config = getDayMapConfig(day, trip.input.destination);
    setMapState(prev => {
      if (prev.url === config.url && prev.label === config.label) return prev;
      return config;
    });
  }, [selectedDay, trip.data, trip.input.destination]);

  const handleResetMap = () => {
    const days = trip.data?.days || [];
    const day = days.find(d => d.day === selectedDay);
    const config = getDayMapConfig(day, trip.input.destination);
    setMapState(config);
  };

  const handleFocusStop = (stop: TripStop) => {
    // Check for valid coordinates
    if (stop.lat && stop.lng && (stop.lat !== 0 || stop.lng !== 0)) {
      const query = `${stop.lat},${stop.lng}`;
      setMapState({
        url: `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=16&ie=UTF8&iwloc=&output=embed`,
        label: `📍 ${stop.name}`
      });
    } else {
      // Fallback to name search
      const city = trip.input.destination;
      const query = `${stop.name}, ${city}`;
      setMapState({
        url: `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=16&ie=UTF8&iwloc=&output=embed`,
        label: `📍 ${stop.name}`
      });
    }

    if (!isMapOpen) {
      setIsMapOpen(true);
    }
  };

  return {
    selectedDay,
    setSelectedDay,
    activeTab,
    setActiveTab,
    isMapOpen,
    setIsMapOpen,
    mapState,
    setMapState,
    handleResetMap,
    handleFocusStop
  };
};
