import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Trip } from './types';
import Dashboard from './components/Dashboard';
import NewTripForm from './components/NewTripForm';
import TripDetail from './components/TripDetail';
import GalleryPage from './components/GalleryPage';
import SharedTripView from './components/SharedTripView';
import { useTripManager } from './hooks/useTripManager';
import { useAuth } from './context/AuthContext';
import LoginScreen from './components/LoginScreen';
import LandingPage from './components/LandingPage';
import PurchasePointsModal from './components/PurchasePointsModal';
import { usePoints } from './context/PointsContext';
import { StatusAlertProvider } from './context/StatusAlertContext';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Travel Manager Component (Dashboard Logic)
const TravelManager = () => {
  const { trips, createTrip, updateTripData, updateTrip, deleteTrip, importTrip, retryTrip } = useTripManager();
  const { isPurchaseModalOpen, closePurchaseModal, initialTab } = usePoints();

  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [view, setView] = useState<'dashboard' | 'detail' | 'gallery'>('dashboard');

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

  const selectedTrip = trips.find(t => t.id === selectedTripId);

  return (
    <>
      {view === 'dashboard' && (
        <Dashboard
          trips={trips}
          onNewTrip={() => setIsModalOpen(true)}
          onSelectTrip={handleSelectTrip}
          onDeleteTrip={handleDeleteTrip}
          onImportTrip={importTrip}
          onRetryTrip={retryTrip}
          onOpenGallery={() => setView('gallery')}
        />
      )}

      {view === 'gallery' && (
        <GalleryPage
          onBack={() => setView('dashboard')}
          onSelectTrip={(tripId) => {
            // For now, gallery selection within dashboard view might just act as preview or import
            // If we want to navigate to the shared view:
            window.open(`/trip/${tripId}`, '_blank');
          }}
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
        initialTab={initialTab}
      />
    </>
  );
};

// Public Route Wrapper for Login (redirects if already logged in)
const PublicOnlyRoute = ({ children }: { children: React.ReactElement }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <StatusAlertProvider>
      <BrowserRouter>
        <Routes>
          {/* Intro / Landing Page */}
          <Route path="/" element={
            <PublicOnlyRoute>
              <LandingPageWrapper />
            </PublicOnlyRoute>
          } />

          {/* Login Page */}
          <Route path="/login" element={
            <PublicOnlyRoute>
              <LoginScreen />
            </PublicOnlyRoute>
          } />

          {/* Protected Dashboard */}
          <Route path="/dashboard/*" element={
            <ProtectedRoute>
              <TravelManager />
            </ProtectedRoute>
          } />

          {/* Shared Trip View (Public) */}
          <Route path="/trip/:tripId" element={<SharedTripViewWrapper />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StatusAlertProvider>
  );
}

// Wrapper to inject navigation into LandingPage props
const LandingPageWrapper = () => {
  const navigate = useNavigate();
  return <LandingPage onLoginClick={() => navigate('/login')} />;
}

// Wrapper to handle params for SharedTripView
const SharedTripViewWrapper = () => {
  return <SharedTripViewWithParams />;
}



const SharedTripViewWithParams = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { isPurchaseModalOpen, closePurchaseModal, initialTab } = usePoints();

  if (!tripId) return <Navigate to="/" />;

  return (
    <>
      <SharedTripView
        tripId={tripId}
        onBack={() => navigate('/')}
      />
      <PurchasePointsModal
        isOpen={isPurchaseModalOpen}
        onClose={closePurchaseModal}
        initialTab={initialTab}
      />
    </>
  );
}
