
import React, { useState } from 'react';
import { TripDay, TripStop } from '../../types';
import { safeRender } from '../../utils/formatters';
import { getStopIcon, TransportIcon } from '../../utils/icons';
import { Clock, Info, MapPin, Navigation, Sparkles, ClipboardCheck, Check, ChevronDown, ListChecks, Edit2, Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import TimePickerWheel from '../ui/TimePickerWheel';
import { getGoogleMapsSearchLink, getGoogleMapsDirectionsLink } from '../../utils/mapUtils';

interface Props {
   dayData: TripDay | undefined;
   onFocusStop: (stop: TripStop) => void;
   onUpdateStop?: (stopIdx: number, updates: Partial<TripStop>) => void;
   onExplore?: () => void;
}

// Sub-component for interactive checklist items with local state
const ChecklistItem: React.FC<{ text: string }> = ({ text }) => {
   const [isChecked, setIsChecked] = useState(false);

   return (
      <div
         onClick={() => setIsChecked(!isChecked)}
         className={`
        group flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer select-none
        ${isChecked
               ? 'bg-gray-50 border-gray-100 opacity-70'
               : 'bg-white border-gray-100 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5'
            }
      `}
      >
         <div className={`
        mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-300
        ${isChecked
               ? 'bg-brand-500 border-brand-500 scale-100'
               : 'bg-white border-gray-300 group-hover:border-brand-400'
            }
      `}>
            <Check className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${isChecked ? 'scale-100' : 'scale-0'}`} />
         </div>
         <span className={`text-sm font-medium leading-relaxed transition-all duration-200 ${isChecked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
            {safeRender(text)}
         </span>
      </div>
   );
};

export default function ItineraryTimeline({ dayData, onFocusStop, onUpdateStop, onExplore }: Props) {
   const { t } = useTranslation();
   const [isChecklistOpen, setIsChecklistOpen] = useState(true);
   const [editingStopIdx, setEditingStopIdx] = useState<number | null>(null);
   const [editValues, setEditValues] = useState<Partial<TripStop>>({});
   const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

   const handleStartEdit = (idx: number, stop: TripStop) => {
      setEditingStopIdx(idx);
      setEditValues({
         startTime: stop.startTime,
         costEstimate: stop.costEstimate
      });
      setIsTimePickerOpen(false);
   };

   const handleSaveEdit = (idx: number) => {
      if (onUpdateStop && editValues) {
         onUpdateStop(idx, editValues);
      }
      setEditingStopIdx(null);
      setEditValues({});
      setIsTimePickerOpen(false);
   };

   const handleCancelEdit = () => {
      setEditingStopIdx(null);
      setEditValues({});
      setIsTimePickerOpen(false);
   };

   if (!dayData) {
      return (
         <div className="text-center py-20 text-gray-500">
            {t('timeline.select_day')}
         </div>
      );
   }

   return (
      <div className="animate-in fade-in duration-300">
         {/* Day Header */}
         <div className="mb-4 sm:mb-6 bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1">
               <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                  <div className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold uppercase tracking-wide">
                     {t('timeline.day_label', { day: dayData.day })}
                  </div>
                  <span className="text-gray-400 text-[10px] sm:text-xs font-medium">{safeRender(dayData.date)}</span>
               </div>
               <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
                  {dayData.theme || t('timeline.day_title', { day: dayData.day })}
               </h2>
            </div>

            {onExplore && (
               <button
                  onClick={onExplore}
                  className="flex-shrink-0 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-brand-500 to-sky-500 text-white rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all font-bold text-xs sm:text-sm w-full sm:w-auto"
               >
                  <Sparkles className="w-4 h-4 text-yellow-200 fill-yellow-200" />
                  <span>{t('timeline.explore')}</span>
               </button>
            )}
         </div>

         {/* TOP: Redesigned Collapsible Checklist */}
         {dayData.dailyChecklist && dayData.dailyChecklist.length > 0 && (
            <div className="mb-8 animate-in slide-in-from-top-4 duration-500">
               <div
                  className={`
                  bg-white border text-left transition-all duration-300 overflow-hidden relative group
                  ${isChecklistOpen
                        ? 'rounded-2xl border-brand-200 shadow-lg shadow-brand-50 ring-1 ring-brand-100'
                        : 'rounded-xl border-gray-200 shadow-sm hover:border-brand-200 hover:shadow-md'
                     }
                `}
               >
                  {/* Decorative Backgroud */}
                  <div className={`absolute top-0 right-0 p-8 transition-opacity duration-500 ${isChecklistOpen ? 'opacity-100' : 'opacity-0'}`}>
                     <ClipboardCheck className="w-32 h-32 text-brand-50 -rotate-12 transform translate-x-10 -translate-y-10" />
                  </div>

                  {/* Header */}
                  <button
                     onClick={() => setIsChecklistOpen(!isChecklistOpen)}
                     className="w-full relative z-10 flex items-center justify-between p-5 bg-gradient-to-r from-white via-white to-transparent focus:outline-none"
                  >
                     <div className="flex items-center gap-4">
                        <div className={`
                          p-2.5 rounded-xl transition-colors duration-300
                          ${isChecklistOpen ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-500 group-hover:bg-brand-50 group-hover:text-brand-600'}
                        `}>
                           <ListChecks className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                           <h4 className={`text-lg font-bold transition-colors ${isChecklistOpen ? 'text-gray-900' : 'text-gray-700 group-hover:text-gray-900'}`}>
                              {t('timeline.checklist.title')}
                           </h4>
                           <div className="flex items-center gap-2 mt-1">
                              {!isChecklistOpen ? (
                                 <span className="text-xs text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100">
                                    {t('timeline.checklist.expand', { count: dayData.dailyChecklist.length })}
                                 </span>
                              ) : (
                                 <span className="text-xs text-gray-400">
                                    {t('timeline.checklist.reminder', { day: dayData.day })}
                                 </span>
                              )}
                           </div>
                        </div>
                     </div>
                     <div className={`
                        p-2 rounded-full transition-all duration-300 transform
                        ${isChecklistOpen ? 'rotate-180 bg-gray-100 text-gray-900' : 'rotate-0 text-gray-400 group-hover:bg-gray-50'}
                     `}>
                        <ChevronDown className="w-5 h-5" />
                     </div>
                  </button>

                  {/* Body (Collapsible) */}
                  <div
                     className={`
                      relative z-10 transition-all duration-500 ease-in-out border-t
                      ${isChecklistOpen ? 'max-h-[500px] opacity-100 border-gray-100' : 'max-h-0 opacity-0 border-transparent'}
                    `}
                  >
                     <div className="p-5 pt-0 bg-white/50 backdrop-blur-sm grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        {dayData.dailyChecklist.map((item, i) => (
                           <ChecklistItem key={i} text={item} />
                        ))}
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* Timeline Container */}
         <div className="relative ml-2 sm:ml-4 md:ml-6 pb-4">
            {/* Continuous Vertical Line */}
            <div className="absolute top-0 bottom-0 left-5 sm:left-8 w-0.5 bg-gray-300 transform -translate-x-1/2"></div>

            {dayData.stops?.map((stop, idx) => {
               const StopIcon = getStopIcon(stop);
               const prevStop = idx > 0 ? dayData.stops[idx - 1] : null;

               // Dynamic Link Generation
               const navigationUrl = prevStop
                  ? getGoogleMapsDirectionsLink(prevStop.name, stop.name)
                  : null;
               const placeUrl = getGoogleMapsSearchLink(stop.name);

               return (
                  <div key={idx} className="relative pl-10 sm:pl-16 pb-8 sm:pb-12 last:pb-0 group">
                     {/* Timeline Node */}
                     <div className="absolute left-5 sm:left-8 -translate-x-1/2 top-0 h-6 w-6 sm:h-8 sm:w-8 rounded-full border-2 border-brand-500 bg-white z-10 shadow-sm flex items-center justify-center transition-transform duration-300 group-hover:scale-110 flex-shrink-0">
                        <StopIcon className="w-3 h-3 sm:w-4 sm:h-4 text-brand-600 stroke-[2.5]" />
                     </div>

                     {/* Time & Transport Header */}
                     <div className="flex items-center gap-3 mb-3">
                        {editingStopIdx === idx ? (
                           <div className="relative">
                              <button
                                 onClick={() => setIsTimePickerOpen(!isTimePickerOpen)}
                                 className="font-mono text-lg font-bold text-gray-900 bg-white border border-brand-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm min-w-[80px] text-center hover:bg-brand-50 transition-colors"
                              >
                                 {editValues.startTime || '00:00'}
                              </button>
                              {isTimePickerOpen && (
                                 <TimePickerWheel
                                    value={editValues.startTime || '00:00'}
                                    onChange={(val) => setEditValues({ ...editValues, startTime: val })}
                                    onClose={() => setIsTimePickerOpen(false)}
                                 />
                              )}
                           </div>
                        ) : (
                           <span className="font-mono text-lg font-bold text-gray-900 bg-transparent">
                              {safeRender(stop.startTime)}
                           </span>
                        )}

                        {stop.transport && (
                           <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-full shadow-sm">
                              <TransportIcon text={safeRender(stop.transport) as string} />
                              <span className="truncate max-w-[150px]">{safeRender(stop.transport)}</span>
                           </div>
                        )}
                     </div>

                     {/* Card */}
                     <div className="bg-white rounded-xl p-3 sm:p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow hover:border-brand-200 relative">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4 mb-3">
                           <div className="flex-1 flex items-center gap-2 group/title">
                              <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug line-clamp-2 sm:line-clamp-1">
                                 {safeRender(stop.name)}
                              </h3>
                              {onUpdateStop && editingStopIdx !== idx && (
                                 <button
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       handleStartEdit(idx, stop);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 group-hover/title:opacity-100 transition-opacity p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-full"
                                    title={t('common.edit')}
                                 >
                                    <Edit2 className="w-3.5 h-3.5" />
                                 </button>
                              )}
                           </div>

                           <div className="text-right flex-shrink-0 flex items-center gap-2">
                              {editingStopIdx === idx ? (
                                 <div className="flex items-center gap-1">
                                    <input
                                       type="text"
                                       value={editValues.costEstimate || ''}
                                       onChange={(e) => setEditValues({ ...editValues, costEstimate: e.target.value })}
                                       className="text-sm font-bold text-brand-600 bg-white border border-brand-300 px-2 py-1 rounded-md w-24 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
                                       placeholder="Cost"
                                    />
                                    <button
                                       onClick={() => handleSaveEdit(idx)}
                                       className="p-1 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                                       title={t('common.save')}
                                    >
                                       <Save className="w-4 h-4" />
                                    </button>
                                    <button
                                       onClick={handleCancelEdit}
                                       className="p-1 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                                       title={t('common.cancel')}
                                    >
                                       <X className="w-4 h-4" />
                                    </button>
                                 </div>
                              ) : (
                                 <div className="text-sm font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-md">
                                    {safeRender(stop.costEstimate)}
                                 </div>
                              )}
                           </div>
                        </div>

                        <div className="prose prose-sm text-gray-600 mb-4 leading-relaxed">
                           {safeRender(stop.notes)}
                        </div>

                        {/* Stop Meta Data */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] sm:text-xs text-gray-500 mb-3 sm:mb-4 bg-gray-50 p-2 sm:p-3 rounded-lg border border-gray-100">
                           <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400" />
                              <span>{safeRender(stop.endTime) ? t('timeline.until', { time: safeRender(stop.endTime) }) : t('timeline.time_flexible')}</span>
                           </div>
                           <div className="flex items-center gap-2">
                              <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400" />
                              <span className="truncate">{safeRender(stop.openHours) || t('timeline.check_hours')}</span>
                           </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2 border-t border-gray-100">
                           {placeUrl && (
                              <a
                                 href={placeUrl}
                                 target="_blank"
                                 rel="noreferrer"
                                 className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors bg-brand-50 hover:bg-brand-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md"
                              >
                                 <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {t('timeline.view_map')}
                              </a>
                           )}
                           {navigationUrl && (
                              <a
                                 href={navigationUrl}
                                 target="_blank"
                                 rel="noreferrer"
                                 className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md"
                              >
                                 <Navigation className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {t('timeline.navigate')}
                              </a>
                           )}
                        </div>

                        {/* Alternatives (if any) */}
                        {stop.alternatives && stop.alternatives.length > 0 && (
                           <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                              <div className="text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">{t('timeline.alternatives')}</div>
                              <div className="flex flex-wrap gap-2">
                                 {stop.alternatives.map((alt, i) => (
                                    <span key={i} className="text-xs text-gray-600 bg-gray-50 border border-gray-200 px-2 py-1 rounded">
                                       {safeRender(alt)}
                                    </span>
                                 ))}
                              </div>
                           </div>
                        )}
                     </div>
                  </div>
               );
            })}
         </div>


      </div>
   );
}
