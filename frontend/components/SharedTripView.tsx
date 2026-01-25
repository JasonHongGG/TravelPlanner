import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Loader2, Lock, Calendar, Clock, DollarSign, Eye, AlertTriangle, Globe, Map as MapIcon, PanelRightClose, Edit3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SharedTrip, TripMeta, TripStop, TripData, Trip } from '../types';
import { tripShareService } from '../services/TripShareService';
import { getTripCover } from '../utils/tripUtils';
import { safeRender } from '../utils/formatters';
import { getDayMapConfig } from '../utils/mapHelpers';
import { useAuth } from '../context/AuthContext';

// Sub-components (reuse from TripDetail)
import DaySelector from './trip/DaySelector';
import ItineraryTimeline from './trip/ItineraryTimeline';
import BudgetView from './trip/BudgetView';
import TripMap from './trip/TripMap';
import TripDetail from './TripDetail'; // Reuse full editor

interface SharedTripViewProps {
    tripId: string;
    onBack: () => void;
}

type ViewState = 'loading' | 'success' | 'error' | 'no-permission';

export default function SharedTripView({ tripId, onBack }: SharedTripViewProps) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [viewState, setViewState] = useState<ViewState>('loading');
    const [sharedTrip, setSharedTrip] = useState<SharedTrip | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');

    // Store latest permission in ref for SSE to check against without re-subscribing
    const currentPermissionRef = useRef<string | undefined>(undefined);

    // Mode State
    const [isEditMode, setIsEditMode] = useState(false);

    // UI State for Read-Only View
    const [selectedDay, setSelectedDay] = useState(1);
    const [activeTab, setActiveTab] = useState<'itinerary' | 'budget' | 'risks'>('itinerary');
    const [isMapOpen, setIsMapOpen] = useState(true);
    const [mapState, setMapState] = useState<{ url: string; label: string }>({ url: '', label: '' });

    useEffect(() => {
        loadTrip();

        // Setup SSE
        const eventSource = tripShareService.subscribeToTrip(tripId, handleServerEvent);

        return () => {
            eventSource.close();
        };
    }, [tripId]);

    // Sync state to ref
    useEffect(() => {
        if (sharedTrip) {
            currentPermissionRef.current = sharedTrip.userPermission;
        }
    }, [sharedTrip]);

    // Handle incoming server events (Real-time updates)
    const handleServerEvent = (type: string, data: any) => {
        // console.log('[SharedTripView] Received event:', type, data);

        if (type === 'trip_updated') {
            // Check timestamp to avoid overwriting local optimistic updates if we were the one saving?
            // For simplicity, we re-fetch to get latest state from server (Single Source of Truth)
            // Or if data contains the full trip, update directly. The backend currently sends minimal data.
            loadTrip();
        } else if (type === 'visibility_updated') {
            loadTrip();
        } else if (type === 'permissions_updated') {
            // Smart Update: Only refresh if MY permission actually changed
            if (data.permissions && user?.email) {
                const myEmail = user.email.toLowerCase();
                // Look up using lowercased email since keys are normalized
                const newPermission = data.permissions[myEmail] || undefined;
                const oldPermission = currentPermissionRef.current;

                // If permission is unchanged, skip reload
                if (newPermission === oldPermission) {
                    return;
                }

                // Alert if downgraded from write to read
                if (oldPermission === 'write' && newPermission !== 'write') {
                    alert('您的編輯權限已被更改為僅查看');
                }
            }
            loadTrip();
        } else if (type === 'trip_deleted') {
            setViewState('error');
            setErrorMessage('此行程已被擁有者刪除');
        }
    };

    // Update map when day changes
    useEffect(() => {
        if (sharedTrip?.tripData?.data) {
            const days = sharedTrip.tripData.data.days || [];
            const day = days.find(d => d.day === selectedDay);
            const destination = sharedTrip.tripData.input?.destination || '';
            const config = getDayMapConfig(day, destination);
            setMapState(config);
        }
    }, [selectedDay, sharedTrip]);

    const loadTrip = async () => {
        if (!sharedTrip) setViewState('loading'); // Only show loading on initial load
        try {
            const trip = await tripShareService.getTrip(tripId);
            setSharedTrip(trip);
            setViewState('success');

            // If permission revoked while editing, exit edit mode
            if (isEditMode && trip.userPermission !== 'write') {
                setIsEditMode(false);
                alert('您的編輯權限已被移除');
            }
        } catch (error: any) {
            console.error('[SharedTripView] Failed to load trip:', error);
            if (error.message?.includes('access denied') || error.message?.includes('not found')) {
                setViewState('no-permission');
                setErrorMessage('您沒有權限查看此行程，或此行程不存在。');
            } else {
                setViewState('error');
                setErrorMessage(error.message || '載入行程時發生錯誤');
            }
        }
    };

    const handleResetMap = () => {
        if (sharedTrip?.tripData?.data) {
            const days = sharedTrip.tripData.data.days || [];
            const day = days.find(d => d.day === selectedDay);
            const destination = sharedTrip.tripData.input?.destination || '';
            const config = getDayMapConfig(day, destination);
            setMapState(config);
        }
    };

    const handleFocusStop = (stop: TripStop) => {
        const city = sharedTrip?.tripData?.input?.destination || '';
        const query = `${stop.name}, ${city}`;
        setMapState({
            url: `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=16&ie=UTF8&iwloc=&output=embed`,
            label: `📍 ${stop.name}`
        });
        if (!isMapOpen) {
            setIsMapOpen(true);
        }
    };

    // Handler for saving changes in Edit Mode
    const handleUpdateTrip = async (id: string, newData: TripData) => {
        if (!sharedTrip) return;

        // Optimistic update
        const updatedTrip = { ...sharedTrip.tripData, data: newData };
        const newSharedTrip = { ...sharedTrip, tripData: updatedTrip };
        setSharedTrip(newSharedTrip as SharedTrip);

        // Note: We do NOT call saveTrip here because TripDetail handles auto-sync internally via saveTripToCloud.
        // We only update the local state to keep the UI responsive.
    };

    const handleUpdateTripMeta = async (updates: Partial<Trip>) => {
        if (!sharedTrip) return;

        // Optimistic update
        const updatedTrip = { ...sharedTrip.tripData, ...updates };
        const newSharedTrip = { ...sharedTrip, tripData: updatedTrip };
        setSharedTrip(newSharedTrip as SharedTrip);

        // Note: TripDetail handles the saving.
    };

    // Loading State
    if (viewState === 'loading') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
                <div className="relative mb-4">
                    <div className="w-16 h-16 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
                </div>
                <p className="text-gray-500">載入行程中...</p>
            </div>
        );
    }

    // No Permission State (Refined Full Page)
    if (viewState === 'no-permission') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white text-center px-6">

                {/* Visual Icon Group */}
                <div className="relative mb-10 animate-in fade-in zoom-in-50 duration-700">
                    <div className="absolute inset-0 bg-gray-200/50 blur-3xl rounded-full scale-150 transform translate-y-4" />
                    <div className="relative bg-white w-28 h-28 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex items-center justify-center border border-gray-100 rotate-3 transition-transform hover:rotate-0 duration-500">
                        <Lock className="w-12 h-12 text-gray-900" strokeWidth={1.5} />
                    </div>
                </div>

                <div className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                    <h2 className="text-4xl font-bold text-gray-900 tracking-tight">
                        無需擔憂，此為私人行程
                    </h2>

                    <p className="text-lg text-gray-500 leading-relaxed">
                        您目前嘗試存取的行程設定為<span className="font-semibold text-gray-900 mx-1">私人模式</span>，<br className="hidden md:block" />
                        或者是分享連結已經過期失效。
                    </p>

                    <div className="pt-8 flex justify-center">
                        <button
                            onClick={onBack}
                            className="group flex items-center gap-2 px-8 py-3.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-black hover:-translate-y-0.5 transition-all duration-200 shadow-lg shadow-gray-200"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            <span>返回首頁探索</span>
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

    // Error State
    if (viewState === 'error') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
                <div className="bg-red-100 p-4 rounded-full mb-4">
                    <AlertTriangle className="w-12 h-12 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">載入失敗</h2>
                <p className="text-gray-600 max-w-md mb-8">{errorMessage}</p>
                <div className="flex gap-3">
                    <button onClick={loadTrip} className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors">重試</button>
                    <button onClick={onBack} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">返回首頁</button>
                </div>
            </div>
        );
    }

    // Success State - Display Trip
    if (!sharedTrip || !sharedTrip.tripData?.data) {
        return null;
    }

    // Success State - Display Trip
    if (!sharedTrip || !sharedTrip.tripData?.data) {
        return null;
    }

    // Direct Edit Mode: If user has write permission, render editor immediately
    if (sharedTrip.userPermission === 'write') {
        return (
            <TripDetail
                trip={sharedTrip.tripData}
                onBack={onBack}
                onUpdateTrip={handleUpdateTrip}
                onUpdateTripMeta={handleUpdateTripMeta}
                isSharedView={true}
            />
        );
    }

    const trip = sharedTrip.tripData;
    const tripData = trip.data!;
    const tripMeta = tripData.tripMeta || {} as TripMeta;
    const days = tripData.days || [];
    const risks = tripData.risks || [];
    const currentDayData = days.find(d => d.day === selectedDay);
    const headerImageUrl = getTripCover(trip);

    // 內容置中的 class（常駐以確保動畫平滑）
    const centeredContentClass = 'w-full max-w-5xl mx-auto';

    return (
        <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 h-16 flex-none z-50 flex items-center justify-between px-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-gray-500 hover:text-gray-900 font-medium text-sm flex items-center gap-1">
                        ← 返回
                    </button>
                    <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block" />
                    <h1 className="text-lg font-bold text-gray-800 truncate max-w-md hidden md:block">
                        {tripMeta.title || trip.title || trip.input?.destination}
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        {sharedTrip.visibility === 'public' ? (
                            <Globe className="w-3 h-3" />
                        ) : (
                            <Lock className="w-3 h-3" />
                        )}
                        <span className="hidden sm:inline">
                            {sharedTrip.visibility === 'public' ? '公開' : '私人'}
                        </span>
                    </div>
                </div>
            </header>

            {/* Split Content Area */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* Left Column: Itinerary (Scrollable) */}
                <div className={`flex flex-col scrollbar-hide bg-gray-50 overflow-y-auto transition-all duration-300 ease-in-out ${isMapOpen ? 'w-full lg:w-7/12 xl:w-1/2' : 'w-full'}`}>
                    {/* Header Image - Full Width */}
                    <div className="h-64 md:h-80 w-full relative shrink-0">
                        <div className="absolute inset-0 bg-gray-900/30" />
                        <img
                            src={headerImageUrl}
                            alt={trip.input?.destination || ''}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.currentTarget.src = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1280&q=80';
                            }}
                        />
                        <div className="absolute bottom-6 left-6 text-white z-10 drop-shadow-md">
                            <h1 className="text-4xl font-bold mb-1 tracking-tight">{tripMeta.title || trip.title || trip.input?.destination}</h1>
                            <div className="flex items-center gap-3 text-sm font-medium text-white/90">
                                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {tripMeta.dateRange || trip.input?.dateRange}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {tripMeta.days || days.length} 天</span>
                                <span>•</span>
                                <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" /> {trip.input?.budget || '~'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation & Map Toggle - Full Width Background, Centered Content */}
                    <div className="bg-white border-b border-gray-200 sticky top-0 z-40 flex-none shadow-sm">
                        <div className={`px-6 flex justify-between items-end ${centeredContentClass}`}>
                            <div className="flex space-x-6">
                                <button
                                    onClick={() => setActiveTab('itinerary')}
                                    className={`pt-4 pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'itinerary' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    行程
                                </button>
                                <button
                                    onClick={() => setActiveTab('budget')}
                                    className={`pt-4 pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'budget' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    預算
                                </button>
                                <button
                                    onClick={() => setActiveTab('risks')}
                                    className={`pt-4 pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'risks' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    風險
                                </button>
                            </div>

                            {/* Map Toggle Button */}
                            <div className="hidden lg:flex items-center h-full py-3">
                                <button
                                    onClick={() => setIsMapOpen(!isMapOpen)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isMapOpen
                                        ? 'bg-brand-50 text-brand-600 border-brand-200 shadow-inner'
                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700'
                                        }`}
                                >
                                    {isMapOpen ? <PanelRightClose className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                                    {isMapOpen ? '隱藏地圖' : '顯示地圖'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 bg-gray-50">
                        {activeTab === 'itinerary' && (
                            <>
                                {/* DaySelector - Full Width Background, Centered Content, Sticky */}
                                <div className="bg-white border-b border-gray-100 sticky top-[48px] z-30">
                                    <div className={centeredContentClass}>
                                        <DaySelector days={days} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
                                    </div>
                                </div>
                                {/* Itinerary Timeline - Centered Content */}
                                <div className={`p-6 pb-24 ${centeredContentClass}`}>
                                    <ItineraryTimeline
                                        dayData={currentDayData}
                                        onFocusStop={handleFocusStop}
                                    />
                                </div>
                            </>
                        )}

                        {activeTab === 'budget' && (
                            <div className={centeredContentClass}>
                                <BudgetView tripMeta={tripMeta} days={days} />
                            </div>
                        )}

                        {activeTab === 'risks' && (
                            <div className={`p-6 ${centeredContentClass}`}>
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <AlertTriangle className="text-orange-500" /> 風險提醒
                                    </h3>
                                    {risks.length === 0 ? (
                                        <p className="text-gray-500 text-sm">此行程沒有特別的風險提醒。</p>
                                    ) : (
                                        <ul className="space-y-3">
                                            {risks.map((risk, idx) => (
                                                <li key={idx} className="flex items-start gap-3 text-sm text-gray-700 bg-orange-50 p-4 rounded-lg border border-orange-100">
                                                    <span className="w-2 h-2 bg-orange-400 rounded-full mt-1.5 flex-shrink-0" />
                                                    <span className="leading-relaxed">{safeRender(risk)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Sticky Map (Hidden on mobile) */}
                <div className={`hidden lg:block relative transition-all duration-300 ease-in-out ${isMapOpen ? 'lg:w-5/12 xl:w-1/2 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
                    <TripMap
                        mapState={mapState}
                        selectedDay={selectedDay}
                        currentDayData={currentDayData}
                        onResetMap={handleResetMap}
                        onFocusStop={handleFocusStop}
                    />
                </div>
            </div>
        </div>
    );
}
