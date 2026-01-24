
import React, { useState, useRef } from 'react';
import { Trip, TripData, TripMeta, TripStop, Message, TripVisibility } from '../types';
import { CheckCircle2, AlertTriangle, Calendar, Clock, DollarSign, PanelRightClose, PanelRightOpen, Map as MapIcon, Loader2, Camera, ImagePlus, Shuffle, Share2, Cloud } from 'lucide-react';
import Assistant from './Assistant';
import { aiService } from '../services'; // Import singleton service
import { safeRender } from '../utils/formatters';
import { useTripDetail } from '../hooks/useTripDetail';
import { getTripCover } from '../utils/tripUtils';

import { useTranslation } from 'react-i18next';
import { useFeasibilityCheck } from '../hooks/useFeasibilityCheck';

// Sub-components
import DaySelector from './trip/DaySelector';
import ItineraryTimeline from './trip/ItineraryTimeline';
import BudgetView from './trip/BudgetView';
import TripMap from './trip/TripMap';
import AttractionExplorer from './AttractionExplorer';
import FeasibilityModal from './FeasibilityModal';
import ShareTripModal from './ShareTripModal';
import VisibilityToggle from './VisibilityToggle';
import { tripShareService } from '../services/TripShareService';

interface Props {
  trip: Trip;
  onBack: () => void;
  onUpdateTrip: (tripId: string, newData: TripData) => void;
  onUpdateTripMeta?: (updates: Partial<Trip>) => void; // Optional for backward compatibility, but passed from App
  isSharedView?: boolean;
}

