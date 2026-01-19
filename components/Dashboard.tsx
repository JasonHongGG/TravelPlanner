
import React, { useState, useEffect, useRef } from 'react';
import { Trip } from '../types';
import { getTripCover } from '../utils/tripUtils';
import UserProfileMenu from './UserProfileMenu';
import LanguageSwitcher from './LanguageSwitcher';
import { Plus, Map, Loader2, Calendar, Users, Trash2, Download, Upload, MapPin, ArrowRight, MoreHorizontal, Clock, Sparkles, Check, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  trips: Trip[];
  onNewTrip: () => void;
  onSelectTrip: (trip: Trip) => void;
  onDeleteTrip: (id: string) => void;
  onImportTrip: (trip: Trip) => void;
  onRetryTrip: (tripId: string) => void;
}

// ==========================================
// Sub-components
// ==========================================

// Live Timer for generating status
const LiveTimer = ({ startTime }: { startTime: number }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <span className="tabular-nums">{elapsedSeconds}s</span>;
};

// Robust Delete Button with confirmation
const DeleteButton = ({ onDelete }: { onDelete: () => void }) => {
  const [confirming, setConfirming] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (confirming) {
      const timer = setTimeout(() => setConfirming(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirming]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirming) {
      onDelete();
    } else {
      setConfirming(true);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`p-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${confirming
        ? 'bg-red-50 text-red-600 ring-1 ring-red-200 px-3'
        : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
        }`}
      title={confirming ? t('dashboard.confirm_delete_tooltip') : t('dashboard.delete_trip')}
    >
      <Trash2 className="w-4 h-4" />
      {confirming && <span className="text-[10px] font-bold">{t('dashboard.confirm_delete_text')}</span>}
    </button>
  );
};

interface TripCardProps {
  trip: Trip;
  onSelect: () => void;
  onDelete: () => void;
  onExport: (e: React.MouseEvent) => void;
  onRetry: (e: React.MouseEvent) => void;
}

