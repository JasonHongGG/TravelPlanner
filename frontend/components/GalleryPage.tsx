import React, { useState, useEffect } from 'react';
import { Globe, Shuffle, Loader2, ArrowLeft, TrendingUp, Sparkles, Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SharedTripMeta, GalleryResponse } from '../types';
import { tripShareService } from '../services/TripShareService';
import { usePoints } from '../context/PointsContext';
import TripPreviewCard from './TripPreviewCard';

interface GalleryPageProps {
    onBack: () => void;
    onSelectTrip: (tripId: string) => void;
}

export default function GalleryPage({ onBack, onSelectTrip }: GalleryPageProps) {
    const { t } = useTranslation();
    const { config } = usePoints();
    const [trips, setTrips] = useState<SharedTripMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isRandomMode, setIsRandomMode] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const pageSize = config.GALLERY_PAGE_SIZE_DEFAULT;
    const hasMore = trips.length < total;

    // Load initial data
    useEffect(() => {
        loadTrips();
    }, []);

    const loadTrips = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await tripShareService.getGallery(1, pageSize);
            setTrips(response.trips);
            setTotal(response.total);
            setPage(1);
            setIsRandomMode(false);
        } catch (e: any) {
            setError(e.message || '載入失敗');
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async () => {
        if (loadingMore || !hasMore || isRandomMode) return;

        setLoadingMore(true);
        try {
            const nextPage = page + 1;
            const response = await tripShareService.getGallery(nextPage, pageSize);
            setTrips(prev => [...prev, ...response.trips]);
            setPage(nextPage);
        } catch (e) {
            console.error('Failed to load more:', e);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleRandomize = async () => {
        setLoading(true);
        setError(null);
        try {
            const randomTrips = await tripShareService.getRandomTrips(config.RANDOM_TRIPS_DEFAULT);
            setTrips(randomTrips);
            setTotal(randomTrips.length);
            setIsRandomMode(true);
        } catch (e: any) {
            setError(e.message || '載入失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleBackToTrending = () => {
        loadTrips();
    };

    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* Navbar */}
            <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onBack}
                                className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium text-sm transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                返回
                            </button>
                            <div className="h-6 w-px bg-gray-200 mx-2" />
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black text-gray-800 tracking-tight">探索旅程</span>
                            </div>
                        </div>

                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Hero Section */}
                <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center text-center">
                    {/* Segmented Control */}
                    <div className="inline-flex p-1 mb-6 bg-gray-100/80 backdrop-blur-sm rounded-full border border-gray-200 shadow-inner">
                        <button
                            onClick={handleBackToTrending}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${!isRandomMode ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            <Flame className={`w-4 h-4 ${!isRandomMode ? 'fill-current' : ''}`} />
                            熱門推薦
                        </button>
                        <button
                            onClick={handleRandomize}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${isRandomMode ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            <Shuffle className="w-4 h-4" />
                            隨機探索
                        </button>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
                        {isRandomMode ? '探索未知的旅程' : '探索熱門旅程'}
                    </h1>
                    <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                        {isRandomMode
                            ? '跳脫舒適圈，發現來自全球旅人的精彩行程，每次點擊都是驚喜！'
                            : '瀏覽近期社群中最受歡迎的旅程規劃，獲取靈感開始你的下一次冒險。'}
                    </p>
                </div>

                {/* Error State */}
                {
                    error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
                            {error}
                        </div>
                    )
                }

                {/* Loading State */}
                {
                    loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="relative mb-4">
                                <div className="w-16 h-16 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
                            </div>
                            <p className="text-gray-500">載入中...</p>
                        </div>
                    ) : trips.length === 0 ? (
                        /* Empty State */
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <Globe className="w-12 h-12 text-gray-300" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">還沒有公開的旅程</h2>
                            <p className="text-gray-500 max-w-md">
                                成為第一個分享旅程的人！建立你的行程並設為公開，讓全世界看見你的精彩冒險。
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Trip Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {trips.map((trip) => (
                                    <TripPreviewCard
                                        key={trip.tripId}
                                        trip={trip}
                                        onSelect={onSelectTrip}
                                    />
                                ))}
                            </div>

                            {/* Load More */}
                            {hasMore && !isRandomMode && (
                                <div className="flex justify-center mt-10">
                                    <button
                                        onClick={loadMore}
                                        disabled={loadingMore}
                                        className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 rounded-xl border border-gray-200 font-bold text-sm shadow-sm hover:shadow transition-all disabled:opacity-50"
                                    >
                                        {loadingMore ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                載入中...
                                            </>
                                        ) : (
                                            <>載入更多 ↓</>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Random Mode: Refresh Button */}
                            {isRandomMode && (
                                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4">
                                    <button
                                        onClick={handleRandomize}
                                        disabled={loading}
                                        className="group flex items-center gap-2 px-6 py-3 bg-white/90 backdrop-blur-md hover:bg-white text-gray-800 rounded-full font-bold text-sm shadow-xl border border-gray-200 hover:-translate-y-1 transition-all disabled:opacity-50"
                                    >
                                        <Sparkles className="w-4 h-4 text-violet-500 group-hover:rotate-12 transition-transform" />
                                        換一組試試
                                    </button>
                                </div>
                            )}
                        </>
                    )
                }
            </main >
        </div >
    );
}
