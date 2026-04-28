import React from 'react';
import { Trip } from '../../types';
import { getTripCover } from '../../utils/tripUtils';
import { Calendar, Check, Download, Languages, Loader2, MapPin, RefreshCw, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LiveTimer from './LiveTimer';
import DeleteButton from './DeleteButton';

interface TripCardProps {
  trip: Trip;
  onSelect: () => void;
  onDelete: () => void;
  onExport: (e: React.MouseEvent) => void;
  onRetry: (e: React.MouseEvent) => void;
}

const TripCard: React.FC<TripCardProps> = ({ trip, onSelect, onDelete, onExport, onRetry }) => {
  const { t } = useTranslation();
  const imageUrl = getTripCover(trip);

  return (
    <div
      onClick={onSelect}
      className="group relative bg-white rounded-xl shadow-sm hover:shadow-xl border border-gray-100 overflow-hidden transition-all duration-300 flex flex-col h-full cursor-pointer hover:-translate-y-1"
    >
      <div className="relative aspect-video bg-gray-200 overflow-hidden">
        <img
          src={imageUrl}
          alt={trip.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          onError={(e) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80';
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />

        <div className="absolute top-3 right-3 flex gap-2">
          {trip.status === 'generating' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-white/90 text-brand-600 backdrop-blur-md shadow-sm">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t('dashboard.status_generating')} <LiveTimer startTime={trip.createdAt} />
            </span>
          )}
          {trip.status === 'complete' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-white/90 text-green-600 backdrop-blur-md shadow-sm animate-in fade-in zoom-in">
              <Check className="w-3 h-3" />
              {t('dashboard.status_complete')} {trip.generationTimeMs ? (trip.generationTimeMs / 1000).toFixed(1) : 0}s
            </span>
          )}
          {trip.status === 'error' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry(e);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-red-500 text-white shadow-sm hover:bg-red-600 transition-colors z-10 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              {t('dashboard.status_failed')}
            </button>
          )}
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="mb-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-bold text-gray-900 leading-snug line-clamp-1 group-hover:text-brand-600 transition-colors">
              {trip.title || trip.input.destination}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mt-1">
            <MapPin className="w-3.5 h-3.5 text-gray-400" />
            <span className="truncate">{trip.input.destination}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-auto pt-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 text-xs font-medium text-gray-600 border border-gray-100 group-hover:bg-brand-50/50 group-hover:border-brand-100 transition-colors">
            <Calendar className="w-3.5 h-3.5 text-gray-400 group-hover:text-brand-400" />
            {trip.input.dateRange}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 text-xs font-medium text-gray-600 border border-gray-100 group-hover:bg-brand-50/50 group-hover:border-brand-100 transition-colors">
            <Users className="w-3.5 h-3.5 text-gray-400 group-hover:text-brand-400" />
            {trip.input.travelers}
          </span>
          {trip.input.language && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 text-xs font-medium text-gray-600 border border-gray-100 group-hover:bg-brand-50/50 group-hover:border-brand-100 transition-colors">
              <Languages className="w-3.5 h-3.5 text-gray-400 group-hover:text-brand-400" />
              {trip.input.language}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/30 flex items-center justify-between">
        <span className="text-[10px] text-gray-400 font-medium font-mono">
          {new Date(trip.createdAt).toLocaleDateString()}
        </span>

        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={onExport}
            className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
            title={t('dashboard.export_backup')}
          >
            <Download className="w-4 h-4" />
          </button>
          <DeleteButton onDelete={onDelete} />
        </div>
      </div>
    </div>
  );
};

export default TripCard;
