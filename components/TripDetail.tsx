
import React, { useState, useEffect, useRef } from 'react';
import { Trip, TripData, TripMeta, TripStop, Message, FeasibilityResult } from '../types';
import { CheckCircle2, AlertTriangle, Calendar, Clock, DollarSign, PanelRightClose, PanelRightOpen, Map as MapIcon, Loader2, Camera, ImagePlus } from 'lucide-react';
import Assistant from './Assistant';
import { aiService } from '../services'; // Import singleton service
import { safeRender } from '../utils/formatters';
import { getDayMapConfig } from '../utils/mapHelpers';
import { getTripCover } from '../utils/tripUtils';
import { constructExplorerUpdatePrompt } from '../config/aiConfig';

// Sub-components
import DaySelector from './trip/DaySelector';
import ItineraryTimeline from './trip/ItineraryTimeline';
import BudgetView from './trip/BudgetView';
import TripMap from './trip/TripMap';
import AttractionExplorer from './AttractionExplorer';
import FeasibilityModal from './FeasibilityModal';

interface Props {
  trip: Trip;
  onBack: () => void;
  onBack: () => void;
  onUpdateTrip: (tripId: string, newData: TripData) => void;
  onUpdateTripMeta?: (updates: Partial<Trip>) => void; // Optional for backward compatibility, but passed from App
}