// New Trip Card Component
const TripCard: React.FC<TripCardProps> = ({ trip, onSelect, onDelete, onExport, onRetry }) => {
  const { t } = useTranslation();
  // Generate a cover image based on destination
  const imageUrl = getTripCover(trip);

  return (
    <div
      onClick={onSelect}
      className="group relative bg-white rounded-xl shadow-sm hover:shadow-xl border border-gray-100 overflow-hidden transition-all duration-300 flex flex-col h-full cursor-pointer hover:-translate-y-1"
    >
      {/* Image Cover - Aspect Ratio 16:9 */}
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

        {/* Gradient Overlay for text protection if needed, or status */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />

        {/* Status Badge */}
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

      {/* Content Body */}
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

        {/* Tags / Pills */}
        <div className="flex flex-wrap gap-2 mt-auto pt-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 text-xs font-medium text-gray-600 border border-gray-100 group-hover:bg-brand-50/50 group-hover:border-brand-100 transition-colors">
            <Calendar className="w-3.5 h-3.5 text-gray-400 group-hover:text-brand-400" />
            {trip.input.dateRange}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 text-xs font-medium text-gray-600 border border-gray-100 group-hover:bg-brand-50/50 group-hover:border-brand-100 transition-colors">
            <Users className="w-3.5 h-3.5 text-gray-400 group-hover:text-brand-400" />
            {trip.input.travelers}
          </span>
        </div>
      </div>

      {/* Footer / Actions */}
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

// ==========================================
// Main Component
// ==========================================

export default function Dashboard({ trips, onNewTrip, onSelectTrip, onDeleteTrip, onImportTrip, onRetryTrip }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, i18n } = useTranslation();

  const handleExport = (e: React.MouseEvent, trip: Trip) => {
    e.preventDefault();
    e.stopPropagation();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(trip, null, 2));
    const fileName = `trip_backup_${trip.title || 'trip'}_${new Date().toISOString().slice(0, 10)}.json`;

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileObj = e.target.files && e.target.files[0];
    if (!fileObj) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        if (event.target?.result) {
          const json = JSON.parse(event.target.result as string);
          if (json.input && json.status) {
            onImportTrip(json as Trip);
          } else {
            alert(t('dashboard.invalid_file'));
          }
        }
      } catch (error) {
        console.error("Failed to parse JSON", error);
        alert(t('dashboard.read_error'));
      }
    };
    reader.readAsText(fileObj);
    e.target.value = ''; // Reset
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-brand-600 to-sky-400 p-2 rounded-xl shadow-lg shadow-brand-200">
                <Map className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-black text-gray-800 tracking-tight">{t('dashboard.app_name')}</span>
            </div>
            <div className="flex items-center gap-3">
              <UserProfileMenu />

              <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block"></div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".json"
              />
              <button
                onClick={handleImportClick}
                className="inline-flex items-center px-3 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 bg-transparent hover:bg-gray-100 rounded-lg transition-all"
              >
                <Upload className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">{t('dashboard.import')}</span>
              </button>

              <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block"></div>

              <button
                onClick={onNewTrip}
                className="inline-flex items-center px-4 py-2 text-sm font-bold rounded-xl shadow-lg shadow-brand-200 text-white bg-brand-600 hover:bg-brand-700 hover:-translate-y-0.5 transition-all"
              >
                <Plus className="w-5 h-5 mr-1" />
                <span className="hidden sm:inline">{t('dashboard.start_planning')}</span>
                <span className="sm:hidden">{t('dashboard.new_btn_short')}</span>
              </button>

              <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block"></div>

              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Hero Section */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">
              {t('dashboard.hero_title')}
            </h1>
            <p className="text-gray-500 text-lg md:max-w-4xl lg:whitespace-nowrap">
              {t('dashboard.hero_desc')}
            </p>
          </div>
          <div className="text-right hidden md:block">
            <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">{t('dashboard.created_trips')}</div>
            <div className="text-4xl font-black text-brand-600">{trips.length}</div>
          </div>
        </div>

        {/* Trip Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">

          {/* Create New Card (Refined Style) */}
          <button
            onClick={onNewTrip}
            className="group relative h-full min-h-[320px] rounded-xl border-2 border-dashed border-gray-300 hover:border-brand-400 bg-gray-50/30 hover:bg-white flex flex-col items-center justify-center text-center p-8 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden"
          >
            {/* Subtle Background Pattern */}
            <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-md group-hover:border-brand-200 transition-all duration-300">
                <Plus className="w-8 h-8 text-gray-400 group-hover:text-brand-500 transition-colors" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-brand-600 transition-colors">{t('dashboard.plan_new_trip')}</h3>
              <p
                className="text-sm text-gray-500 px-6 leading-relaxed mb-4"
                dangerouslySetInnerHTML={{ __html: t('dashboard.new_trip_desc').replace('\n', '<br />') }}
              ></p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                <Sparkles className="w-3 h-3" />
                {t('dashboard.start_now')}
              </span>
            </div>
          </button>

          {/* Trip Cards */}
          {trips.map((trip) => (
            <div key={trip.id} className="h-full">
              <TripCard
                trip={trip}
                onSelect={() => onSelectTrip(trip)}
                onDelete={() => onDeleteTrip(trip.id)}
                onExport={(e) => handleExport(e, trip)}
                onRetry={() => onRetryTrip(trip.id)}
              />
            </div>
          ))}
        </div>

        {/* Empty State Illustration (Only if no trips exist) */}
        {trips.length === 0 && (
          <div className="mt-10 flex flex-col items-center text-center opacity-50 pointer-events-none">
            <div className="w-24 h-1 bg-gray-200 rounded-full mb-4"></div>
            <p className="text-sm text-gray-400">{t('dashboard.no_trips')}</p>
          </div>
        )}

      </main>
    </div>
  );
}
