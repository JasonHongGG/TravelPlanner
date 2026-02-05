import React, { useState } from 'react';
import { Heart, Eye, Calendar, MapPin, User } from 'lucide-react';
import type { SharedTripMeta } from '../types';
import { tripShareService } from '../services/TripShareService';

import { getTripCover } from '../utils/tripUtils';
import { formatLanguage } from '../utils/formatters';

interface TripPreviewCardProps {
    trip: SharedTripMeta;
    onSelect: (tripId: string) => void;
}

export default function TripPreviewCard({ trip, onSelect }: TripPreviewCardProps) {
    const [isLiking, setIsLiking] = useState(false);
    const [likeCount, setLikeCount] = useState(trip.likeCount);
    const [hasLiked, setHasLiked] = useState(false);

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLiking || hasLiked) return;

        setIsLiking(true);
        try {
            const newCount = await tripShareService.likeTrip(trip.tripId);
            setLikeCount(newCount);
            setHasLiked(true);
        } catch (err) {
            console.error('Failed to like:', err);
        } finally {
            setIsLiking(false);
        }
    };

    const coverImage = getTripCover(trip, 'small');

    return (
        <div
            onClick={() => onSelect(trip.tripId)}
            className="group relative bg-white rounded-xl shadow-sm hover:shadow-xl border border-gray-100 overflow-hidden transition-all duration-300 flex flex-col cursor-pointer hover:-translate-y-1"
        >
            {/* Cover Image */}
            <div className="relative aspect-[4/3] bg-gray-200 overflow-hidden">
                <img
                    src={coverImage}
                    alt={trip.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80';
                    }}
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                {/* Hover Overlay with View Button */}
                <div className="absolute inset-0 bg-black/30 opacity-[0.01] group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="p-3 rounded-full bg-white/20 border border-white/30 text-white shadow-lg transform-gpu">
                        <Eye className="w-6 h-6" strokeWidth={2} />
                    </div>
                </div>

                {/* Stats Badge */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-white/90 text-xs font-medium">
                            <Eye className="w-3.5 h-3.5" />
                            {trip.viewCount.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1 text-white/90 text-xs font-medium">
                            <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-red-500 text-red-500' : ''}`} />
                            {likeCount.toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 flex-1 flex flex-col">
                {/* Title & Destination */}
                <div className="mb-3">
                    <h3 className="text-base font-bold text-gray-900 leading-snug line-clamp-1 group-hover:text-brand-600 transition-colors">
                        {trip.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span className="truncate">{trip.destination}</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {formatLanguage(trip.language || 'zh-TW')}
                        </span>
                        <span className="text-gray-300">•</span>
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>{trip.days} 天</span>
                    </div>
                </div>

                {/* Author */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-2">
                        {trip.ownerPicture ? (
                            <img
                                src={trip.ownerPicture}
                                alt={trip.ownerName}
                                className="w-6 h-6 rounded-full ring-2 ring-white"
                            />
                        ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                <User className="w-3 h-3 text-gray-400" />
                            </div>
                        )}
                        <span className="text-xs text-gray-500 truncate max-w-[100px]">
                            {trip.ownerName}
                        </span>
                    </div>

                    {/* Like Button */}
                    <button
                        onClick={handleLike}
                        disabled={isLiking || hasLiked}
                        className={`
              p-2 rounded-full transition-all duration-300
              ${hasLiked
                                ? 'bg-red-50 text-red-500'
                                : 'bg-gray-50 text-gray-300 hover:bg-red-50 hover:text-red-400'
                            }
              ${isLiking ? 'animate-pulse' : ''}
              disabled:cursor-default
            `}
                    >
                        <Heart className={`w-4 h-4 transition-transform ${hasLiked ? 'scale-110 fill-current' : 'group-hover:scale-110'}`} />
                    </button>
                </div>
            </div>
        </div>
    );
}
