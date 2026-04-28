import React, { useState } from 'react';
import { TripDay, TripStop } from '../../types';
import { Map as MapIcon, RotateCcw, ChevronUp, ChevronDown, Crosshair } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  mapState: { url: string; label: string };
  selectedDay: number;
  currentDayData: TripDay | undefined;
  onResetMap: () => void;
  onFocusStop: (stop: TripStop) => void;
}

export default function TripMap({ mapState, selectedDay, currentDayData, onResetMap, onFocusStop }: Props) {
  const { t } = useTranslation();
  const [isMapMenuOpen, setIsMapMenuOpen] = useState<boolean>(true);

  return (
    <div className="bg-gray-200 h-full relative border-l border-gray-200">
      <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
        <iframe
          title={t('map.title')}
          width="100%"
          height="100%"
          frameBorder="0"
          style={{ border: 0 }}
          src={mapState.url || "about:blank"}
          allowFullScreen
        ></iframe>

        {/* Top Right Floating Controls: Map Menu Only */}
        <div className="absolute top-6 right-6 z-20 flex items-start gap-3">

          {/* Map Route Menu */}
          <div
            className={`bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200 transition-all duration-300 overflow-hidden flex flex-col ${isMapMenuOpen ? 'w-72 max-h-[calc(100vh-120px)]' : 'w-auto'
              }`}
          >
            {/* Header */}
            <div
              className="p-3 bg-white border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setIsMapMenuOpen(!isMapMenuOpen)}
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-brand-100 rounded-lg text-brand-600">
                  <MapIcon className="w-4 h-4" />
                </div>
                {isMapMenuOpen && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                      {t('map.day_route', { day: selectedDay })}
                    </h4>
                    <p className="text-[10px] text-gray-500 font-medium">
                      {t('map.stop_count', { count: currentDayData?.stops.length || 0 })}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 pl-2">
                {isMapMenuOpen ? (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); onResetMap(); }}
                      className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-brand-600 transition-colors"
                      title={t('map.reset_view')}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <div className="h-4 w-px bg-gray-200 mx-0.5"></div>
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  </>
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>

            {/* Expanded List */}
            {isMapMenuOpen && currentDayData && (
              <div className="overflow-y-auto p-2 space-y-1 scrollbar-hide bg-gray-50/50">
                {currentDayData.stops.map((stop, idx) => (
                  <div key={idx} className="group flex items-center justify-between p-2 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-200 text-gray-600 group-hover:bg-brand-100 group-hover:text-brand-600 flex items-center justify-center text-[10px] font-bold transition-colors">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-medium text-gray-600 truncate group-hover:text-gray-900 transition-colors max-w-[140px]">
                        {stop.name}
                      </span>
                    </div>
                    <button
                      onClick={() => onFocusStop(stop)}
                      className="p-1.5 text-gray-300 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                      title={t('map.locate')}
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}