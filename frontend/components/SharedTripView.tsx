import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Lock, Calendar, Clock, DollarSign, Eye, AlertTriangle, Globe, Map as MapIcon, PanelRightClose } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SharedTrip, TripMeta, TripStop } from '../types';
import { tripShareService } from '../services/TripShareService';
import { getTripCover } from '../utils/tripUtils';
import { safeRender } from '../utils/formatters';
import { getDayMapConfig } from '../utils/mapHelpers';

// Sub-components (reuse from TripDetail)
import DaySelector from './trip/DaySelector';
import ItineraryTimeline from './trip/ItineraryTimeline';
import BudgetView from './trip/BudgetView';
import TripMap from './trip/TripMap';

interface SharedTripViewProps {
    tripId: string;
    onBack: () => void;
}

type ViewState = 'loading' | 'success' | 'error' | 'no-permission';

export default function SharedTripView({ tripId, onBack }: SharedTripViewProps) {
    const { t } = useTranslation();
    const [viewState, setViewState] = useState<ViewState>('loading');
    const [sharedTrip, setSharedTrip] = useState<SharedTrip | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');

    // UI State
    const [selectedDay, setSelectedDay] = useState(1);
    const [activeTab, setActiveTab] = useState<'itinerary' | 'budget' | 'risks'>('itinerary');
    const [isMapOpen, setIsMapOpen] = useState(true);
    const [mapState, setMapState] = useState<{ url: string; label: string }>({ url: '', label: '' });

    useEffect(() => {
        loadTrip();
    }, [tripId]);

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
        setViewState('loading');
        try {
            const trip = await tripShareService.getTrip(tripId);
            setSharedTrip(trip);
            setViewState('success');
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

    // No Permission State
    if (viewState === 'no-permission') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
                <div className="bg-amber-100 p-4 rounded-full mb-4">
                    <Lock className="w-12 h-12 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">無法存取此行程</h2>
                <p className="text-gray-600 max-w-md mb-8">{errorMessage}</p>
                <button
                    onClick={onBack}
                    className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200"
                >
                    返回首頁
                </button>
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
                    <div className="flex items-center gap-2">
                        {sharedTrip.visibility === 'public' ? (
                            <Globe className="w-4 h-4 text-green-500" />
                        ) : (
                            <Lock className="w-4 h-4 text-amber-500" />
                        )}
                        <span className="text-xs text-gray-500 hidden sm:inline">
                            {sharedTrip.visibility === 'public' ? '公開' : '私人'}
                        </span>
                    </div>
                    <div className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <Eye className="w-3 h-3" /> 唯讀
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
                                        onExplore={() => { }}
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
