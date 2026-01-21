import React, { useState, useEffect } from 'react';
import { Trip } from './types';
import Dashboard from './components/Dashboard';
import NewTripForm from './components/NewTripForm';
import TripDetail from './components/TripDetail';
import GalleryPage from './components/GalleryPage';
import SharedTripView from './components/SharedTripView';
import { useTripManager } from './hooks/useTripManager';
import { useAuth } from './context/AuthContext';
import LoginScreen from './components/LoginScreen';
import PurchasePointsModal from './components/PurchasePointsModal';
import { usePoints } from './context/PointsContext';

// 解析 URL 路徑
function parseRoute(): { type: 'home' | 'shared-trip' | 'gallery', tripId?: string } {
  const path = window.location.pathname;
  const tripMatch = path.match(/^\/trip\/(.+)$/);
  if (tripMatch) {
    return { type: 'shared-trip', tripId: tripMatch[1] };
  }
  if (path === '/gallery') {
    return { type: 'gallery' };
  }
  return { type: 'home' };
}

export default function App() {
  const { trips, createTrip, updateTripData, updateTrip, deleteTrip, importTrip, retryTrip } = useTripManager();
  const { isPurchaseModalOpen, closePurchaseModal } = usePoints();

  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [view, setView] = useState<'dashboard' | 'detail' | 'gallery'>('dashboard');

  // URL 路由狀態
  const [route, setRoute] = useState(parseRoute);

  // 監聽瀏覽器的 popstate 事件（返回/前進按鈕）
  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 導航到首頁
  const navigateHome = () => {
    window.history.pushState({}, '', '/');
    setRoute({ type: 'home' });
    setView('dashboard');
  };

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
  };

  const handleViewGalleryTrip = (tripId: string) => {
    // 導航到分享行程頁面
    window.history.pushState({}, '', `/trip/${tripId}`);
    setRoute({ type: 'shared-trip', tripId });
  };

  const selectedTrip = trips.find(t => t.id === selectedTripId);

  // Database initialized via singleton import
  // React.useEffect(() => { ... });

  const { user, isLoading } = useAuth(); // Access user state

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // 如果是分享行程 URL，顯示 SharedTripView
  if (route.type === 'shared-trip' && route.tripId) {
    return (
      <>
        <SharedTripView
          tripId={route.tripId}
          onBack={navigateHome}
        />
        <PurchasePointsModal
          isOpen={isPurchaseModalOpen}
          onClose={closePurchaseModal}
        />
      </>
    );
  }

  return (
    <>
      <>
        {view === 'dashboard' && (
          <Dashboard
            trips={trips}
            onNewTrip={() => setIsModalOpen(true)}
            onSelectTrip={handleSelectTrip}
            onDeleteTrip={handleDeleteTrip}
            onImportTrip={handleImportTrip}
            onRetryTrip={retryTrip}
            onOpenGallery={() => setView('gallery')}
          />
        )}

        {view === 'gallery' && (
          <GalleryPage
            onBack={() => setView('dashboard')}
            onSelectTrip={handleViewGalleryTrip}
          />
        )}

        {view === 'detail' && selectedTrip && (
          <TripDetail
            trip={selectedTrip}
            onBack={() => setView('dashboard')}
            onUpdateTrip={updateTripData}
            onUpdateTripMeta={(updates) => updateTrip(selectedTrip.id, updates)}
          />
        )}

        {isModalOpen && (
          <NewTripForm
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSubmit={createTrip}
          />
        )}

        <PurchasePointsModal
          isOpen={isPurchaseModalOpen}
          onClose={closePurchaseModal}
        />
      </>
    </>
  );
}
