
import React, { useState, useRef } from 'react';
import { TripInput } from '../types';
import { X, Calendar, MapPin, Users, Heart, DollarSign, Train, Home, Clock, CheckSquare, Languages, AlertCircle, Download, Upload, Sparkles, Plane, Briefcase } from 'lucide-react';
import AttractionExplorer from './AttractionExplorer';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  
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
    language: '繁體中文',
    constraints: ''
  });

  const handleChange = (key: keyof TripInput, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
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
                    開始您的旅程
                </h2>
                <p className="text-sm text-gray-500 font-medium">填寫下表，讓 AI 為您打造完美的專屬行程</p>
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
                      title="匯入設定檔"
                   >
                      <Upload className="w-3.5 h-3.5 inline mr-1" /> 匯入
                   </button>
                   <button 
                      onClick={handleExport}
                      className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-brand-600 hover:bg-white rounded-md transition-all shadow-sm hover:shadow"
                      title="匯出設定檔"
                   >
                      <Download className="w-3.5 h-3.5 inline mr-1" /> 匯出
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
              
              <SectionHeader title="基本資訊 Basic Info" />

              <InputField 
                label="目的地" 
                icon={MapPin} 
                value={formData.destination} 
                onChange={(v: string) => handleChange('destination', v)} 
                placeholder="例：日本東京" 
                required 
              />
              
              <InputField 
                label="日期範圍與天數" 
                icon={Calendar} 
                value={formData.dateRange} 
                onChange={(v: string) => handleChange('dateRange', v)} 
                placeholder="例：10/10 - 10/17 (共 7 天)" 
                required 
              />

              <InputField 
                label="旅遊人數" 
                icon={Users} 
                value={formData.travelers} 
                onChange={(v: string) => handleChange('travelers', v)} 
                placeholder="例：2 大人, 1 小孩" 
                required 
              />

              <InputField 
                label="預算等級" 
                icon={DollarSign} 
                value={formData.budget} 
                onChange={(v: string) => handleChange('budget', v)} 
                placeholder="例：中等預算，約台幣 6 萬" 
                required 
              />
              
              <SectionHeader title="旅行風格 Preferences" />

              <InputField 
                label="步調" 
                icon={Clock} 
                value={formData.pace} 
                onChange={(v: string) => handleChange('pace', v)} 
                placeholder="例：輕鬆，早上 10 點出發"
                required 
              />

              <InputField 
                label="交通偏好" 
                icon={Train} 
                value={formData.transport} 
                onChange={(v: string) => handleChange('transport', v)} 
                placeholder="例：大眾運輸為主"
                required 
              />

              <div className="md:col-span-2">
                 <InputField 
                  label="住宿安排" 
                  icon={Home} 
                  value={formData.accommodation} 
                  onChange={(v: string) => handleChange('accommodation', v)} 
                  placeholder="例：住在新宿 4 晚，京都 3 晚"
                  required 
                />
              </div>

              <div className="md:col-span-2">
                <TextAreaField 
                  label="興趣與主題" 
                  icon={Heart} 
                  value={formData.interests} 
                  onChange={(v: string) => handleChange('interests', v)} 
                  placeholder="例：喜歡美食、動漫、寺廟巡禮、大自然。不喜歡人擠人。"
                  required 
                />
              </div>

              <div className="md:col-span-2">
                <TextAreaField 
                  label="必去景點 / 避開項目" 
                  icon={CheckSquare} 
                  value={formData.mustVisit} 
                  onChange={(v: string) => handleChange('mustVisit', v)} 
                  placeholder="必去：東京鐵塔。避開：迪士尼。"
                  required 
                  actionButton={
                    <button 
                      type="button"
                      onClick={() => setIsExplorerOpen(true)}
                      className="text-xs font-bold text-white bg-gradient-to-r from-brand-500 to-sky-500 hover:from-brand-600 hover:to-sky-600 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5 border border-white/20"
                    >
                      <Sparkles className="w-3 h-3 text-yellow-200 fill-yellow-200" /> AI 探索助手
                    </button>
                  }
                />
              </div>
              
              <SectionHeader title="其他細節 Details" />

              <div className="md:col-span-1">
                <InputField 
                    label="語言" 
                    icon={Languages} 
                    value={formData.language} 
                    onChange={(v: string) => handleChange('language', v)} 
                    placeholder="例：繁體中文"
                    required 
                />
              </div>
              
              <div className="md:col-span-1">
                <InputField 
                  label="特殊限制" 
                  icon={AlertCircle} 
                  value={formData.constraints} 
                  onChange={(v: string) => handleChange('constraints', v)} 
                  placeholder="例：過敏、班機時間..." 
                />
              </div>

            </form>
          </div>

          {/* Footer - Fixed */}
          <div className="px-8 py-5 border-t border-gray-100 bg-white flex justify-end gap-3 rounded-b-3xl">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-2.5 text-gray-600 bg-white border border-gray-300 hover:border-gray-400 rounded-xl hover:bg-gray-50 transition-all font-bold text-sm"
            >
              取消
            </button>
            <button 
              type="submit" 
              form="new-trip-form"
              className="px-8 py-2.5 text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-all font-bold text-sm shadow-lg shadow-brand-200 hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2"
            >
               <Plane className="w-4 h-4" />
               開始生成行程
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
    </>
  );
}