import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export default function TripDetail({ trip, onBack, onUpdateTrip, onUpdateTripMeta, isSharedView = false }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { settings } = useSettings();

  // Map i18n code to prompt language name
  const getPromptLanguage = (lng: string) => {
    switch (lng) {
      case 'en-US': return 'English';
      case 'ja-JP': return 'Japanese';
      case 'ko-KR': return 'Korean';
      default: return 'Traditional Chinese';
    }
  };

  const currentLanguage = getPromptLanguage(i18n.language);

  const {
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
  } = useTripDetail(trip);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isReshaping, setIsReshaping] = useState(false);

  // Attraction Explorer State
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [isUpdatingFromExplorer, setIsUpdatingFromExplorer] = useState(false);

  // Sharing State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Handle visibility change (private <-> public)
  const handleVisibilityChange = async (newVisibility: TripVisibility) => {
    if (!trip.data) return;

    setIsSyncing(true);
    try {
      if (newVisibility === 'public') {
        // Switching to public = auto share (save/update on server)
        const serverTripId = await tripShareService.saveTrip(trip, 'public');
        onUpdateTripMeta?.({ serverTripId, visibility: 'public', lastSyncedAt: Date.now() });
      } else {
        // Switching to private
        if (trip.serverTripId) {
          // Update visibility on server if already shared
          await tripShareService.updateVisibility(trip.serverTripId, 'private');
          onUpdateTripMeta?.({ visibility: 'private' });
        } else {
          // Just update local state
          onUpdateTripMeta?.({ visibility: 'private' });
        }
      }
    } catch (e) {
      console.error('Failed to update visibility:', e);
      alert('更新失敗，請稍後再試');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle share toggle (only for private mode)
  const handleShareToggle = async (shouldShare: boolean) => {
    if (!trip.data) return;

    setIsSyncing(true);
    try {
      if (shouldShare) {
        // Share: save to server as private
        const serverTripId = await tripShareService.saveTrip(trip, 'private');
        onUpdateTripMeta?.({ serverTripId, visibility: 'private', lastSyncedAt: Date.now() });
      } else {
        // Unshare: delete from server
        if (trip.serverTripId) {
          await tripShareService.deleteServerTrip(trip.serverTripId);
          onUpdateTripMeta?.({ serverTripId: undefined, lastSyncedAt: undefined });
        }
      }
    } catch (e) {
      console.error('Failed to toggle share:', e);
      alert(shouldShare ? '分享失敗，請稍後再試' : '取消分享失敗，請稍後再試');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle sync to cloud (update existing server copy)
  const handleSyncToCloud = async () => {
    if (!trip.data || !trip.serverTripId) return;

    setIsSyncing(true);
    try {
      await tripShareService.saveTrip(trip, trip.visibility || 'private');
      onUpdateTripMeta?.({ lastSyncedAt: Date.now() });
    } catch (e) {
      console.error('Failed to sync to cloud:', e);
      alert('同步失敗，請稍後再試');
    } finally {
      setIsSyncing(false);
    }
  };

  // Feasibility Check State
  const {
    isCheckingFeasibility,
    setIsCheckingFeasibility,
    feasibilityResult,
    performFeasibilityCheck,
    setChatPendingUpdate,
    handleFeasibilityConfirm,
    handleFeasibilityCancel
  } = useFeasibilityCheck({
    trip,
    onUpdateTrip,
    userEmail: user?.email,
    language: trip.input.language || getPromptLanguage(i18n.language),
    onCancelExplorer: () => setIsUpdatingFromExplorer(false)
  });


  // AI Process State for Unified UI Feedback
  const [aiProcessState, setAiProcessState] = useState<'idle' | 'planning' | 'checking' | 'reshaping'>('idle');

  // AI Update Handler (Used by Assistant)
  // Modified Logic: Generate First -> Check Data -> Apply
  const handleAiUpdate = async (history: Message[], onThought: (text: string) => void): Promise<string> => {
    if (!trip.data) return "";

    const chatLang = currentLanguage;
    const tripLang = trip.input.language || chatLang;

    // Phase 1: Planning (Generating JSON) - This fills the "freeze" gap
    // Removed to allow non-blocking chat. Assistant component handles "Thinking..." UI.
    // setAiProcessState('planning');

    try {
      // 1. 先讓 AI 處理對話與生成 (無論是聊天還是修改)
      // Pass user credentials
      const result = await aiService.updateTrip(
        trip.data!,
        history,
        onThought,
        user?.email,
        chatLang, // Chat Language
        tripLang, // Trip Title Language (Prioritize Trip's language over User Settings for updates)
        () => setAiProcessState('planning') // Trigger planning state only when JSON generation starts
      );

      // 2. 如果結果中沒有 updatedData，表示 AI 認為這只是一般對話，不需要檢查可行性
      if (!result.updatedData) {
        setAiProcessState('idle');
        return result.responseText;
      }

      // Phase 2: Checking Feasibility
      setAiProcessState('checking'); // Update UI State
      setIsCheckingFeasibility(true); // Keep hook state in sync if needed by hook logic

      try {
        // UX Delay: Allow user to see "Checking Feasibility" state
        await new Promise(r => setTimeout(r, 1500));

        const lastMsg = history[history.length - 1].text;
        const checkResult = await aiService.checkFeasibility(
          result.updatedData, // Check the PROPOSED itinerary
          `User Chat Request: ${lastMsg}`,
          user?.email,
          chatLang
        );

        // Check finished
        setIsCheckingFeasibility(false);

        if (!checkResult.feasible || checkResult.riskLevel === 'high') {
          // 4a. 風險高 -> 顯示 Modal，暫存數據 (pendingNewData)
          setChatPendingUpdate(checkResult, result.updatedData);
          setAiProcessState('idle'); // Hide overlay, show Modal

          // 我們仍回傳 AI 的文字回應，讓對話框顯示「好的，我已為您安排...」
          // 但實際上 UI 尚未更新，直到用戶在 Modal 點擊確認
          return result.responseText;
        }
      } catch (e) {
        console.warn("Feasibility check failed, proceeding anyway", e);
        setIsCheckingFeasibility(false);
      }

      // Phase 3: Reshaping (Applying Update)
      setAiProcessState('reshaping');
      setIsReshaping(true);
      try {
        await new Promise(r => setTimeout(r, 1500));
        onUpdateTrip(trip.id, result.updatedData);
      } finally {
        setIsReshaping(false);
        setAiProcessState('idle'); // Done
      }
      return result.responseText;

    } catch (e) {
      console.error("AI Update Failed", e);
      setAiProcessState('idle');
      return "抱歉，處理您的請求時發生錯誤，請稍後再試。";
    }
  };

  const handleFeasibilityConfirmWithReshape = async () => {
    setAiProcessState('reshaping');
    setIsReshaping(true);
    try {
      await new Promise(r => setTimeout(r, 1500));
      await handleFeasibilityConfirm();
    } finally {
      setIsReshaping(false);
      setAiProcessState('idle');
    }
  };

  // Handler for Explorer Confirmation
  const handleExplorerConfirm = async (
    newMustVisit: string[],
    newAvoid: string[],
    keepExisting: string[],
    removeExisting: string[]
  ) => {
    if (!trip.data) return;

    // Safety check: if nothing changed, don't call AI
    if (newMustVisit.length === 0 && newAvoid.length === 0 && keepExisting.length === 0 && removeExisting.length === 0) {
      return;
    }

    const context = `
      Modification for Day ${selectedDay}:
      Add: ${newMustVisit.join(', ')}
      Remove: ${newAvoid.join(', ')}
      Keep: ${keepExisting.join(', ')}
    `;

    // Define the actual update logic
    const executeExplorerUpdate = async () => {
      setIsUpdatingFromExplorer(true);
      try {
        // Call backend with specific params
        const result = await aiService.updateTripWithExplorer(
          trip.data!,
          selectedDay,
          newMustVisit,
          newAvoid,
          keepExisting,
          removeExisting,
          (thought) => console.log("AI Thinking:", thought),
          user?.email,
          currentLanguage, // Chat language
          trip.input.language || currentLanguage, // Trip Title Language (Keep consistent with trip)
          () => setAiProcessState('planning')
        );

        if (result.updatedData) {
          onUpdateTrip(trip.id, result.updatedData);
        }
      } catch (e) {
        console.error("Failed to update trip from explorer", e);
        alert(t('trip.error_update') || "更新行程時發生錯誤，請稍後再試。");
      } finally {
        setIsUpdatingFromExplorer(false);
      }
    };

    // Run Check First (Explorer Flow is explicitly a modification, so pre-check is fine here)
    performFeasibilityCheck(context, executeExplorerUpdate);
  };

  // Error State
  if (trip.status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white text-center px-6 relative overflow-hidden">

        {/* Background Decorations */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-red-50 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-orange-50 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />

        {/* Icon */}
        <div className="relative mb-8 animate-in fade-in zoom-in-50 duration-700">
          <div className="absolute inset-0 bg-red-100/50 blur-2xl rounded-full scale-150 transform translate-y-4" />
          <div className="relative bg-white w-24 h-24 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex items-center justify-center border border-red-50 rotate-3 transition-transform hover:rotate-0 duration-500 group">
            <AlertTriangle className="w-10 h-10 text-red-500 group-hover:scale-110 transition-transform duration-300" strokeWidth={1.5} />
          </div>
        </div>

        {/* Text Content */}
        <div className="max-w-lg mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
            {t('trip.error_title')}
          </h2>

          <p className="text-lg text-gray-500 leading-relaxed">
            {t('trip.error_desc')}
          </p>

          <div className="pt-8 flex justify-center gap-4">
            <button
              onClick={onBack}
              className="group flex items-center gap-2 px-8 py-3.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-black hover:-translate-y-0.5 transition-all duration-200 shadow-lg shadow-gray-200"
            >
              <span>{t('trip.back_to_dashboard')}</span>
            </button>
          </div>
        </div>

        {/* Footer simple branding */}
        <div className="absolute bottom-10 text-xs font-semibold text-gray-300 tracking-[0.2em] uppercase">
          Travel Planner
        </div>
      </div>
    );
  }

  // Loading State
  if (!trip.data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white text-center px-6 relative overflow-hidden">

        {/* Background Decorations */}
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-brand-50 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-sky-50 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse animation-delay-2000" />

        {/* Central Content */}
        <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">

          {/* Existing Spinner (Preserved as requested) */}
          <div className="relative mb-8">
            {/* Add a subtle glow behind the spinner */}
            <div className="absolute inset-0 bg-brand-200/40 blur-xl rounded-full scale-150" />
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-500 shadow-lg shadow-brand-200"></div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-3">
            {t('trip.generating')}
          </h2>

          <p className="text-gray-500 font-medium animate-pulse mb-8">
            {t('trip.generating_desc') || "正在為您編織獨一無二的旅程..."}
          </p>

          <button
            onClick={onBack}
            className="group px-6 py-2.5 bg-white text-gray-500 border border-gray-200 rounded-full text-sm font-bold hover:text-gray-900 hover:border-gray-400 hover:bg-gray-50 transition-all duration-300 shadow-sm hover:shadow"
          >
            {t('common.back')}
          </button>
        </div>

        {/* Footer simple branding */}
        <div className="absolute bottom-10 text-xs font-semibold text-gray-300 tracking-[0.2em] uppercase">
          Travel Planner
        </div>
      </div>
    );
  }

  const tripMeta = trip.data.tripMeta || ({} as TripMeta);
  const days = trip.data.days || [];
  const risks = trip.data.risks || [];
  const currentDayData = days.find(d => d.day === selectedDay);

  // Construct a relevant image URL using Pollinations AI (Switched to Bing for variety)
  const headerImageUrl = getTripCover(trip);

  // Centralized Cover Image Updater with Auto-Sync
  const updateCoverImage = async (newUrl: string | undefined) => {
    // 1. Update Local State Immediate (Optimistic UI)
    if (onUpdateTripMeta) {
      onUpdateTripMeta({ customCoverImage: newUrl });
    }

    // 2. Auto-Sync to Server if Shared
    if (trip.serverTripId) {
      // Create a temporary trip object with the new image for syncing
      // We need to cast or construct carefully to satisfy the type
      const updatedTrip = { ...trip, customCoverImage: newUrl };

      try {
        // Run in background, don't block UI
        // visibility is required, use current or default to private (though if serverTripId exists, it has a visibility)
        await tripShareService.saveTrip(updatedTrip, trip.visibility || 'private');
        console.log('[TripDetail] Auto-synced cover image to server');
      } catch (e) {
        console.error('[TripDetail] Failed to auto-sync cover image:', e);
        // Optional: show toast
      }
    }
  };

  const handleEditCoverClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Validate size (max 20MB pre-compression)
    if (file.size > 20 * 1024 * 1024) {
      alert("圖片原始大小請小於 20MB");
      return;
    }

    setIsUploading(true);

    // Dynamic import to use the new utility
    try {
      const { resizeImage } = await import('../utils/imageUtils');
      const compressedDataUrl = await resizeImage(file, 1920, 1080, 0.8);

      updateCoverImage(compressedDataUrl);
    } catch (err) {
      console.error("Image processing failed", err);
      alert("圖片處理失敗");
    } finally {
      // Small delay to simulate processing and let state update
      setTimeout(() => setIsUploading(false), 500);
    }

    e.target.value = ''; // Reset input
  };

  const handleResetCover = () => {
    updateCoverImage(undefined);
  };

  const handleRandomizeCover = async () => {
    if (!onUpdateTripMeta) return;

    // Expanded list of keywords for variety
    const keywords = ["landmark", "landscape", "street view", "aerial view", "architecture", "night view", "nature", "tourism", "skyline", "scenery", "historic", "culture", "daytime", "vacation", "panoramic", "travel", "sightseeing"];

    // 1. Pick a random keyword
    const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];

    // 2. Generate a random "page" index to get different results for same keyword
    // Bing thumbnail API often treats 'p' or offset in query nicely
    const randomPage = Math.floor(Math.random() * 10);

    const city = trip.input.destination.split(',')[0].trim();
    const timestamp = Date.now();
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

    try {
      const response = await fetch(`${apiBaseUrl}/cover?query=${encodeURIComponent(city + ' ' + randomKeyword)}&t=${timestamp}&p=${randomPage}`);
      if (!response.ok) throw new Error('Failed to fetch cover');
      const data = await response.json();
      if (data?.url) {
        updateCoverImage(data.url);
        return;
      }
    } catch (e) {
      console.warn('Cover lookup failed, falling back to Bing thumbnail', e);
    }

    const fallbackUrl = `https://th.bing.com/th?q=${encodeURIComponent(city + ' ' + randomKeyword)}&w=1920&h=1080&c=7&rs=1&p=${randomPage}&t=${timestamp}`;

    updateCoverImage(fallbackUrl);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden relative">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />

      {/* Feasibility Check Modal */}
      {feasibilityResult && (
        <FeasibilityModal
          isOpen={!!feasibilityResult}
          result={feasibilityResult}
          onCancel={handleFeasibilityCancel}
          onProceed={handleFeasibilityConfirmWithReshape}
        />
      )}

      {/* Global Loading Overlay for Explorer Update or Checking */}
      {(isUpdatingFromExplorer || aiProcessState !== 'idle') && (
        <div className="absolute inset-0 z-[70] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 flex flex-col items-center max-w-sm text-center">
            <div className="relative mb-4">
              <div className="w-16 h-16 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <MapIcon className="w-6 h-6 text-brand-600 animate-pulse" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {aiProcessState === 'planning' && (t('trip.ai_planning') || "AI 正在規劃行程...")}
              {aiProcessState === 'checking' && t('trip.checking_feasibility')}
              {aiProcessState === 'reshaping' && t('trip.reshaping')}
              {/* Fallback for simple explorer update if needed */}
              {isUpdatingFromExplorer && !['planning', 'checking', 'reshaping'].includes(aiProcessState) && t('trip.reshaping')}
            </h3>
            <p className="text-gray-500 text-sm">
              {aiProcessState === 'planning' && (t('trip.plan_desc') || "正在根據您的需求調整路線與景點...")}
              {aiProcessState === 'checking' && t('trip.check_desc')}
              {aiProcessState === 'reshaping' && t('trip.reshape_desc')}
              {isUpdatingFromExplorer && !['planning', 'checking', 'reshaping'].includes(aiProcessState) && t('trip.reshape_desc')}
            </p>
          </div>
        </div>
      )}

      {/* 1. Header (Sticky) */}
      <header className="bg-white border-b border-gray-200 h-16 flex-none z-50 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-900 font-medium text-sm flex items-center gap-1">
            ← {t('common.back')}
          </button>
          <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block"></div>
          <h1 className="text-lg font-bold text-gray-800 truncate max-w-md hidden md:block">
            {trip.title || trip.input.destination}
          </h1>
        </div>
        {!isSharedView && (
          <div className="flex items-center gap-3">
            {/* Visibility Toggle */}
            <VisibilityToggle
              visibility={trip.visibility || 'private'}
              isShared={!!trip.serverTripId}
              isSyncing={isSyncing}
              onVisibilityChange={handleVisibilityChange}
              onShareToggle={handleShareToggle}
              disabled={!trip.data}
            />

            {/* Sync to Cloud Button - Only show when already shared */}
            {trip.serverTripId && (
              <button
                onClick={handleSyncToCloud}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-600 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                title="同步最新變更到雲端"
              >
                {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">同步</span>
              </button>
            )}

            {/* Share Link Button - Only show when shared */}
            {trip.serverTripId && (
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors"
                title="取得分享連結"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">連結</span>
              </button>
            )}

            {/* Ready Status */}
            <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {t('trip.ready') || "Ready"}
            </div>
          </div>
        )}
      </header>

      {/* 2. Split Content Area */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Left Column: Itinerary (Scrollable) */}
        {/* Adjusted width logic based on isMapOpen state */}
        <div className={`flex flex-col scrollbar-hide bg-gray-50 overflow-y-auto transition-all duration-300 ease-in-out ${isMapOpen ? 'w-full lg:w-7/12 xl:w-1/2' : 'w-full'}`}>
          {/* Centered content class when map is closed */}

          {/* Header Image */}
          <div className="h-64 md:h-80 w-full relative shrink-0 group">
            <div className="absolute inset-0 bg-gray-900/30"></div>
            <img
              src={headerImageUrl}
              alt={trip.input.destination}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1280&q=80';
              }}
            />

            {/* Navigation & Actions */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10">
              {/* Back button is in the sticky header, but we can add one here for full screen feel if needed, or just keep actions */}
              <div></div>
              <div className="flex gap-2">
                {/* Share button removed as it is now in the main header */}
              </div>
            </div>

            {/* Edit Cover & Reset Button - Modern & Glassmorphism */}
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
              {/* Reset Button - Only show if custom image exists */}
              {trip.customCoverImage && (
                <button
                  onClick={handleResetCover}
                  className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 bg-black/20 hover:bg-red-500/80 text-white/90 hover:text-white rounded-full backdrop-blur-md border border-white/10 transition-all duration-300 shadow-sm"
                  title={t('trip_detail.cover.reset')}
                >
                  <span className="sr-only">重置</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              )}

              {/* Randomize Button */}
              <button
                onClick={handleRandomizeCover}
                className="group/random flex items-center justify-center w-8 h-8 md:w-9 md:h-9 bg-black/20 hover:bg-brand-500/80 text-white/90 hover:text-white rounded-full backdrop-blur-md border border-white/10 transition-all duration-300 shadow-sm"
                title={t('trip_detail.cover.random')}
              >
                <Shuffle className="w-4 h-4 group-hover/random:rotate-180 transition-transform duration-500" />
              </button>

              {/* Edit Button */}
              <button
                onClick={handleEditCoverClick}
                disabled={isUploading}
                className="group/btn flex items-center h-9 md:h-9 rounded-full bg-black/20 hover:bg-black/40 text-white/90 hover:text-white backdrop-blur-md border border-white/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm overflow-hidden"
              >
                {/* Icon Container - Fixed Square for perfect circle */}
                <div className="w-9 h-full flex items-center justify-center shrink-0">
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </div>

                {/* Text reveals on hover - Pushes parent width smoothly */}
                <span className={`text-xs font-medium whitespace-nowrap overflow-hidden transition-all duration-300 max-w-0 opacity-0
                  ${!isUploading && 'group-hover/btn:max-w-xs group-hover/btn:opacity-100 group-hover/btn:pr-3'}
                  ${isUploading && 'max-w-xs opacity-100 pr-3'}
                `}>
                  {isUploading ? t('trip_detail.cover.uploading') : t('trip_detail.cover.change')}
                </span>
              </button>
            </div>

            <div className="absolute bottom-6 left-6 text-white z-10 drop-shadow-md">
              <h1 className="text-4xl font-bold mb-1 tracking-tight">{tripMeta.title || trip.title || trip.input.destination}</h1>
              <div className="flex items-center gap-3 text-sm font-medium text-white/90">
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {tripMeta.dateRange || trip.input.dateRange}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {tripMeta.days || days.length} {t('trip.days')}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" /> {trip.input.budget || '~'}</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation (Main Sections) & Map Toggle - Full Width Background, Centered Content */}
          <div className="bg-white border-b border-gray-200 sticky top-0 z-40 flex-none shadow-sm">
            <div className="px-6 flex justify-between items-end w-full max-w-5xl mx-auto">
              <div className="flex space-x-6">
                <button
                  onClick={() => setActiveTab('itinerary')}
                  className={`pt-4 pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'itinerary' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {t('trip_detail.tabs.itinerary')}
                </button>
                <button
                  onClick={() => setActiveTab('budget')}
                  className={`pt-4 pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'budget' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {t('trip_detail.tabs.budget')}
                </button>
                <button
                  onClick={() => setActiveTab('risks')}
                  className={`pt-4 pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'risks' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {t('trip_detail.tabs.risks')}
                </button>
              </div>

              {/* Map Toggle Button - Placed here for better coordination */}
              <div className="hidden lg:flex items-center h-full py-3">
                <button
                  onClick={() => setIsMapOpen(!isMapOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isMapOpen
                    ? 'bg-brand-50 text-brand-600 border-brand-200 shadow-inner'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700'
                    }`}
                  title={isMapOpen ? t('trip_detail.map.hide') : t('trip_detail.map.show')}
                >
                  {isMapOpen ? <PanelRightClose className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                  {isMapOpen ? '隱藏地圖' : '顯示地圖'}
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 bg-gray-50">

            {/* 1. Itinerary View */}
            {activeTab === 'itinerary' && (
              <>
                {/* DaySelector - Full Width Background, Centered Content, Sticky */}
                <div className="bg-white border-b border-gray-100 sticky top-[48px] z-30">
                  <div className="w-full max-w-5xl mx-auto">
                    <DaySelector
                      days={days}
                      selectedDay={selectedDay}
                      onSelectDay={setSelectedDay}
                    />
                  </div>
                </div>

                {/* ItineraryTimeline - Centered Content */}
                <div className="p-6 pb-24 w-full max-w-5xl mx-auto">
                  <ItineraryTimeline
                    dayData={currentDayData}
                    onFocusStop={handleFocusStop}
                    onExplore={() => setIsExplorerOpen(true)}
                  />
                </div>
              </>
            )}

            {/* 2. Budget View */}
            {activeTab === 'budget' && (
              <div className="w-full max-w-5xl mx-auto">
                <BudgetView tripMeta={tripMeta} days={days} />
              </div>
            )}

            {/* 3. Risks View */}
            {activeTab === 'risks' && (
              <div className="p-6 w-full max-w-5xl mx-auto">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertTriangle className="text-orange-500" /> {t('trip.risks_title')}
                  </h3>
                  <ul className="space-y-3">
                    {risks.map((risk, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm text-gray-700 bg-orange-50 p-4 rounded-lg border border-orange-100">
                        <span className="w-2 h-2 bg-orange-400 rounded-full mt-1.5 flex-shrink-0"></span>
                        <span className="leading-relaxed">{safeRender(risk)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Right Column: Sticky Map (Hidden on mobile) */}
        {/* Added dynamic width classes. Button is now handled inside TripMap */}
        <div
          className={`hidden lg:block relative transition-all duration-300 ease-in-out ${isMapOpen ? 'lg:w-5/12 xl:w-1/2 opacity-100' : 'w-0 opacity-0 overflow-hidden'
            }`}
        >
          <TripMap
            mapState={mapState}
            selectedDay={selectedDay}
            currentDayData={currentDayData}
            onResetMap={handleResetMap}
            onFocusStop={handleFocusStop}
          />
        </div>

      </div>

      {/* Assistant is fixed to bottom right, adjusted z-index to be above map */}
      <Assistant onUpdate={handleAiUpdate} isGenerating={false} />

      {/* Attraction Explorer Modal */}
      <AttractionExplorer
        isOpen={isExplorerOpen}
        onClose={() => setIsExplorerOpen(false)}
        initialLocation={trip.input.destination}
        initialInterests={trip.input.interests}
        currentStops={currentDayData?.stops || []}
        onConfirm={handleExplorerConfirm}
        mode="modification"
      />

      {/* Share Trip Modal */}
      <ShareTripModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        trip={trip}
        onVisibilityChange={(v) => onUpdateTripMeta?.({ visibility: v })}
      />
    </div>
  );
}
