
import React, { useState, useRef } from 'react';
import { TripInput } from '../types';
import { X, Calendar, MapPin, Users, Heart, DollarSign, Train, Home, Clock, CheckSquare, Languages, AlertCircle, Download, Upload, Sparkles, Plane, Briefcase, Coins, ArrowRight } from 'lucide-react';
import AttractionExplorer from './AttractionExplorer';
import { usePoints } from '../context/PointsContext';
import { calculateTripCost } from '../utils/tripUtils';
import DateRangePicker from './DateRangePicker';
import { useTranslation } from 'react-i18next';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TripInput) => void;
}

// Enhanced Input Field with clearer borders and interaction states
const InputField = ({ label, icon: Icon, value, onChange, placeholder, required = false }: any) => (
  <div className="mb-5 group">
    <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2 transition-colors group-focus-within:text-brand-600">
      <div className="p-1 rounded-md bg-white border border-gray-200 text-gray-500 group-focus-within:bg-brand-50 group-focus-within:text-brand-600 group-focus-within:border-brand-200 transition-colors shadow-sm">
        <Icon className="w-3.5 h-3.5" />
      </div>
      {label} {required && <span className="text-red-500 text-xs font-bold">*</span>}
    </label>
    <input
      type="text"
      className="w-full px-4 py-3 bg-white border border-gray-300 text-gray-900 rounded-xl shadow-sm focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 hover:border-gray-400 transition-all placeholder:text-gray-400 font-medium"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
    />
  </div>
);

// Enhanced Textarea with matching style
const TextAreaField = ({ label, icon: Icon, value, onChange, placeholder, required = false, actionButton }: any) => (
  <div className="mb-5 group">
    <div className="flex justify-between items-center mb-1.5">
      <label className="block text-sm font-bold text-gray-700 flex items-center gap-2 transition-colors group-focus-within:text-brand-600">
        <div className="p-1 rounded-md bg-white border border-gray-200 text-gray-500 group-focus-within:bg-brand-50 group-focus-within:text-brand-600 group-focus-within:border-brand-200 transition-colors shadow-sm">
          <Icon className="w-3.5 h-3.5" />
        </div>
        {label} {required && <span className="text-red-500 text-xs font-bold">*</span>}
      </label>
      {actionButton && <div className="animate-in fade-in slide-in-from-right-2">{actionButton}</div>}
    </div>
    <textarea
      className="w-full px-4 py-3 bg-white border border-gray-300 text-gray-900 rounded-xl shadow-sm focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 hover:border-gray-400 transition-all placeholder:text-gray-400 font-medium min-h-[100px] leading-relaxed resize-y"
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
    />
  </div>
);

// Section Divider
const SectionHeader = ({ title }: { title: string }) => (
  <div className="col-span-1 md:col-span-2 mt-4 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</h3>
  </div>
);

