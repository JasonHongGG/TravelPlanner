import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, Plus, Minus, X, Loader2, Check, MapPin, Clock, Map as MapIcon, Utensils, Mountain, Lock, Trash2, RotateCcw, List, Ban, Layers, ChevronDown, ArrowDownCircle, Coins, ArrowRight } from 'lucide-react';
import PaymentConfirmationModal from './PaymentConfirmationModal';
import { useTranslation } from 'react-i18next';
import { AttractionRecommendation, TripStop } from '../types';
import { aiService } from '../services';
import { getStopIcon } from '../utils/icons';
import { usePoints } from '../context/PointsContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';


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
    referenceLanguage?: string;
}

type TabType = 'attraction' | 'food';
type SidebarTab = 'must' | 'avoid' | 'current';
type StopStatus = 'keep' | 'remove' | 'neutral';
type PaymentMode = 'search' | 'loadMore';

function isInsufficientPointsError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /insufficient\s+points/i.test(message);
}

export default function AttractionExplorer({
    isOpen,
    onClose,
    initialLocation,
    initialInterests,
    currentStops,
    onConfirm,
    mode = 'modification', // Default to modification for backward compatibility
    referenceLanguage
}: Props) {
    const { t, i18n } = useTranslation();
    const [location, setLocation] = useState(initialLocation);
    const [lastSearchLocation, setLastSearchLocation] = useState(initialLocation);

    const { balance, openPurchaseModal, isSubscribed, config, refreshProfile } = usePoints();
    const { user } = useAuth();
    const { settings } = useSettings();
    const QUEUE_SIZE = settings.explorerQueueSize; // Dynamic from user settings
    const BATCH_SIZE = config.RECOMMENDATION_COUNT; // Server-defined recommendation batch size.

    const [paymentConfirmation, setPaymentConfirmation] = useState<{
        mode: PaymentMode;
        query: string;
        totalCost: number;
        targetTab: TabType;
    } | null>(null);


    const [activeTab, setActiveTab] = useState<TabType>('attraction');

    // Sidebar Tab State
    const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('must');

    // Loading States
    const [initialLoading, setInitialLoading] = useState(false); // Blocking UI (First load)
    const [preloadingTab, setPreloadingTab] = useState<TabType | null>(null); // Track WHICH tab is preloading
    const [isLoadingMore, setIsLoadingMore] = useState(false);   // Manual load more
    const [isWaitingForBuffer, setIsWaitingForBuffer] = useState(false); // User clicked load more but buffer empty
    const [targetCount, setTargetCount] = useState(12);          // Expected total count for progress indicator
    const [batchCredits, setBatchCredits] = useState<{ attraction: number; food: number }>({ attraction: 0, food: 0 });
    const batchCreditsRef = useRef(batchCredits);

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

    // Session IDs for secure backend tracking
    const [sessionIds, setSessionIds] = useState<{ attraction: string | null; food: string | null }>({ attraction: null, food: null });

    // Ref to track mounted state for async ops
    const isMounted = useRef(true);
    // Ref to track loading state synchronously for callbacks
    const isLoadingMoreRef = useRef(false);

    useEffect(() => {
        isLoadingMoreRef.current = isLoadingMore;
    }, [isLoadingMore]);

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

    const getBatchCost = () => config.ATTRACTION_SEARCH_COST * (1 + QUEUE_SIZE);

    const getRemainingBatchCredits = (tab: TabType) => batchCreditsRef.current[tab];
    const setBatchCreditsImmediate = (tab: TabType, value: number) => {
        const next = { ...batchCreditsRef.current, [tab]: value };
        batchCreditsRef.current = next;
        setBatchCredits(next);
    };
    const addBatchCreditsImmediate = (tab: TabType, delta: number) => {
        setBatchCreditsImmediate(tab, batchCreditsRef.current[tab] + delta);
    };

    // =================================================================
    // Pre-fetching Logic
    // =================================================================
    useEffect(() => {
        // Only run if we have some initial results (user has searched)
        const currentLen = results[activeTab].length;
        if (currentLen === 0) return;

        // Don't auto-fetch if we are in the middle of a manual "Load More" action
        // This prevents the empty buffer (caused by flushing) from triggering a new fetch 
        // that gets hijacked into results, causing double items.
        if (isLoadingMore) return;

        const remainingCredits = getRemainingBatchCredits(activeTab);
        if (remainingCredits <= 0) return;

        // Buffer Target: We want to keep QUEUE_SIZE batches (approx BATCH_SIZE * QUEUE_SIZE items) in reserve
        const bufferLen = buffer[activeTab].length;
        const queueTargetBatches = Math.min(QUEUE_SIZE, remainingCredits);
        const BUFFER_TARGET = BATCH_SIZE * queueTargetBatches;
        const isCurrentTabPreloading = preloadingTab === activeTab;

        // If buffer is low and we aren't currently fetching, fetch more in background
        // Only if QUEUE_SIZE > 0
        if (QUEUE_SIZE > 0 && bufferLen < BUFFER_TARGET && !isCurrentTabPreloading && !initialLoading) {
            fetchNextBatchBackground();
        }
    }, [results, buffer, activeTab, preloadingTab, initialLoading, QUEUE_SIZE, isLoadingMore]);

    // Sync isLoadingMore with isPreloading completion
    // If we hijacked a stream, we need to turn off Loading More when that stream finishes
    useEffect(() => {
        const isCurrentTabPreloading = preloadingTab === activeTab;
        if (!isCurrentTabPreloading && isLoadingMore) {
            setIsLoadingMore(false);
            isLoadingMoreRef.current = false;
        }
    }, [preloadingTab, isLoadingMore, activeTab]);

    // Buffer Drain Effect:
    // If we are "Loading More", NO items should stay in buffer.
    // This catches "stragglers" that might land in buffer due to race conditions
    // between the click event (Flush) and pending stream microtasks (setBuffer).
    useEffect(() => {
        if (isLoadingMore && buffer[activeTab].length > 0) {
            setResults(prev => ({
                ...prev,
                [activeTab]: [...prev[activeTab], ...buffer[activeTab]]
            }));
            setBuffer(prev => ({ ...prev, [activeTab]: [] }));
        }
    }, [isLoadingMore, buffer, activeTab]);

    // Watch for buffer updates to fulfill waiting requests
    useEffect(() => {
        if (isWaitingForBuffer && buffer[activeTab].length > 0) {
            // Automatically consume buffer if user was waiting
            consumeBuffer();
            setIsWaitingForBuffer(false);
        }
    }, [buffer, activeTab, isWaitingForBuffer]);

    const fetchNextBatchBackground = async (forceInit: boolean = false) => {
        if (!isMounted.current) return;

        const currentTab = activeTab;
        if (getRemainingBatchCredits(currentTab) <= 0) return;

        // Prevent duplicate loads for SAME tab
        if (preloadingTab === currentTab) return;

        setPreloadingTab(currentTab);

        // Smart Callback: Routes item to Buffer (default) or Results (if user clicked Load More)
        const onItemReceived = (item: AttractionRecommendation) => {
            if (!isMounted.current) return;

            // If user clicked Load More, redirect stream directly to Results!
            if (isLoadingMoreRef.current) {
                setResults(prev => ({
                    ...prev,
                    [currentTab]: [...prev[currentTab], item]
                }));
            } else {
                setBuffer(prev => ({
                    ...prev,
                    [currentTab]: [...prev[currentTab], item]
                }));
            }
        };

        let didInitSucceed = false;
        try {
            // Exclude everything we know about
            const existingNames = [
                ...currentStops.map(s => s.name),
                ...results[currentTab].map(i => i.name),
                ...buffer[currentTab].map(i => i.name)
            ];

            const getPromptLanguage = (lng: string) => {
                switch (lng) {
                    case 'en-US': return 'English';
                    case 'ja-JP': return 'Japanese';
                    case 'ko-KR': return 'Korean';
                    default: return 'Traditional Chinese';
                }
            };
            const lang = getPromptLanguage(i18n.language);
            const titleLanguage = settings.titleLanguageMode === 'local'
                ? "Local Language"
                : (referenceLanguage || lang);

            // Use Streaming API for background fetch
            // This allows us to "tap in" mid-stream if user clicks Load More
            // This allows us to "tap in" mid-stream if user clicks Load More
            const currentSessionId = forceInit ? null : sessionIds[currentTab];
            const isInit = !currentSessionId || forceInit;

            await aiService.getRecommendationsStream(
                lastSearchLocation,
                initialInterests,
                currentTab,
                existingNames,
                onItemReceived,
                user?.email,
                lang,
                titleLanguage,
                {
                    mode: isInit ? 'init' : 'next',
                    sessionId: currentSessionId || undefined,
                    queueSize: QUEUE_SIZE,
                    onSessionStart: (id) => setSessionIds(prev => ({ ...prev, [currentTab]: id }))
                }
            );

            if (isInit) didInitSucceed = true;

        } catch (e: any) {
            console.error("Background fetch failed", e);
            if (!isMounted.current) return;

            if (e?.message === "QUOTA_EXCEEDED") {
                // Backend says no quota, but frontend thought we had credits. Sync up.
                setBatchCreditsImmediate(currentTab, 0);
                return;
            }

            if (forceInit && isInsufficientPointsError(e)) {
                // User just paid (load more), but backend rejected due to points.
                // Restore the local credit and reopen the paywall so user can go to store.
                addBatchCreditsImmediate(currentTab, 1);
                setPaymentConfirmation({
                    mode: 'loadMore',
                    query: lastSearchLocation,
                    totalCost: getBatchCost(),
                    targetTab: currentTab
                });
                return;
            }
        } finally {
            if (didInitSucceed) {
                // Init mode performs point deduction on the backend.
                // Refresh local points/transactions so UI stays consistent.
                refreshProfile();
            }
            if (isMounted.current) {
                // Only clear if WE were the one preloading this tab
                setPreloadingTab(prev => (prev === currentTab ? null : prev));
            }
        }
    };

    const consumeBuffer = () => {
        const currentBuffer = buffer[activeTab];
        const itemsToMove = currentBuffer.slice(0, BATCH_SIZE);
        const remainingBuffer = currentBuffer.slice(BATCH_SIZE);

        setResults(prev => ({
            ...prev,
            [activeTab]: [...prev[activeTab], ...itemsToMove]
        }));

        setBuffer(prev => ({
            ...prev,
            [activeTab]: remainingBuffer
        }));
    };

    const handleLoadMore = async (forceInit: boolean = false) => {
        if (isLoadingMore) return; // Prevent multiple concurrent loads

        const currentTab = activeTab;
        const currentBuffer = buffer[currentTab];
        const flushedCount = currentBuffer.length;
        const remainingCredits = getRemainingBatchCredits(currentTab);
        if (remainingCredits <= 0) {
            setPaymentConfirmation({
                mode: 'loadMore',
                query: lastSearchLocation,
                totalCost: getBatchCost(),
                targetTab: currentTab
            });
            return;
        }

        // Consume one batch credit for this load-more action
        addBatchCreditsImmediate(currentTab, -1);
        setIsLoadingMore(true);
        // Sync ref immediately for the active stream callback to see
        isLoadingMoreRef.current = true;

        // 1. Flush Buffer to Results Immediately
        // Whether full batch or partial, show them NOW.
        if (flushedCount > 0) {
            // Only reveal ONE batch at a time
            consumeBuffer();
        }

        // Update Target Count
        const nextTarget = results[currentTab].length + BATCH_SIZE;
        setTargetCount(nextTarget);

        // 2. Check if satisfied
        // If we flushed a full batch (or more), we are done. Be happy.
        if (flushedCount >= BATCH_SIZE) {
            setIsLoadingMore(false);
            isLoadingMoreRef.current = false;
            return;
        }

        // 3. If Preloading is Active FOR THIS TAB:
        // We did NOTHING else here. The active stream callback will see `isLoadingMoreRef.current = true`
        // and automatically start pushing the REST of the items to `results`.
        // The useEffect will handle turning off isLoadingMore when preloadingTab becomes null.
        if (preloadingTab === currentTab) {
            return;
        }

        // No extra paywall here; we already consumed a credit above

        // 4. If NO Preloading Active (or preloading wrong tab):
        // Start a new fetch. Since `isLoadingMore` is true, `fetchNextBatchBackground`
        // will stream items directly to `results`.
        // Start a new fetch. Since `isLoadingMore` is true, `fetchNextBatchBackground`
        // will stream items directly to `results`.
        await fetchNextBatchBackground(forceInit);

        setIsLoadingMore(false);
        isLoadingMoreRef.current = false;
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
            // Base cost (1 batch) + Preload cost (QUEUE_SIZE batches)
            const totalCost = getBatchCost();

            setPaymentConfirmation({
                mode: 'search',
                query,
                totalCost,
                targetTab
            });
            return; // Stop here, wait for modal confirmation
        }

        // Only proceed immediately if NOT a new search (though handleSearch is mostly for new searches)
        // or if we decide to separate logic. But for now, new search stops here.
        executeSearchLogic(query, targetTab, isNewSearch, user?.email);
    };

    const executeConfirmedSearch = async () => {
        if (!paymentConfirmation || paymentConfirmation.mode !== 'search') return;
        const { query, targetTab } = paymentConfirmation;

        setPaymentConfirmation(null); // Close modal

        // Update UI state for search
        setLastSearchLocation(query);
        setResults(prev => ({ ...prev, [targetTab]: [] }));
        setBuffer(prev => ({ ...prev, [targetTab]: [] }));
        setIsWaitingForBuffer(false);
        setBatchCreditsImmediate(targetTab, 1 + QUEUE_SIZE);
        // Security: Pass user ID to backend via service
        // Note: Service handles cost calculation (backend), we just pass credentials
        executeSearchLogic(query, targetTab, true, user?.email);
    };

    const executeConfirmedLoadMore = async () => {
        if (!paymentConfirmation || paymentConfirmation.mode !== 'loadMore') return;
        const { targetTab } = paymentConfirmation;

        setPaymentConfirmation(null);
        addBatchCreditsImmediate(targetTab, 1 + QUEUE_SIZE);
        // Reset sessionId to force a new 'init' call (and payment deduction) on next fetch
        setSessionIds(prev => ({ ...prev, [targetTab]: null }));
        // Reset sessionId to force a new 'init' call (and payment deduction) on next fetch
        setSessionIds(prev => ({ ...prev, [targetTab]: null }));
        await handleLoadMore(true);
    };



    const executeSearchLogic = async (query: string, targetTab: TabType, isNewSearch: boolean, userId?: string) => {
        setInitialLoading(true);
        addBatchCreditsImmediate(targetTab, -1);
        let sessionStarted = false;
        let didInitSucceed = false;
        try {
            // Initial fetch only excludes current stops (results are empty)
            const excludeNames = [...currentStops.map(s => s.name)];
            const getPromptLanguage = (lng: string) => {
                switch (lng) {
                    case 'en-US': return 'English';
                    case 'ja-JP': return 'Japanese';
                    case 'ko-KR': return 'Korean';
                    default: return 'Traditional Chinese';
                }
            };
            const lang = getPromptLanguage(i18n.language);

            // Determine Title Language based on settings
            // If local -> "Local Language"
            // If specified -> use referenceLanguage (from trip or form) or fallback to system lang
            const titleLanguage = settings.titleLanguageMode === 'local'
                ? "Local Language"
                : (referenceLanguage || lang);

            // Clear results for new search
            if (isNewSearch) {
                setResults(prev => ({
                    ...prev,
                    [targetTab]: []
                }));
                setTargetCount(BATCH_SIZE);
            }

            // Use streaming API - each item updates UI immediately
            await aiService.getRecommendationsStream(
                query,
                initialInterests,
                targetTab,
                excludeNames,
                (item) => {
                    if (isMounted.current) {
                        setResults(prev => ({
                            ...prev,
                            [targetTab]: [...prev[targetTab], item]
                        }));
                    }
                },
                userId,
                lang,
                titleLanguage,
                {
                    mode: 'init',
                    queueSize: QUEUE_SIZE,
                    onSessionStart: (id) => {
                        sessionStarted = true;
                        setSessionIds(prev => ({ ...prev, [targetTab]: id }));
                    }
                }
            );

            didInitSucceed = true;
        } catch (e) {
            console.error(e);

            if (isMounted.current && !sessionStarted) {
                // Init failed before a session was created; revert local credit consumption.
                addBatchCreditsImmediate(targetTab, 1);
            }

            if (isMounted.current && isInsufficientPointsError(e)) {
                // Backend rejected after confirmation (e.g., 403). Reopen the paywall.
                setPaymentConfirmation({
                    mode: 'search',
                    query,
                    totalCost: getBatchCost(),
                    targetTab
                });
            }
        } finally {
            if (didInitSucceed) {
                refreshProfile();
            }
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
    // Dynamic based on buffer size
    const bufferCount = buffer[activeTab].length;
    const remainingQueueBatches = Math.max(0, Math.min(QUEUE_SIZE, batchCredits[activeTab]));
    const preparedBatchCount = Math.min(
        remainingQueueBatches,
        Math.max(1, Math.ceil(bufferCount / BATCH_SIZE))
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
            {/* Premium Confirmation Modal */}
            <PaymentConfirmationModal
                isOpen={!!paymentConfirmation}
                onClose={() => setPaymentConfirmation(null)}
                onConfirm={() => {
                    if (paymentConfirmation?.mode === 'loadMore') {
                        executeConfirmedLoadMore();
                    } else {
                        executeConfirmedSearch();
                    }
                }}
                title={paymentConfirmation?.mode === 'loadMore' ? t('explorer.load_more_title') : t('explorer.open_title')}
                subtitle={paymentConfirmation?.mode === 'loadMore'
                    ? t('explorer.load_more_desc', { target: paymentConfirmation?.targetTab === 'food' ? t('explorer.target_food') : t('explorer.target_attraction') })
                    : t('explorer.open_desc', { target: paymentConfirmation?.targetTab === 'food' ? t('explorer.target_food') : t('explorer.target_attraction') })}
                targetLabel={t('explorer.search_target')}
                targetValue={paymentConfirmation?.query}
                costLabel={t('explorer.search_cost')}
                cost={config.ATTRACTION_SEARCH_COST}
                lineItems={[
                    { label: t('explorer.search_cost'), value: `${config.ATTRACTION_SEARCH_COST} 點` },
                    { label: t('explorer.queue_size'), value: t('explorer.queue_unit', { count: QUEUE_SIZE }) },
                ]}
                total={paymentConfirmation ? paymentConfirmation.totalCost : 0}
                totalLabel={t('explorer.total_cost')}
                balance={balance}
                isSubscribed={isSubscribed}
                memberFreeLabel={t('explorer.member_free')}
                insufficientPointsLabel={t('explorer.go_to_store')}
                cancelBtnText={t('explorer.cancel')}
                confirmBtnText={t('explorer.confirm_pay')}
                currentBalanceLabel={t('explorer.current_balance')}
                remainingBalanceLabel={t('explorer.remaining_balance')}
                onInsufficientPointsClick={() => {
                    setPaymentConfirmation(null);
                    openPurchaseModal();
                }}
            />

            <div className="bg-white rounded-3xl w-full max-w-7xl h-full max-h-[95vh] flex flex-col overflow-hidden shadow-2xl relative">


                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex-none bg-white">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div>
                            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-brand-500 fill-brand-500" />
                                {mode === 'planning' ? t('explorer.title_planning') : t('explorer.title_modification')}
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
                                    placeholder={t('explorer.search_placeholder')}
                                />
                                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            </div>
                            <button
                                onClick={() => handleSearch(true)}
                                disabled={initialLoading}
                                className="bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-md shadow-brand-100 whitespace-nowrap"
                            >
                                {initialLoading && results[activeTab].length === 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                {t('explorer.search_btn')}
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
                            {t('explorer.tab_attraction')}
                        </button>
                        <button
                            onClick={() => handleTabChange('food')}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === 'food'
                                ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200 shadow-sm'
                                : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <Utensils className="w-4 h-4" />
                            {t('explorer.tab_food')}
                        </button>
                    </div>
                </div>

                {/* Content Body (Split View or Scroll) */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                    {/* Left: Search Results */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/50 scrollbar-hide relative">
                        {/* Sticky Streaming Progress Indicator */}
                        {(initialLoading || isLoadingMore) && (
                            <div className="sticky top-0 left-0 right-0 z-10 mb-4 flex items-center gap-3 bg-white/90 backdrop-blur-md p-3 rounded-xl border border-brand-100 shadow-sm animate-in fade-in slide-in-from-top-2">
                                <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center shadow-sm shadow-brand-200">
                                    <Sparkles className="w-4 h-4 text-white animate-pulse" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-brand-700">AI 正在發掘更多景點...</p>
                                    <p className="text-xs text-brand-500 font-medium">已找到 {currentList.length} / {Math.max(currentList.length, targetCount)} 個推薦</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-brand-400">{Math.min(100, Math.round((currentList.length / Math.max(currentList.length, targetCount)) * 100))}%</span>
                                    <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
                                </div>
                            </div>
                        )}

                        {initialLoading && currentList.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 space-y-4">
                                <div className="relative">
                                    <div className="w-16 h-16 rounded-full border-4 border-brand-100 border-t-brand-500 animate-spin" />
                                    <Sparkles className="w-6 h-6 text-brand-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-sm text-gray-600">{t('explorer.loading_recommendations')}</p>
                                    <p className="text-xs text-gray-400 mt-1">AI 正在為您精選推薦...</p>
                                </div>
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
                                                className={`group bg-white rounded-xl overflow-hidden border transition-all duration-300 shadow-sm hover:shadow-lg hover:-translate-y-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 ${selections[item.name] === 'must' ? 'ring-2 ring-brand-500 border-brand-200' :
                                                    selections[item.name] === 'avoid' ? 'opacity-60 grayscale' : 'border-gray-100'
                                                    }`}
                                                style={{
                                                    animationDelay: `${(idx % 12) * 80}ms`,
                                                    animationFillMode: 'backwards'
                                                }}
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
                                                            {t('explorer.add')}
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
                                            onClick={() => handleLoadMore(false)}
                                            disabled={isLoadingMore || initialLoading} // Disable if loading (initial or more)
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
                                            {/* Background animation for loading state */}
                                            {(isLoadingMore || initialLoading) && (
                                                <div className="absolute inset-0 bg-gray-50/50 flex items-center justify-center">
                                                    <div className="h-full w-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>
                                                </div>
                                            )}

                                            {(isLoadingMore || initialLoading) ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                                                    <span>{t('explorer.loading')}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>{t('explorer.load_more')}</span>
                                                    <ArrowDownCircle className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                                                </>
                                            )}
                                        </button>

                                        {/* Pre-loading Status Text */}
                                        <div className="h-5 text-[10px] text-gray-400 font-medium flex items-center gap-1.5">
                                            {remainingQueueBatches > 0 && preloadingTab === activeTab && !isWaitingForBuffer && (
                                                <>
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    <span>{t('explorer.preloading', { current: preparedBatchCount, total: remainingQueueBatches })}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Search className="w-12 h-12 mb-3 opacity-10" />
                                <p className="text-sm font-medium">{t('explorer.empty_search')}</p>
                            </div>
                        )}
                    </div>

                    {/* Right/Bottom: Sidebar with Tabs */}
                    <div className="w-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l border-gray-200 bg-white flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">

                        {/* Sidebar Header & Description */}
                        <div className="p-4 bg-gray-50 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                {mode === 'modification' ? <RotateCcw className="w-4 h-4 text-brand-600" /> : <List className="w-4 h-4 text-brand-600" />}
                                {mode === 'modification' ? t('explorer.sidebar_mod_title') : t('explorer.sidebar_plan_title')}
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
                                {t('explorer.tab_must')}
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
                                {t('explorer.tab_avoid')}
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
                                    {t('explorer.tab_current')}
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
                                            {t('explorer.empty_must')}
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
                                            {t('explorer.empty_avoid')}
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
                                        {t('explorer.hint_mod')}
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
                                                        title={t('explorer.tooltip_keep')}
                                                    >
                                                        <Lock className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => toggleStopStatus(stop.name, 'remove')}
                                                        className={`p-1.5 rounded-lg transition-colors ${status === 'remove' ? 'bg-red-500 text-white' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}
                                                        title={t('explorer.tooltip_remove')}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {currentStops.length === 0 && (
                                        <div className="text-center py-8 text-gray-400 text-xs">
                                            {t('explorer.empty_current_day')}
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
                                {mode === 'planning' ? t('explorer.add_to_list') : t('explorer.replan')}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
