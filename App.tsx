import React, { useState } from 'react';
import { Trip } from './types';
import Dashboard from './components/Dashboard';
import NewTripForm from './components/NewTripForm';
import TripDetail from './components/TripDetail';
import { useTripManager } from './hooks/useTripManager';

export default function App() {
  const { trips, createTrip, updateTripData, deleteTrip, importTrip } = useTripManager();

  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [view, setView] = useState<'dashboard' | 'detail'>('dashboard');

  const handleSelectTrip = (trip: Trip) => {
    setSelectedTripId(trip.id);
    setView('detail');
  };

  const handleDeleteTrip = (tripId: string) => {
    deleteTrip(tripId);
    if (selectedTripId === tripId) {
      setSelectedTripId(null);
      setView('dashboard');
    }
  };

  const handleImportTrip = (tripData: Trip) => {
    importTrip(tripData);
    alert("行程匯入成功！");
  };

  const selectedTrip = trips.find(t => t.id === selectedTripId);

  return (
    <>
      {view === 'dashboard' && (
        <Dashboard 
          trips={trips} 
          onNewTrip={() => setIsModalOpen(true)}
          onSelectTrip={handleSelectTrip}
          onDeleteTrip={handleDeleteTrip}
          onImportTrip={handleImportTrip}
        />
      )}

      {view === 'detail' && selectedTrip && (
        <TripDetail 
          trip={selectedTrip} 
          onBack={() => setView('dashboard')}
          onUpdateTrip={updateTripData}
        />
      )}

      {isModalOpen && (
        <NewTripForm 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSubmit={createTrip} 
        />
      )}
    </>
  );
}