export default function TripDetail({ trip, onBack, onUpdateTrip, onUpdateTripMeta }: Props) {
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'itinerary' | 'budget' | 'risks'>('itinerary');
  const [isMapOpen, setIsMapOpen] = useState(true); // State to toggle map visibility
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attraction Explorer State
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [isUpdatingFromExplorer, setIsUpdatingFromExplorer] = useState(false);

  // Feasibility Check State
  const [isCheckingFeasibility, setIsCheckingFeasibility] = useState(false);
  const [feasibilityResult, setFeasibilityResult] = useState<FeasibilityResult | null>(null);

  // Pending Actions/Data
  // pendingUpdateAction: 用於 Explorer (尚未生成，等待執行生成函數)
  const [pendingUpdateAction, setPendingUpdateAction] = useState<(() => Promise<void>) | null>(null);
  // pendingNewData: 用於 Chat (已生成資料，等待確認寫入)
  const [pendingNewData, setPendingNewData] = useState<TripData | null>(null);

  // State for Map URL and Label
  const [mapState, setMapState] = useState<{ url: string; label: string }>({
    url: '',
    label: ''
  });

  // Effect: Update map when day changes
  useEffect(() => {
    const day = trip.data?.days.find(d => d.day === selectedDay);
    const config = getDayMapConfig(day, trip.input.destination);
    setMapState(config);
  }, [selectedDay, trip.data, trip.input.destination]);

  // Handler: Reset Map to Full Route
  const handleResetMap = () => {
    const day = trip.data?.days.find(d => d.day === selectedDay);
    const config = getDayMapConfig(day, trip.input.destination);
    setMapState(config);
  };

  // Handler: Focus on a specific stop
  const handleFocusStop = (stop: TripStop) => {
    const city = trip.input.destination;
    const query = `${stop.name}, ${city}`;
    setMapState({
      url: `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=16&ie=UTF8&iwloc=&output=embed`,
      label: `📍 ${stop.name}`
    });
    // If map is closed when focusing, open it
    if (!isMapOpen) {
      setIsMapOpen(true);
    }
  };

  // Helper to execute check (Used by Explorer)
  const performFeasibilityCheck = async (context: string, executeIfSafe: () => Promise<void>) => {
    if (!trip.data) return;

    setIsCheckingFeasibility(true);
    try {
      // For Explorer, we check against the CURRENT data because the new data doesn't exist yet
      const result = await aiService.checkFeasibility(trip.data, context);

      // CRITICAL: Turn off feasibility loading state BEFORE executing the update.
      // Otherwise "Evaluating..." overrides "Reshaping..." in the UI because both flags would be true.
      setIsCheckingFeasibility(false);

      if (!result.feasible || result.riskLevel === 'high' || result.riskLevel === 'moderate') {
        setFeasibilityResult(result);
        setPendingUpdateAction(() => executeIfSafe);
      } else {
        // Safe enough, proceed directly
        await executeIfSafe();
      }
    } catch (e) {
      console.error("Check failed", e);
      setIsCheckingFeasibility(false);
      await executeIfSafe();
    }
  };

  const handleFeasibilityConfirm = async () => {
    // Case 1: Explorer (Action waiting to be executed)
    if (pendingUpdateAction) {
      await pendingUpdateAction();
    }

    // Case 2: Chat (Data waiting to be applied)
    if (pendingNewData) {
      onUpdateTrip(trip.id, pendingNewData);
    }

    setFeasibilityResult(null);
    setPendingUpdateAction(null);
    setPendingNewData(null);
  };

  const handleFeasibilityCancel = () => {
    setFeasibilityResult(null);
    setPendingUpdateAction(null);
    setPendingNewData(null);
    setIsUpdatingFromExplorer(false); // Ensure loading overlay is cleared
  };


  // AI Update Handler (Used by Assistant)
  // Modified Logic: Generate First -> Check Data -> Apply
  const handleAiUpdate = async (history: Message[], onThought: (text: string) => void): Promise<string> => {
    if (!trip.data) return "";

    // 1. 先讓 AI 處理對話與生成 (無論是聊天還是修改)
    const result = await aiService.updateTrip(trip.data!, history, onThought);

    // 2. 如果結果中沒有 updatedData，表示 AI 認為這只是一般對話，不需要檢查可行性
    if (!result.updatedData) {
      return result.responseText;
    }

    // 3. 如果有 updatedData，表示行程被修改了，這時候才進行檢查
    // 注意：我們檢查的是 result.updatedData (新行程)，看看新行程是否合理
    setIsCheckingFeasibility(true);
    try {
      const lastMsg = history[history.length - 1].text;
      const checkResult = await aiService.checkFeasibility(
        result.updatedData, // Check the PROPOSED itinerary
        `User Chat Request: ${lastMsg}`
      );

      // Check finished
      setIsCheckingFeasibility(false);

      if (!checkResult.feasible || checkResult.riskLevel === 'high') {
        // 4a. 風險高 -> 顯示 Modal，暫存數據 (pendingNewData)
        setFeasibilityResult(checkResult);
        setPendingNewData(result.updatedData);

        // 我們仍回傳 AI 的文字回應，讓對話框顯示「好的，我已為您安排...」
        // 但實際上 UI 尚未更新，直到用戶在 Modal 點擊確認
        return result.responseText;
      }
    } catch (e) {
      console.warn("Feasibility check failed, proceeding anyway", e);
      setIsCheckingFeasibility(false);
    }

    // 4b. 風險低或檢查通過 -> 直接更新
    onUpdateTrip(trip.id, result.updatedData);
    return result.responseText;
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
        const prompt = constructExplorerUpdatePrompt(
          selectedDay,
          newMustVisit,
          newAvoid,
          keepExisting,
          removeExisting
        );

        const syntheticHistory: Message[] = [
          { role: 'user', text: prompt, timestamp: Date.now() }
        ];

        const result = await aiService.updateTrip(
          trip.data!,
          syntheticHistory,
          (thought) => {
            console.log("AI Thinking:", thought);
          }
        );

        if (result.updatedData) {
          onUpdateTrip(trip.id, result.updatedData);
        }
      } catch (e) {
        console.error("Failed to update trip from explorer", e);
        alert("更新行程時發生錯誤，請稍後再試。");
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
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 px-4 text-center">
        <div className="bg-red-100 p-4 rounded-full mb-4">
          <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">行程生成失敗</h2>
        <p className="text-gray-600 max-w-md mb-8">
          {trip.errorMsg || "無法為您生成行程，請稍後再試。"}
        </p>
        <button onClick={onBack} className="px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700">
          返回主控台
        </button>
      </div>
    );
  }

  // Loading State
  if (!trip.data) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-500 mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-700">正在為您規劃夢想旅程...</h2>
        <button onClick={onBack} className="mt-8 text-brand-600 hover:underline">取消</button>
      </div>
    );
  }

  const tripMeta = trip.data.tripMeta || ({} as TripMeta);
  const days = trip.data.days || [];
  const risks = trip.data.risks || [];
  const currentDayData = days.find(d => d.day === selectedDay);

  // Construct a relevant image URL using Pollinations AI (Switched to Bing for variety)
  const headerImageUrl = getTripCover(trip);

  const handleEditCoverClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert("圖片大小請小於 2MB");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result && onUpdateTripMeta) {
        onUpdateTripMeta({ customCoverImage: result });
        // Small delay to simulate processing and let state update
        setTimeout(() => setIsUploading(false), 500);
      } else {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const handleResetCover = () => {
    if (onUpdateTripMeta) {
      onUpdateTripMeta({ customCoverImage: undefined });
    }
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
          onProceed={handleFeasibilityConfirm}
        />
      )}

      {/* Global Loading Overlay for Explorer Update or Checking */}
      {(isUpdatingFromExplorer || isCheckingFeasibility) && (
        <div className="absolute inset-0 z-[70] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 flex flex-col items-center max-w-sm text-center">
            <div className="relative mb-4">
              <div className="w-16 h-16 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <MapIcon className="w-6 h-6 text-brand-600 animate-pulse" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {isCheckingFeasibility ? "正在評估行程可行性" : "正在為您重塑行程"}
            </h3>
            <p className="text-gray-500 text-sm">
              {isCheckingFeasibility
                ? "AI 正在檢查路線順暢度與時間安排..."
                : "AI 正在根據您選擇的景點，重新計算最佳路線與時間安排..."
              }
            </p>
          </div>
        </div>
      )}

      {/* 1. Header (Sticky) */}
      <header className="bg-white border-b border-gray-200 h-16 flex-none z-50 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-900 font-medium text-sm flex items-center gap-1">
            ← 返回
          </button>
          <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block"></div>
          <h1 className="text-lg font-bold text-gray-800 truncate max-w-md hidden md:block">
            {trip.title || trip.input.destination}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 準備就緒
          </div>
        </div>
      </header>

      {/* 2. Split Content Area */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Left Column: Itinerary (Scrollable) */}
        {/* Adjusted width logic based on isMapOpen state */}
        <div className={`w-full flex flex-col scrollbar-hide bg-gray-50 overflow-y-auto transition-all duration-300 ease-in-out ${isMapOpen ? 'lg:w-7/12 xl:w-1/2' : 'lg:w-full'}`}>

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
                <button className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all">
                  <span className="sr-only">分享</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                </button>
              </div>
            </div>

            {/* Edit Cover & Reset Button - Modern & Glassmorphism */}
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
              {/* Reset Button - Only show if custom image exists */}
              {trip.customCoverImage && (
                <button
                  onClick={handleResetCover}
                  className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 bg-black/20 hover:bg-red-500/80 text-white/90 hover:text-white rounded-full backdrop-blur-md border border-white/10 transition-all duration-300 shadow-sm"
                  title="恢復預設封面"
                >
                  <span className="sr-only">重置</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              )}

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
                  {isUploading ? '上傳中...' : '更換封面'}
                </span>
              </button>
            </div>

            <div className="absolute bottom-6 left-6 text-white z-10 drop-shadow-md">
              <h1 className="text-4xl font-bold mb-1 tracking-tight">{tripMeta.title || trip.title || trip.input.destination}</h1>
              <div className="flex items-center gap-3 text-sm font-medium text-white/90">
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {tripMeta.dateRange || trip.input.dateRange}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {tripMeta.days || days.length} 天</span>
                <span>•</span>
                <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" /> {trip.input.budget || '~'}</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation (Main Sections) & Map Toggle */}
          <div className="bg-white border-b border-gray-200 sticky top-0 z-40 px-6 pt-4 flex-none shadow-sm flex justify-between items-center">
            <div className="flex space-x-6">
              <button
                onClick={() => setActiveTab('itinerary')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'itinerary' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                行程表
              </button>
              <button
                onClick={() => setActiveTab('budget')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'budget' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                預算預估
              </button>
              <button
                onClick={() => setActiveTab('risks')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'risks' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                風險提示
              </button>
            </div>

            {/* Map Toggle Button - Placed here for better coordination */}
            <div className="hidden lg:block pb-2">
              <button
                onClick={() => setIsMapOpen(!isMapOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isMapOpen
                  ? 'bg-brand-50 text-brand-600 border-brand-200 shadow-inner'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                title={isMapOpen ? "隱藏地圖" : "顯示地圖"}
              >
                {isMapOpen ? <PanelRightClose className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                {isMapOpen ? "收起地圖" : "地圖模式"}
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 bg-gray-50">

            {/* 1. Itinerary View */}
            {activeTab === 'itinerary' && (
              <>
                <DaySelector
                  days={days}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                />

                <div className="p-6 pb-24">
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
              <BudgetView tripMeta={tripMeta} days={days} />
            )}

            {/* 3. Risks View */}
            {activeTab === 'risks' && (
              <div className="p-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertTriangle className="text-orange-500" /> 潛在風險與建議
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
    </div>
  );
}
