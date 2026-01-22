import React, { useState, useEffect } from 'react';
import { Globe, Shuffle, Loader2, ArrowLeft, TrendingUp, Sparkles } from 'lucide-react';
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

                        {/* Random Button */}
                        <div className="flex items-center gap-3">
                            {isRandomMode ? (
                                <button
                                    onClick={handleBackToTrending}
                                    className="flex items-center gap-2 px-4 py-2 bg-brand-50 hover:bg-brand-100 text-brand-600 rounded-xl text-sm font-bold transition-all"
                                >
                                    <TrendingUp className="w-4 h-4" />
                                    返回熱門
                                </button>
                            ) : (
                                <button
                                    onClick={handleRandomize}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-200 hover:-translate-y-0.5 transition-all disabled:opacity-50"
                                >
                                    <Shuffle className="w-4 h-4" />
                                    隨機探索
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Hero Section */}
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 mb-2">
                        {isRandomMode ? (
                            <>
                                <Sparkles className="w-6 h-6 text-purple-500" />
                                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">
                                    隨機探索
                                </h1>
                            </>
                        ) : (
                            <>
                                <TrendingUp className="w-6 h-6 text-brand-500" />
                                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">
                                    🔥 熱門推薦
                                </h1>
                            </>
                        )}
                    </div>
                    <p className="text-gray-500 text-lg">
                        {isRandomMode
                            ? '發現來自全球旅人的精彩行程，每次都不一樣！'
                            : '發現近期最受歡迎的旅程規劃，獲取靈感開始你的冒險'}
                    </p>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
                        {error}
                    </div>
                )}

                {/* Loading State */}
                {loading ? (
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
                            <div className="flex justify-center mt-10">
                                <button
                                    onClick={handleRandomize}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-200 transition-all disabled:opacity-50"
                                >
                                    <Shuffle className="w-4 h-4" />
                                    再次隨機
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
