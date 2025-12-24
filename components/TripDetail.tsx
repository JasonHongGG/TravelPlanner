import React, { useState, useEffect } from 'react';
import { Trip, TripData, TripMeta, TripStop, Message } from '../types';
import { CheckCircle2, AlertTriangle, Calendar, Clock, DollarSign, PanelRightClose, PanelRightOpen, Map as MapIcon, Loader2 } from 'lucide-react';
import Assistant from './Assistant';
import { updateTripItinerary } from '../services/geminiService';
import { safeRender } from '../utils/formatters';
import { getDayMapConfig } from '../utils/mapHelpers';
import { constructExplorerUpdatePrompt } from '../config/aiConfig';

// Sub-components
import DaySelector from './trip/DaySelector';
import ItineraryTimeline from './trip/ItineraryTimeline';
import BudgetView from './trip/BudgetView';
import TripMap from './trip/TripMap';
import AttractionExplorer from './AttractionExplorer';

interface Props {
  trip: Trip;
  onBack: () => void;
  onUpdateTrip: (tripId: string, newData: TripData) => void;
}

export default function TripDetail({ trip, onBack, onUpdateTrip }: Props) {
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'itinerary' | 'budget' | 'risks'>('itinerary');
  const [isMapOpen, setIsMapOpen] = useState(true); // State to toggle map visibility
  
  // Attraction Explorer State
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [isUpdatingFromExplorer, setIsUpdatingFromExplorer] = useState(false);

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

  // AI Update Handler (Used by Assistant)
  const handleAiUpdate = async (history: Message[], onThought: (text: string) => void): Promise<string> => {
    if (!trip.data) return "";
    try {
      const result = await updateTripItinerary(trip.data, history, onThought);
      if (result.updatedData) {
        onUpdateTrip(trip.id, result.updatedData);
      }
      return result.responseText;
    } catch (e) {
      console.error("Failed to update trip via AI", e);
      throw e; 
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
    
    setIsUpdatingFromExplorer(true);
    
    try {
        // Use the new centralized prompt constructor
        const prompt = constructExplorerUpdatePrompt(
            selectedDay,
            newMustVisit,
            newAvoid,
            keepExisting,
            removeExisting
        );

        // We construct a synthetic history to instruct the update logic
        // This bypasses the Assistant UI history but uses the same service logic
        const syntheticHistory: Message[] = [
            { role: 'user', text: prompt, timestamp: Date.now() }
        ];

        const result = await updateTripItinerary(
            trip.data, 
            syntheticHistory, 
            (thought) => { 
                // We could show a toast or status here with the thought
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

  // Construct a relevant image URL using Pollinations AI
  const city = trip.input.destination.split(',')[0].trim();
  const headerImageUrl = `https://image.pollinations.ai/prompt/cinematic%20wide%20shot%20of%20${encodeURIComponent(city)}%20landmark%20scenery%20travel%20photography?width=1280&height=720&nologo=true&seed=${trip.id}`;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden relative">
      
      {/* Global Loading Overlay for Explorer Update */}
      {isUpdatingFromExplorer && (
        <div className="absolute inset-0 z-[70] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 flex flex-col items-center max-w-sm text-center">
                <div className="relative mb-4">
                   <div className="w-16 h-16 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                      <MapIcon className="w-6 h-6 text-brand-600 animate-pulse" />
                   </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">正在為您重塑行程</h3>
                <p className="text-gray-500 text-sm">AI 正在根據您選擇的景點，重新計算最佳路線與時間安排...</p>
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
          
          {/* Hero / Cover Section */}
          <div className="relative h-64 flex-shrink-0 w-full bg-gray-900 group">
            <img 
              src={headerImageUrl}
              onError={(e) => {
                 e.currentTarget.src = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=2000&q=80';
              }}
              alt={`Travel to ${trip.input.destination}`} 
              className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8">
              <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3 shadow-sm leading-tight">{trip.input.destination}</h1>
              <div className="flex flex-wrap items-center gap-4 text-white/90 text-sm font-medium">
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {safeRender(tripMeta.dateRange)}</span>
                <span className="w-1 h-1 bg-white/50 rounded-full"></span>
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {safeRender(tripMeta.days)} 天</span>
                <span className="w-1 h-1 bg-white/50 rounded-full"></span>
                <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> {safeRender(tripMeta.budgetEstimate?.total ? `~${tripMeta.budgetEstimate.total}` : trip.input.budget)}</span>
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
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    isMapOpen 
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
          className={`hidden lg:block relative transition-all duration-300 ease-in-out ${
            isMapOpen ? 'lg:w-5/12 xl:w-1/2 opacity-100' : 'w-0 opacity-0 overflow-hidden'
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