export default function NewTripForm({ isOpen, onClose, onSubmit }: Props) {
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Sync language with current i18n setting when form opens
  React.useEffect(() => {
    if (isOpen) {
      const getPromptLanguage = (lng: string) => {
        switch (lng) {
          case 'en-US': return 'English';
          case 'ja-JP': return 'Japanese';
          case 'ko-KR': return 'Korean';
          default: return 'Traditional Chinese';
        }
      };
      setFormData(prev => ({ ...prev, language: getPromptLanguage(i18n.language) }));
    }
  }, [isOpen, i18n.language]);

  // Parse initial dates from string if present (for editing or previous drafts)
  // Simple heuristic: just start clean or parse if needed. For now start clean or user picks.
  const [dateSelection, setDateSelection] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });



  const { balance, openPurchaseModal, isSubscribed, config } = usePoints();

  // Map i18n code to prompt language name
  const getPromptLanguage = (lng: string) => {
    switch (lng) {
      case 'en-US': return 'English';
      case 'ja-JP': return 'Japanese';
      case 'ko-KR': return 'Korean';
      default: return 'Traditional Chinese';
    }
  };

  const [formData, setFormData] = useState<TripInput>({
    dateRange: '',
    destination: '',
    travelers: '',
    interests: '',
    budget: '',
    transport: '',
    accommodation: '',
    pace: '',
    mustVisit: '',
    language: getPromptLanguage(i18n.language),
    constraints: ''
  });

  const handleChange = (key: keyof TripInput, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // Calculate real-time cost
  const estimatedCost = calculateTripCost(formData.dateRange, config.TRIP_BASE_COST, config.TRIP_DAILY_COST);
  const finalCost = isSubscribed ? 0 : estimatedCost; // Subscriber benefit

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowPointsModal(true);
  };



  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(formData, null, 2));
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}`;
    const safeDest = formData.destination ? formData.destination.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() : 'draft';
    const fileName = `trip_config_${safeDest}_${timestamp}.json`;

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
          setFormData(prev => ({ ...prev, ...json }));
        }
      } catch (error) {
        console.error("Failed to parse JSON", error);
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(fileObj);
    e.target.value = '';
  };

  const handleExplorerConfirm = (must: string[], avoid: string[]) => {
    const currentText = formData.mustVisit || '';
    const mustSet = new Set<string>();
    const avoidSet = new Set<string>();
    const otherLines: string[] = [];

    currentText.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (/^(必去|Must)/i.test(trimmed)) {
        const content = trimmed.replace(/^(必去|Must)\s*[:：]?\s*/i, '');
        content.split(/[、,，]+/).map(s => s.trim()).filter(Boolean).forEach(s => mustSet.add(s));
      } else if (/^(避開|Avoid)/i.test(trimmed)) {
        const content = trimmed.replace(/^(避開|Avoid)\s*[:：]?\s*/i, '');
        content.split(/[、,，]+/).map(s => s.trim()).filter(Boolean).forEach(s => avoidSet.add(s));
      } else {
        otherLines.push(trimmed);
      }
    });

    must.forEach(item => mustSet.add(item));
    avoid.forEach(item => avoidSet.add(item));
    must.forEach(item => avoidSet.delete(item));
    avoid.forEach(item => mustSet.delete(item));

    const newLines = [...otherLines];
    if (mustSet.size > 0) newLines.push(`必去：${Array.from(mustSet).join('、')}`);
    if (avoidSet.size > 0) newLines.push(`避開：${Array.from(avoidSet).join('、')}`);

    setFormData(prev => ({ ...prev, mustVisit: newLines.join('\n') }));
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

        {/* Modal Container */}
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative z-10 animate-in fade-in zoom-in-95 duration-200 border border-gray-100">

          {/* Header - Modern & Clean */}
          <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-start bg-white sticky top-0 z-20">
            <div>
              <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-sky-500 mb-1 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-brand-500 fill-brand-500" />
                {t('new_trip.title')}
              </h2>
              <p className="text-sm text-gray-500 font-medium">{t('new_trip.subtitle')}</p>
            </div>

            <div className="flex items-center gap-2">
              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".json"
              />

              {/* Utility Buttons */}
              <div className="hidden sm:flex bg-gray-50 rounded-lg p-1 mr-2 border border-gray-100">
                <button
                  onClick={handleImportClick}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-brand-600 hover:bg-white rounded-md transition-all shadow-sm hover:shadow"
                  title={t('new_trip.import')}
                >
                  <Upload className="w-3.5 h-3.5 inline mr-1" /> {t('new_trip.import')}
                </button>
                <button
                  onClick={handleExport}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-brand-600 hover:bg-white rounded-md transition-all shadow-sm hover:shadow"
                  title={t('new_trip.export')}
                >
                  <Download className="w-3.5 h-3.5 inline mr-1" /> {t('new_trip.export')}
                </button>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Form Content - Scrollable */}
          <div className="flex-1 overflow-y-auto px-8 py-6 scrollbar-hide bg-gray-50/30">
            <form id="new-trip-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">

              <SectionHeader title={t('new_trip.basic_info')} />

              <InputField
                label={t('new_trip.destination')}
                icon={MapPin}
                value={formData.destination}
                onChange={(v: string) => handleChange('destination', v)}
                placeholder={t('new_trip.destination_placeholder')}
                required
              />

              <div className="mb-5 group relative" ref={datePickerRef}>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2 transition-colors group-focus-within:text-brand-600">
                  <div className="p-1 rounded-md bg-white border border-gray-200 text-gray-500 group-focus-within:bg-brand-50 group-focus-within:text-brand-600 group-focus-within:border-brand-200 transition-colors shadow-sm">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  {t('new_trip.date_label')} <span className="text-red-500 text-xs font-bold">*</span>
                </label>

                <div
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  className={`w-full px-4 py-3 bg-white border cursor-pointer text-gray-900 rounded-xl shadow-sm transition-all font-medium flex items-center justify-between ${isDatePickerOpen ? 'border-brand-500 ring-4 ring-brand-500/10' : 'border-gray-300 hover:border-gray-400'
                    }`}
                >
                  <span className={formData.dateRange ? 'text-gray-900' : 'text-gray-400'}>
                    {formData.dateRange || t('new_trip.date_placeholder')}
                  </span>
                  <Calendar className="w-4 h-4 text-gray-400" />
                </div>

                {isDatePickerOpen && (
                  <DateRangePicker
                    startDate={dateSelection.start}
                    endDate={dateSelection.end}
                    onChange={(start, end) => {
                      setDateSelection({ start, end });
                      if (start && end) {
                        // Format: YYYY/MM/DD - YYYY/MM/DD (N Days)
                        const fmt = (d: Date) => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
                        const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
                        const str = `${fmt(start)} - ${fmt(end)} ${t('new_trip.days_count', { count: diff })}`;
                        handleChange('dateRange', str);
                        if (JSON.stringify(dateSelection) !== JSON.stringify({ start, end })) {
                          setIsDatePickerOpen(false); // Close on selection completion
                        }
                      }
                    }}
                    onClose={() => setIsDatePickerOpen(false)}
                  />
                )}
              </div>

              <InputField
                label={t('new_trip.travelers')}
                icon={Users}
                value={formData.travelers}
                onChange={(v: string) => handleChange('travelers', v)}
                placeholder={t('new_trip.travelers_placeholder')}
                required
              />

              <InputField
                label={t('new_trip.budget')}
                icon={DollarSign}
                value={formData.budget}
                onChange={(v: string) => handleChange('budget', v)}
                placeholder={t('new_trip.budget_placeholder')}
                required
              />

              <SectionHeader title={t('new_trip.style_preferences')} />

              <InputField
                label={t('new_trip.pace')}
                icon={Clock}
                value={formData.pace}
                onChange={(v: string) => handleChange('pace', v)}
                placeholder={t('new_trip.pace_placeholder')}
                required
              />

              <InputField
                label={t('new_trip.transport')}
                icon={Train}
                value={formData.transport}
                onChange={(v: string) => handleChange('transport', v)}
                placeholder={t('new_trip.transport_placeholder')}
                required
              />

              <div className="md:col-span-2">
                <InputField
                  label={t('new_trip.accommodation')}
                  icon={Home}
                  value={formData.accommodation}
                  onChange={(v: string) => handleChange('accommodation', v)}
                  placeholder={t('new_trip.accommodation_placeholder')}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <TextAreaField
                  label={t('new_trip.interests')}
                  icon={Heart}
                  value={formData.interests}
                  onChange={(v: string) => handleChange('interests', v)}
                  placeholder={t('new_trip.interests_placeholder')}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <TextAreaField
                  label={t('new_trip.must_avoid')}
                  icon={CheckSquare}
                  value={formData.mustVisit}
                  onChange={(v: string) => handleChange('mustVisit', v)}
                  placeholder={t('new_trip.must_avoid_placeholder')}
                  required
                  actionButton={
                    <button
                      type="button"
                      onClick={() => setIsExplorerOpen(true)}
                      className="text-xs font-bold text-white bg-gradient-to-r from-brand-500 to-sky-500 hover:from-brand-600 hover:to-sky-600 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5 border border-white/20"
                    >
                      <Sparkles className="w-3 h-3 text-yellow-200 fill-yellow-200" /> {t('new_trip.ai_explorer')}
                    </button>
                  }
                />
              </div>

              <SectionHeader title={t('new_trip.other_details')} />

              <div className="md:col-span-1">
                <InputField
                  label={t('new_trip.language')}
                  icon={Languages}
                  value={formData.language}
                  onChange={(v: string) => handleChange('language', v)}
                  placeholder={t('new_trip.language_placeholder')}
                  required
                />
              </div>

              <div className="md:col-span-1">
                <InputField
                  label={t('new_trip.constraints')}
                  icon={AlertCircle}
                  value={formData.constraints}
                  onChange={(v: string) => handleChange('constraints', v)}
                  placeholder={t('new_trip.constraints_placeholder')}
                />
              </div>

            </form>
          </div>

          {/* Footer - Fixed */}
          <div className="px-8 py-5 border-t border-gray-100 bg-white flex justify-end gap-3 rounded-b-3xl">
            <div className="flex items-center gap-4 mr-auto">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('new_trip.estimated_cost')}</span>
                <span className="text-lg font-black text-brand-600 flex items-center gap-1">
                  {estimatedCost} <span className="text-xs font-bold text-brand-400">PTS</span>
                </span>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('new_trip.current_balance')}</span>
                <span className={`text-lg font-black flex items-center gap-1 ${balance < estimatedCost ? 'text-red-500' : 'text-gray-700'}`}>
                  {balance} <span className={`text-xs font-bold ${balance < estimatedCost ? 'text-red-300' : 'text-gray-400'}`}>PTS</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-gray-600 bg-white border border-gray-300 hover:border-gray-400 rounded-xl hover:bg-gray-50 transition-all font-bold text-sm"
            >
              {t('new_trip.cancel')}
            </button>
            <button
              type="submit"
              form="new-trip-form"
              className="px-8 py-2.5 text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-all font-bold text-sm shadow-lg shadow-brand-200 hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2"
            >
              <Plane className="w-4 h-4" />
              {t('new_trip.start_generating')}
            </button>
          </div>
        </div>
      </div>

      <AttractionExplorer
        isOpen={isExplorerOpen}
        onClose={() => setIsExplorerOpen(false)}
        initialLocation={formData.destination}
        initialInterests={formData.interests}
        onConfirm={handleExplorerConfirm}
        currentStops={[]}
        mode="planning"
      />

      <AttractionExplorer
        isOpen={isExplorerOpen}
        onClose={() => setIsExplorerOpen(false)}
        initialLocation={formData.destination}
        initialInterests={formData.interests}
        onConfirm={handleExplorerConfirm}
        currentStops={[]}
        mode="planning"
      />

      {/* Premium Confirmation Modal */}
      {showPointsModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header Gradient */}
            <div className="bg-gradient-to-r from-brand-600 to-sky-500 px-6 py-6 text-white relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-white/10">
                <Sparkles className="w-24 h-24" />
              </div>
              <h3 className="text-xl font-bold relative z-10 flex items-center gap-2">
                <Plane className="w-5 h-5" />
                {t('new_trip.confirm_title')}
              </h3>
              <p className="text-brand-100 text-sm mt-1 relative z-10">
                {t('new_trip.confirm_subtitle')}
              </p>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="text-gray-500 text-sm">{t('new_trip.destination')}</div>
                <div className="font-bold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-500" />
                  {formData.destination}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t('new_trip.planning_fee')}</span>
                  <span className="font-medium">{estimatedCost} 點</span>
                </div>
                <div className="h-px bg-gray-100 my-2"></div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">{t('new_trip.total_cost')}</span>
                  <span className="font-black text-xl text-brand-600 flex items-center gap-1">
                    <Coins className="w-5 h-5" />
                    {isSubscribed ? (
                      <>
                        <span className="line-through text-gray-400 text-base mr-1">{estimatedCost}</span>
                        <span>{t('new_trip.member_free')}</span>
                      </>
                    ) : (
                      finalCost
                    )}
                  </span>
                </div>
              </div>

              {/* Balance Preview */}
              <div className="mt-6 bg-brand-50/50 rounded-xl p-3 flex items-center justify-between text-sm">
                <div className="flex flex-col">
                  <span className="text-gray-500 text-xs">{t('new_trip.current_balance')}</span>
                  <span className="font-bold text-gray-700">{balance}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <div className="flex flex-col items-end">
                  <span className="text-gray-500 text-xs">{t('new_trip.remaining_points')}</span>
                  <span className={`font-bold ${balance - finalCost < 0 ? 'text-red-600' : 'text-brand-600'}`}>
                    {balance - finalCost}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-8">
                <button
                  onClick={() => setShowPointsModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                >
                  {t('new_trip.cancel')}
                </button>

                {balance < finalCost ? (
                  <button
                    onClick={() => {
                      setShowPointsModal(false);
                      openPurchaseModal(); // Redirect to global purchase modal
                      // Note: We might want to keep NewTripForm open? Yes, default behavior keeps it open behind.
                    }}
                    className="px-4 py-2.5 rounded-xl bg-gray-900 text-white font-bold hover:bg-black transition-all shadow-lg shadow-gray-200 flex items-center justify-center gap-2"
                  >
                    {t('insufficient_points.go_to_store')}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onSubmit(formData);
                      onClose();
                      setShowPointsModal(false);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 flex items-center justify-center gap-2"
                  >
                    {t('new_trip.confirmed_payment')}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
