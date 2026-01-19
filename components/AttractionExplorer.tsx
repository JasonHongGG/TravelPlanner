
import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, Plus, Minus, X, Loader2, Check, MapPin, Clock, Map as MapIcon, Utensils, Mountain, Lock, Trash2, RotateCcw, List, Ban, Layers, ChevronDown, ArrowDownCircle, Coins, ArrowRight } from 'lucide-react';
import { AttractionRecommendation, TripStop } from '../types';
import { aiService } from '../services';
import { getStopIcon } from '../utils/icons';
import { usePoints } from '../context/PointsContext';
import { ATTRACTION_SEARCH_COST } from '../constants/pointsConfig';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    initialLocation: string;
    initialInterests: string;
    currentStops: TripStop[];
    onConfirm: (
        newMustVisit: string[],
        newAvoid: string[],
        keepExisting: string[],
        removeExisting: string[]
    ) => void;
    mode?: 'planning' | 'modification';
}

type TabType = 'attraction' | 'food';
type SidebarTab = 'must' | 'avoid' | 'current';
type StopStatus = 'keep' | 'remove' | 'neutral';

export default function AttractionExplorer({
    isOpen,
    onClose,
    initialLocation,
    initialInterests,
    currentStops,
    onConfirm,
    mode = 'modification' // Default to modification for backward compatibility
}: Props) {
    const [location, setLocation] = useState(initialLocation);
    const [lastSearchLocation, setLastSearchLocation] = useState(initialLocation);

    const { balance, spendPoints, openPurchaseModal } = usePoints();
    const QUEUE_SIZE = 3; // Defined as per user request (3 batches/queues)

    const [searchConfirmation, setSearchConfirmation] = useState<{
        query: string;
        totalCost: number;
        targetTab: TabType;
    } | null>(null);


    const [activeTab, setActiveTab] = useState<TabType>('attraction');

    // Sidebar Tab State
    const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('must');

    // Loading States
    const [initialLoading, setInitialLoading] = useState(false); // Blocking UI (First load)
    const [isPreloading, setIsPreloading] = useState(false);     // Background loading
    const [isWaitingForBuffer, setIsWaitingForBuffer] = useState(false); // User clicked load more but buffer empty

    // Data States
    const [results, setResults] = useState<{ attraction: AttractionRecommendation[], food: AttractionRecommendation[] }>({
        attraction: [],
        food: []
    });

    // Buffer State for Pre-fetching (Holds the next batches)
    const [buffer, setBuffer] = useState<{ attraction: AttractionRecommendation[], food: AttractionRecommendation[] }>({
        attraction: [],
        food: []
    });

    // Selection state for NEW recommendations
    const [selections, setSelections] = useState<Record<string, 'must' | 'avoid' | null>>({});

    // Selection state for EXISTING stops
    const [stopStatuses, setStopStatuses] = useState<Record<string, StopStatus>>({});

    // Ref to track mounted state for async ops
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    // Initial fetch when opened
    useEffect(() => {
        if (isOpen) {
            setLocation(initialLocation);

            // Initialize existing stops status
            if (mode === 'modification') {
                const initialStatuses: Record<string, StopStatus> = {};
                currentStops.forEach(stop => {
                    initialStatuses[stop.name] = 'neutral';
                });
                setStopStatuses(initialStatuses);
                setActiveSidebarTab('current');
            } else {
                setSelections({});
                setActiveSidebarTab('must');
            }

        }
    }, [isOpen, currentStops, mode, initialLocation]);

    // =================================================================
    // Pre-fetching Logic
    // =================================================================
    useEffect(() => {
        // Only run if we have some initial results (user has searched)
        const currentLen = results[activeTab].length;
        if (currentLen === 0) return;

        // Buffer Target: We want to keep about 2 batches (approx 24 items) in reserve
        const bufferLen = buffer[activeTab].length;
        const BUFFER_TARGET = 24;

        // If buffer is low and we aren't currently fetching, fetch more in background
        if (bufferLen < BUFFER_TARGET && !isPreloading && !initialLoading) {
            fetchNextBatchBackground();
        }
    }, [results, buffer, activeTab, isPreloading, initialLoading]);

    // Watch for buffer updates to fulfill waiting requests
    useEffect(() => {
        if (isWaitingForBuffer && buffer[activeTab].length > 0) {
            // Automatically consume buffer if user was waiting
            consumeBuffer();
            setIsWaitingForBuffer(false);
        }
    }, [buffer, activeTab, isWaitingForBuffer]);

    const fetchNextBatchBackground = async () => {
        if (!isMounted.current) return;
        setIsPreloading(true);

        try {
            const currentTab = activeTab;

            // Exclude everything we know about: Current stops + Visible Results + Buffered Results
            const existingNames = [
                ...currentStops.map(s => s.name),
                ...results[currentTab].map(i => i.name),
                ...buffer[currentTab].map(i => i.name)
            ];

            const newItems = await aiService.getRecommendations(
                lastSearchLocation,
                initialInterests,
                currentTab,
                existingNames
            );

            if (isMounted.current && newItems.length > 0) {
                setBuffer(prev => ({
                    ...prev,
                    [currentTab]: [...prev[currentTab], ...newItems]
                }));
            }
        } catch (e) {
            console.error("Background fetch failed", e);
        } finally {
            if (isMounted.current) setIsPreloading(false);
        }
    };

    const consumeBuffer = () => {
        const currentBuffer = buffer[activeTab];
        const batchSize = 12;
        const itemsToMove = currentBuffer.slice(0, batchSize);
        const remainingBuffer = currentBuffer.slice(batchSize);

        setResults(prev => ({
            ...prev,
            [activeTab]: [...prev[activeTab], ...itemsToMove]
        }));

        setBuffer(prev => ({
            ...prev,
            [activeTab]: remainingBuffer
        }));
    };

    const handleLoadMore = () => {
        const currentBuffer = buffer[activeTab];

        if (currentBuffer.length > 0) {
            // Immediate load if buffer has data
            consumeBuffer();
        } else {
            // Buffer empty, wait for it
            setIsWaitingForBuffer(true);
            // If not preloading (rare case where buffer is 0 and we stopped preloading?), force fetch
            if (!isPreloading) {
                fetchNextBatchBackground();
            }
        }
    };

    // =================================================================

    // Handle Tab Switch
    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setIsWaitingForBuffer(false); // Reset waiting state on tab change
        // If we have no results for this tab, trigger a fresh search
        /* 
        // DISABLED for spec: manual search only
        if (results[tab].length === 0 && !initialLoading) {
           handleSearch(true, tab);
        } 
        */
    };

    // Main Search (Resets everything)
    const handleSearch = async (isNewSearch = true, overrideTab?: TabType, customLocation?: string) => {
        const query = customLocation || location;
        if (!query.trim()) return;

        const targetTab = overrideTab || activeTab;

        if (isNewSearch) {
            // Points Deduction Logic
            const totalCost = ATTRACTION_SEARCH_COST * QUEUE_SIZE;

            setSearchConfirmation({
                query,
                totalCost,
                targetTab
            });
            return; // Stop here, wait for modal confirmation
        }

        // Only proceed immediately if NOT a new search (though handleSearch is mostly for new searches)
        // or if we decide to separate logic. But for now, new search stops here.
        executeSearchLogic(query, targetTab, isNewSearch);
    };

    const executeConfirmedSearch = async () => {
        if (!searchConfirmation) return;
        const { query, totalCost, targetTab } = searchConfirmation;

        // Deduct Points
        const success = await spendPoints(totalCost, `AI 景點探索: ${query} (${targetTab === 'food' ? '美食' : '景點'})`);
        if (!success) {
            alert("交易失敗，請稍後再試");
            setSearchConfirmation(null);
            return;
        }

        setSearchConfirmation(null); // Close modal

        // Update UI state for search
        setLastSearchLocation(query);
        setResults(prev => ({ ...prev, [targetTab]: [] }));
        setBuffer(prev => ({ ...prev, [targetTab]: [] }));
        setIsWaitingForBuffer(false);

        // Run the actual API call
        executeSearchLogic(query, targetTab, true);
    };

    const executeSearchLogic = async (query: string, targetTab: TabType, isNewSearch: boolean) => {
        setInitialLoading(true);

        try {
            // Initial fetch only excludes current stops (results are empty)
            const excludeNames = [...currentStops.map(s => s.name)];
            const newItems = await aiService.getRecommendations(query, initialInterests, targetTab, excludeNames);

            if (isMounted.current) {
                setResults(prev => ({
                    ...prev,
                    [targetTab]: isNewSearch ? newItems : [...prev[targetTab], ...newItems]
                }));
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (isMounted.current) setInitialLoading(false);
        }
    };

    const toggleSelect = (name: string, type: 'must' | 'avoid') => {
        setSelections(prev => ({
            ...prev,
            [name]: prev[name] === type ? null : type
        }));
    };

    const toggleStopStatus = (stopName: string, status: StopStatus) => {
        setStopStatuses(prev => ({
            ...prev,
            [stopName]: prev[stopName] === status ? 'neutral' : status
        }));
    };

    const handleApply = () => {
        const newMustVisit = Object.entries(selections).filter(([_, v]) => v === 'must').map(([name]) => name);
        const newAvoid = Object.entries(selections).filter(([_, v]) => v === 'avoid').map(([name]) => name);

        const keepExisting = Object.entries(stopStatuses).filter(([_, v]) => v === 'keep').map(([name]) => name);
        const removeExisting = Object.entries(stopStatuses).filter(([_, v]) => v === 'remove').map(([name]) => name);

        onConfirm(newMustVisit, newAvoid, keepExisting, removeExisting);
        onClose();
    };

    const openInGoogleMaps = (name: string) => {
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + lastSearchLocation)}`;
        window.open(url, '_blank');
    };

    const currentList = results[activeTab];

    // Helper to count items
    const mustCount = Object.values(selections).filter(v => v === 'must').length;
    const avoidCount = Object.values(selections).filter(v => v === 'avoid').length;
    const currentCount = currentStops.length;

    // Calculate batch status for UI
    // If buffer has 0-11 items, we are loading the 1st batch of the 2-batch limit.
    // If buffer has 12+ items, we are loading the 2nd batch.
    const bufferCount = buffer[activeTab].length;
    const preloadingBatchNumber = bufferCount < 12 ? 1 : 2;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
            {/* Premium Confirmation Modal */}
            {searchConfirmation && (
                <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Header Gradient */}
                        <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-6 text-white relative overflow-hidden">
                            <div className="absolute -right-4 -top-4 text-white/10">
                                <Sparkles className="w-24 h-24" />
                            </div>
                            <h3 className="text-xl font-bold relative z-10 flex items-center gap-2">
                                <Sparkles className="w-5 h-5" />
                                開啟 AI 探索
                            </h3>
                            <p className="text-brand-100 text-sm mt-1 relative z-10">
                                AI 將為您深入分析並推薦最佳{searchConfirmation.targetTab === 'food' ? '美食' : '景點'}
                            </p>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="text-gray-500 text-sm">搜尋目標</div>
                                <div className="font-bold text-gray-900 flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-brand-500" />
                                    {searchConfirmation.query}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">單次搜尋費用</span>
                                    <span className="font-medium">{ATTRACTION_SEARCH_COST} 點</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">預測探索隊列</span>
                                    <span className="font-medium">x {QUEUE_SIZE} 組</span>
                                </div>
                                <div className="h-px bg-gray-100 my-2"></div>
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-gray-900">總計花費</span>
                                    <span className="font-black text-xl text-brand-600 flex items-center gap-1">
                                        <Coins className="w-5 h-5" />
                                        {searchConfirmation.totalCost}
                                    </span>
                                </div>
                            </div>

                            {/* Balance Preview */}
                            <div className="mt-6 bg-brand-50/50 rounded-xl p-3 flex items-center justify-between text-sm">
                                <div className="flex flex-col">
                                    <span className="text-gray-500 text-xs">目前點數</span>
                                    <span className="font-bold text-gray-700">{balance}</span>
                                </div>
                                <ArrowRight className="w-4 h-4 text-gray-400" />
                                <div className="flex flex-col items-end">
                                    <span className="text-gray-500 text-xs">剩餘點數</span>
                                    <span className={`font-bold ${balance - searchConfirmation.totalCost < 0 ? 'text-red-600' : 'text-brand-600'}`}>
                                        {balance - searchConfirmation.totalCost}
                                    </span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-3 mt-8">
                                <button
                                    onClick={() => setSearchConfirmation(null)}
                                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                                >
                                    取消
                                </button>

                                {balance < searchConfirmation.totalCost ? (
                                    <button
                                        onClick={() => {
                                            setSearchConfirmation(null);
                                            openPurchaseModal();
                                        }}
                                        className="px-4 py-2.5 rounded-xl bg-gray-900 text-white font-bold hover:bg-black transition-all shadow-lg shadow-gray-200 flex items-center justify-center gap-2"
                                    >
                                        前往儲值中心
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={executeConfirmedSearch}
                                        className="px-4 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 flex items-center justify-center gap-2"
                                    >
                                        確認支付
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-3xl w-full max-w-7xl h-full max-h-[95vh] flex flex-col overflow-hidden shadow-2xl relative">


                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex-none bg-white">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div>
                            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-brand-500 fill-brand-500" />
                                {mode === 'planning' ? 'AI 景點探索助手' : 'AI 景點探索與行程調整'}
                            </h2>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <div className="relative flex-1 md:flex-none">
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(true)}
                                    className="pl-9 pr-4 py-2 bg-gray-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-brand-500 w-full md:w-64"
                                    placeholder="輸入目的地..."
                                />
                                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            </div>
                            <button
                                onClick={() => handleSearch(true)}
                                disabled={initialLoading}
                                className="bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-md shadow-brand-100 whitespace-nowrap"
                            >
                                {initialLoading && results[activeTab].length === 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                搜尋
                            </button>
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex space-x-2">
                        <button
                            onClick={() => handleTabChange('attraction')}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === 'attraction'
                                ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 shadow-sm'
                                : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <Mountain className="w-4 h-4" />
                            探索景點
                        </button>
                        <button
                            onClick={() => handleTabChange('food')}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === 'food'
                                ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200 shadow-sm'
                                : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <Utensils className="w-4 h-4" />
                            尋找美食
                        </button>
                    </div>
                </div>

                {/* Content Body (Split View or Scroll) */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                    {/* Left: Search Results */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/50 scrollbar-hide">
                        {initialLoading && currentList.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                                <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
                                <p className="font-bold text-sm text-gray-600">正在挖掘推薦...</p>
                            </div>
                        ) : currentList.length > 0 ? (
                            <>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {currentList.map((item, idx) => {
                                        const query = activeTab === 'food' ? `${item.name} food` : `${item.name}`;
                                        const realImageUrl = `https://th.bing.com/th?q=${encodeURIComponent(query)}&w=800&h=600&c=7&rs=1&p=0`;
                                        const fallbackUrl = `https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80`;

                                        return (
                                            <div
                                                key={`${item.name}-${idx}`}
                                                className={`group bg-white rounded-xl overflow-hidden border transition-all duration-300 shadow-sm hover:shadow-md flex flex-col ${selections[item.name] === 'must' ? 'ring-2 ring-brand-500 border-brand-200' :
                                                    selections[item.name] === 'avoid' ? 'opacity-60 grayscale' : 'border-gray-100'
                                                    }`}
                                            >
                                                <div className="h-40 bg-gray-200 relative overflow-hidden flex-none">
                                                    <img
                                                        src={realImageUrl}
                                                        onError={(e) => { e.currentTarget.src = fallbackUrl; }}
                                                        alt={item.name}
                                                        referrerPolicy="no-referrer"
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                                    />
                                                    <div className="absolute top-2 right-2">
                                                        <span className="bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-md font-bold uppercase">
                                                            {item.category}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => openInGoogleMaps(item.name)}
                                                        className="absolute bottom-2 right-2 bg-white/90 p-1.5 rounded-lg text-gray-700 hover:text-brand-600 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <MapIcon className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="p-4 flex flex-col flex-1">
                                                    <div className="mb-2">
                                                        <h3 className="font-bold text-gray-900 text-base leading-tight mb-1">{item.name}</h3>
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                                                            <Clock className="w-3 h-3" /> {item.openHours}
                                                        </div>
                                                    </div>

                                                    <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2">
                                                        {item.reason}
                                                    </p>

                                                    <div className="flex gap-2 mt-auto">
                                                        <button
                                                            onClick={() => toggleSelect(item.name, 'must')}
                                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${selections[item.name] === 'must'
                                                                ? 'bg-brand-600 text-white'
                                                                : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                                                                }`}
                                                        >
                                                            {selections[item.name] === 'must' ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                                            加入
                                                        </button>
                                                        <button
                                                            onClick={() => toggleSelect(item.name, 'avoid')}
                                                            className={`px-3 flex items-center justify-center py-2 rounded-lg text-xs font-bold transition-all ${selections[item.name] === 'avoid'
                                                                ? 'bg-gray-800 text-white'
                                                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                                }`}
                                                        >
                                                            <Minus className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Designed Load More Button Area */}
                                <div className="mt-8 pb-4 relative">
                                    <div className="absolute -top-12 inset-x-0 h-12 bg-gradient-to-b from-transparent to-gray-50/50 pointer-events-none"></div>
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <button
                                            onClick={handleLoadMore}
                                            disabled={isWaitingForBuffer} // Disable click if already waiting
                                            className={`
                             group relative overflow-hidden
                             bg-white border hover:border-brand-300 hover:shadow-lg shadow-sm
                             text-gray-600 hover:text-brand-600
                             px-10 py-3 rounded-full 
                             font-bold text-sm transition-all duration-300
                             flex items-center gap-3
                             disabled:opacity-80 disabled:cursor-not-allowed
                           `}
                                        >
                                            {/* Background animation for waiting state */}
                                            {isWaitingForBuffer && (
                                                <div className="absolute inset-0 bg-gray-50/50 flex items-center justify-center">
                                                    <div className="h-full w-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>
                                                </div>
                                            )}

                                            {isWaitingForBuffer ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                                                    <span>載入中...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>載入更多</span>
                                                    <ArrowDownCircle className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                                                </>
                                            )}
                                        </button>

                                        {/* Pre-loading Status Text */}
                                        <div className="h-5 text-[10px] text-gray-400 font-medium flex items-center gap-1.5">
                                            {isPreloading && !isWaitingForBuffer && (
                                                <>
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    <span>正在預載入({preloadingBatchNumber}/2)</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Search className="w-12 h-12 mb-3 opacity-10" />
                                <p className="text-sm font-medium">輸入目的地來探索推薦景點</p>
                            </div>
                        )}
                    </div>

                    {/* Right/Bottom: Sidebar with Tabs */}
                    <div className="w-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l border-gray-200 bg-white flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">

                        {/* Sidebar Header & Description */}
                        <div className="p-4 bg-gray-50 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                {mode === 'modification' ? <RotateCcw className="w-4 h-4 text-brand-600" /> : <List className="w-4 h-4 text-brand-600" />}
                                {mode === 'modification' ? '行程管理' : '已選清單'}
                            </h3>
                        </div>

                        {/* Sidebar Tabs */}
                        <div className="flex border-b border-gray-200 bg-white">
                            {/* Must Visit Tab */}
                            <button
                                onClick={() => setActiveSidebarTab('must')}
                                className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${activeSidebarTab === 'must'
                                    ? 'border-brand-600 text-brand-600 bg-brand-50/50'
                                    : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <Check className="w-3 h-3" />
                                必去
                                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${mustCount > 0 ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                    {mustCount}
                                </span>
                            </button>

                            {/* Avoid Tab */}
                            <button
                                onClick={() => setActiveSidebarTab('avoid')}
                                className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${activeSidebarTab === 'avoid'
                                    ? 'border-red-500 text-red-600 bg-red-50/50'
                                    : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <Ban className="w-3 h-3" />
                                避開
                                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${avoidCount > 0 ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                    {avoidCount}
                                </span>
                            </button>

                            {/* Current Itinerary Tab (Only in Modification Mode) */}
                            {mode === 'modification' && (
                                <button
                                    onClick={() => setActiveSidebarTab('current')}
                                    className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${activeSidebarTab === 'current'
                                        ? 'border-sky-600 text-sky-700 bg-sky-50/50'
                                        : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <Layers className="w-3 h-3" />
                                    當日
                                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-gray-200 text-gray-500">
                                        {currentCount}
                                    </span>
                                </button>
                            )}
                        </div>

                        {/* Sidebar Content Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                            {/* 1. MUST VISIT CONTENT */}
                            {activeSidebarTab === 'must' && (
                                <div className="space-y-3">
                                    {mustCount === 0 && (
                                        <div className="text-center py-10 text-gray-400 text-xs flex flex-col items-center">
                                            <Sparkles className="w-8 h-8 mb-2 opacity-20" />
                                            尚未選擇必去景點
                                        </div>
                                    )}
                                    {Object.entries(selections).map(([name, type]) => {
                                        if (type !== 'must') return null;
                                        return (
                                            <div key={name} className="flex items-center justify-between p-3 rounded-xl border bg-brand-50 border-brand-200">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px] font-bold">
                                                        <Check className="w-3 h-3" />
                                                    </span>
                                                    <span className="text-sm font-medium text-gray-900 truncate">{name}</span>
                                                </div>
                                                <button onClick={() => toggleSelect(name, 'must')} className="text-gray-400 hover:text-red-500 p-1">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* 2. AVOID CONTENT */}
                            {activeSidebarTab === 'avoid' && (
                                <div className="space-y-3">
                                    {avoidCount === 0 && (
                                        <div className="text-center py-10 text-gray-400 text-xs flex flex-col items-center">
                                            <Ban className="w-8 h-8 mb-2 opacity-20" />
                                            尚未選擇避開項目
                                        </div>
                                    )}
                                    {Object.entries(selections).map(([name, type]) => {
                                        if (type !== 'avoid') return null;
                                        return (
                                            <div key={name} className="flex items-center justify-between p-3 rounded-xl border bg-red-50 border-red-200">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-bold">
                                                        <Minus className="w-3 h-3" />
                                                    </span>
                                                    <span className="text-sm font-medium text-gray-900 truncate">{name}</span>
                                                </div>
                                                <button onClick={() => toggleSelect(name, 'avoid')} className="text-gray-400 hover:text-red-500 p-1">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* 3. CURRENT ITINERARY CONTENT (Only Modification) */}
                            {activeSidebarTab === 'current' && mode === 'modification' && (
                                <div className="space-y-3">
                                    <div className="mb-2 p-2 bg-blue-50 text-blue-800 text-[10px] rounded-lg border border-blue-100">
                                        提示：勾選「保留」以鎖定行程，勾選「移除」則刪除。未勾選者為「彈性」，AI 可視情況替換。
                                    </div>
                                    {currentStops.map((stop, i) => {
                                        const StopIcon = getStopIcon(stop);
                                        const status = stopStatuses[stop.name];
                                        return (
                                            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${status === 'keep' ? 'bg-green-50 border-green-200 ring-1 ring-green-200' :
                                                status === 'remove' ? 'bg-red-50 border-red-200' :
                                                    'bg-white border-gray-100'
                                                }`}>
                                                <div className={`mt-1 p-1.5 rounded-full flex-shrink-0 ${status === 'keep' ? 'bg-green-100 text-green-600' :
                                                    status === 'remove' ? 'bg-red-100 text-red-600' :
                                                        'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    <StopIcon className="w-3.5 h-3.5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold text-gray-900 truncate">{stop.name}</div>
                                                    <div className="text-[10px] text-gray-500 truncate">{stop.notes}</div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => toggleStopStatus(stop.name, 'keep')}
                                                        className={`p-1.5 rounded-lg transition-colors ${status === 'keep' ? 'bg-green-500 text-white' : 'text-gray-300 hover:text-green-500 hover:bg-green-50'}`}
                                                        title="必須保留"
                                                    >
                                                        <Lock className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => toggleStopStatus(stop.name, 'remove')}
                                                        className={`p-1.5 rounded-lg transition-colors ${status === 'remove' ? 'bg-red-500 text-white' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}
                                                        title="必須移除"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {currentStops.length === 0 && (
                                        <div className="text-center py-8 text-gray-400 text-xs">
                                            當天尚無行程
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer Action */}
                        <div className="p-4 border-t border-gray-100 bg-white">
                            <button
                                onClick={handleApply}
                                disabled={mustCount === 0 && avoidCount === 0 && (mode === 'planning' || Object.values(stopStatuses).every(v => v === 'neutral'))}
                                className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-100 transition-all flex items-center justify-center gap-2"
                            >
                                {mode === 'planning' ? <Plus className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-yellow-300" />}
                                {mode === 'planning' ? '加入到需求清單' : 'AI 重新規劃行程'}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
