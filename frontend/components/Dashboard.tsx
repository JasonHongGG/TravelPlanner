
import React, { useRef } from 'react';
import { Trip } from '../types';
import UserProfileMenu from './UserProfileMenu';
import LanguageSwitcher from './LanguageSwitcher';
import { Plus, Map, Upload, ArrowRight, MoreHorizontal, Clock, Sparkles, Globe, Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getTripCover } from '../utils/tripUtils';
import TripCard from './dashboard/TripCard';
import { usePoints } from '../context/PointsContext';
import { tripShareService } from '../services/TripShareService';
import ExportTripModal from './ExportTripModal';
import { useStatusAlert } from '../context/StatusAlertContext';

interface Props {
  trips: Trip[];
  onNewTrip: () => void;
  onSelectTrip: (trip: Trip) => void;
  onDeleteTrip: (id: string) => void;
  onImportTrip: (trip: Trip) => void;
  onRetryTrip: (tripId: string) => void;
  onOpenGallery?: () => void;
}

// ==========================================
// Main Component
// ==========================================

export default function Dashboard({ trips, onNewTrip, onSelectTrip, onDeleteTrip, onImportTrip, onRetryTrip, onOpenGallery }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, i18n } = useTranslation();
  const { isSubscribed, openPurchaseModal } = usePoints();
  const { showAlert } = useStatusAlert(); // Hook
  const [exportModalState, setExportModalState] = React.useState<{ isOpen: boolean, trip: Trip | null }>({ isOpen: false, trip: null });
  const [importError, setImportError] = React.useState<string | null>(null);

  // Import utilities dynamically to avoid top-level await issues if any (though here likely fine)
  // But we need to use them in async functions
  // We'll import them at top level in real code, but for this tool use I'll just assume they are available via import

  const handleExportClick = (e: React.MouseEvent, trip: Trip) => {
    e.preventDefault();
    e.stopPropagation();
    setExportModalState({ isOpen: true, trip });
  };

  const performExport = async (format: 'json' | 'hong') => {
    const trip = exportModalState.trip;
    if (!trip) return;

    // Bake the current cover image into the exported data
    // This ensures consistency even if the Trip ID changes on import
    const currentCover = getTripCover(trip);
    const tripToExport = {
      ...trip,
      customCoverImage: trip.customCoverImage || currentCover
    };

    if (format === 'json') {
      // JSON export requires subscription (Backend Validation)
      // Note: We still keep frontend check for UX, but now we also call backend
      if (!isSubscribed) {
        setExportModalState({ isOpen: false, trip: null });
        openPurchaseModal('membership');
        return;
      }

      try {
        const blob = await tripShareService.exportTripJson(tripToExport);
        const fileName = `trip_${trip.title || 'backup'}_${new Date().toISOString().slice(0, 10)}.json`;

        // Download logic
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

      } catch (error: any) {
        console.error("Export failed:", error);
        if (error.message === 'Subscription required') {
          setExportModalState({ isOpen: false, trip: null });
          openPurchaseModal('membership');
        } else {
          console.error("Export error fallback", error);
          showAlert({
            type: 'error',
            title: '匯出失敗',
            description: `匯出失敗，請稍後再試: ${error.message}`
          });
        }
      }

    } else {
      // .hong format (encrypted) is FREE
      try {
        const { encryptData } = await import('../utils/encryptionUtils');
        const encryptedContent = await encryptData(tripToExport);
        const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(encryptedContent);
        const fileName = `trip_${trip.title || 'backup'}_${new Date().toISOString().slice(0, 10)}.hong`;
        downloadFile(dataStr, fileName);
      } catch (e) {
        console.error("Export failed", e);
        showAlert({
          type: 'error',
          title: '匯出失敗',
          description: '匯出失敗，請稍後再試。'
        });
      }
    }
    setExportModalState({ isOpen: false, trip: null });
  };

  const downloadFile = (dataUrl: string, fileName: string) => {
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataUrl);
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportClick = () => {
    // Both users can import now, but we check file type later
    // Actually, plan said allow all for .hong, pro only for .json
    // So we allow click, checking logic happens in handleFileChange
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileObj = e.target.files && e.target.files[0];
    if (!fileObj) return;

    // Reset value so we can select same file again if needed
    e.target.value = '';

    const fileName = fileObj.name.toLowerCase();
    const isJson = fileName.endsWith('.json');
    const isHong = fileName.endsWith('.hong');

    if (!isJson && !isHong) {
      showAlert({
        type: 'warning',
        title: '檔案格式錯誤',
        description: t('dashboard.invalid_file') || '只能上傳 .json 或 .hong 檔案'
      });
      return;
    }

    // Permission Check Removed: Import is now free for everyone (JSON & HONG)
    // if (isJson && !isSubscribed) { ... }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (event.target?.result) {
          let tripData: Trip;
          const content = event.target.result as string;

          if (isHong) {
            const { decryptData } = await import('../utils/encryptionUtils');
            tripData = await decryptData(content);
          } else {
            tripData = JSON.parse(content);
          }

          if (tripData.input && tripData.status) {
            onImportTrip(tripData);
          } else {
            showAlert({
              type: 'warning',
              title: '檔案無效',
              description: t('dashboard.invalid_file') || '檔案內容格式不正確'
            });
          }
        }
      } catch (error) {
        console.error("Failed to parse file", error);
        showAlert({
          type: 'error',
          title: '讀取錯誤',
          description: t('dashboard.read_error') || '無法讀取檔案，請確認檔案是否損毀。'
        });
      }
    };
    reader.readAsText(fileObj);
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
                accept=".json,.hong"
              />
              <button
                onClick={handleImportClick}
                className="inline-flex items-center px-3 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 bg-transparent hover:bg-gray-100 rounded-lg transition-all"
              >
                <Upload className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">{t('dashboard.import')}</span>
              </button>

              {/* Explore Gallery Button */}
              {onOpenGallery && (
                <button
                  onClick={onOpenGallery}
                  className="inline-flex items-center px-3 py-2 text-sm font-bold text-gray-600 hover:text-brand-600 bg-transparent hover:bg-brand-50 rounded-lg transition-all"
                >
                  <Compass className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">探索</span>
                </button>
              )}

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
                onExport={(e) => handleExportClick(e, trip)}
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

      {/* Export Modal */}
      <ExportTripModal
        isOpen={exportModalState.isOpen}
        onClose={() => setExportModalState({ isOpen: false, trip: null })}
        tripTitle={exportModalState.trip?.title || ''}
        onExportJson={() => performExport('json')}
        onExportHong={() => performExport('hong')}
      />
    </div>
  );
}
