
import React, { useState, useRef } from 'react';
import { TripInput } from '../types';
import { X, Calendar, MapPin, Users, Heart, DollarSign, Train, Home, Clock, CheckSquare, Languages, AlertCircle, Download, Upload, Sparkles } from 'lucide-react';
import AttractionExplorer from './AttractionExplorer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TripInput) => void;
}

const InputField = ({ label, icon: Icon, value, onChange, placeholder, required = false }: any) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
      <Icon className="w-4 h-4 text-brand-600" />
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type="text"
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
    />
  </div>
);

const TextAreaField = ({ label, icon: Icon, value, onChange, placeholder, required = false, actionButton }: any) => (
  <div className="mb-4">
    <div className="flex justify-between items-center mb-1">
      <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
        <Icon className="w-4 h-4 text-brand-600" />
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {actionButton}
    </div>
    <textarea
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
    />
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

  const handleExplorerConfirm = (newMustVisit: string[], newAvoid: string[]) => {
    const currentText = formData.mustVisit || '';
    
    // Sets to hold unique items
    const mustSet = new Set<string>();
    const avoidSet = new Set<string>();
    const otherLines: string[] = [];

    // Parse current text to extract existing items and preserve other notes
    currentText.split('\n').forEach(line => {
      const trimLine = line.trim();
      if (!trimLine) return;

      // Check for "Must Visit" line (supports '必去：', '必去:', etc.)
      if (trimLine.startsWith('必去') && (trimLine.includes('：') || trimLine.includes(':'))) {
        const content = trimLine.split(/[:：]/)[1] || '';
        content.split(/[、,，]/).map(s => s.trim()).filter(s => s).forEach(s => mustSet.add(s));
      } 
      // Check for "Avoid" line
      else if (trimLine.startsWith('避開') && (trimLine.includes('：') || trimLine.includes(':'))) {
        const content = trimLine.split(/[:：]/)[1] || '';
        content.split(/[、,，]/).map(s => s.trim()).filter(s => s).forEach(s => avoidSet.add(s));
      } 
      // Preserve other manual entries
      else {
        otherLines.push(trimLine); 
      }
    });

    // Merge new items
    newMustVisit.forEach(s => {
      mustSet.add(s);
      avoidSet.delete(s); // Conflict resolution: if it's now a 'must', remove from 'avoid'
    });
    
    newAvoid.forEach(s => {
      avoidSet.add(s);
      mustSet.delete(s); // Conflict resolution: if it's now 'avoid', remove from 'must'
    });

    // Reconstruct the string
    const resultLines = [];
    if (mustSet.size > 0) {
      resultLines.push(`必去：${Array.from(mustSet).join('、')}`);
    }
    if (avoidSet.size > 0) {
      resultLines.push(`避開：${Array.from(avoidSet).join('、')}`);
    }
    // Append preserved custom notes at the end
    if (otherLines.length > 0) {
      resultLines.push(...otherLines);
    }

    handleChange('mustVisit', resultLines.join('\n'));
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
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}:${pad(now.getMinutes())}`;
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
         alert("Invalid JSON file");
      }
    };
    reader.readAsText(fileObj);
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-brand-50">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              ✨ 規劃新的旅程
            </h2>
            <div className="flex items-center gap-2">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
              <button onClick={handleImportClick} className="p-2 text-brand-700 hover:bg-brand-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium" title="匯入設定">
                <Upload className="w-4 h-4" /> 匯入
              </button>
              <button onClick={handleExport} className="p-2 text-brand-700 hover:bg-brand-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium" title="匯出設定">
                <Download className="w-4 h-4" /> 匯出
              </button>
              <div className="h-4 w-px bg-gray-300 mx-1"></div>
              <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Scrollable Form Content */}
          <div className="p-6 overflow-y-auto flex-1 scrollbar-hide">
            <form id="new-trip-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg mb-6 border border-blue-100">
                <p className="text-sm text-blue-800 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  請填寫詳細資訊以獲得最佳 AI 行程規劃結果。
                </p>
              </div>

              <InputField label="目的地" icon={MapPin} value={formData.destination} onChange={(v: string) => handleChange('destination', v)} placeholder="例：日本東京" required />
              <InputField label="日期範圍與天數" icon={Calendar} value={formData.dateRange} onChange={(v: string) => handleChange('dateRange', v)} placeholder="例：10/10 - 10/17 (共 7 天)" required />
              <InputField label="旅遊人數與成員" icon={Users} value={formData.travelers} onChange={(v: string) => handleChange('travelers', v)} placeholder="例：2 位大人，1 位小孩" required />
              <InputField label="預算等級" icon={DollarSign} value={formData.budget} onChange={(v: string) => handleChange('budget', v)} placeholder="例：中等預算，總共約台幣 6 萬元" required />
              <InputField label="旅遊步調" icon={Clock} value={formData.pace} onChange={(v: string) => handleChange('pace', v)} placeholder="例：輕鬆，早上 10 點出發，晚上 8 點回飯店" required />
              <InputField label="交通偏好" icon={Train} value={formData.transport} onChange={(v: string) => handleChange('transport', v)} placeholder="例：大眾運輸為主" required />
              
              <div className="md:col-span-2">
                <InputField label="住宿資訊" icon={Home} value={formData.accommodation} onChange={(v: string) => handleChange('accommodation', v)} placeholder="例：住在新宿 4 晚，京都 3 晚" required />
              </div>

              <div className="md:col-span-2">
                <TextAreaField label="興趣與風格" icon={Heart} value={formData.interests} onChange={(v: string) => handleChange('interests', v)} placeholder="例：美食、動漫、寺廟巡禮、大自然。不喜歡人擠人。" required />
              </div>

              <div className="md:col-span-2">
                <TextAreaField 
                  label="必去景點 / 避開項目" 
                  icon={CheckSquare} 
                  value={formData.mustVisit} 
                  onChange={(v: string) => handleChange('mustVisit', v)} 
                  placeholder="必去：東京鐵塔。避開：迪士尼（人太多）。"
                  required 
                  actionButton={
                    <button 
                      type="button"
                      onClick={() => setIsExplorerOpen(true)}
                      className="text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded-md flex items-center gap-1 transition-all border border-brand-100"
                    >
                      <Sparkles className="w-3 h-3 fill-brand-600" /> ✨ AI 景點探索助手
                    </button>
                  }
                />
              </div>
              
              <div className="md:col-span-2">
                <InputField label="語言 / 單位" icon={Languages} value={formData.language} onChange={(v: string) => handleChange('language', v)} placeholder="例：繁體中文" required />
              </div>
              <div className="md:col-span-2">
                <TextAreaField label="其他限制" icon={AlertCircle} value={formData.constraints} onChange={(v: string) => handleChange('constraints', v)} placeholder="例：班機下午 5 點抵達成田。對花生過敏。" />
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">取消</button>
            <button type="submit" form="new-trip-form" className="px-6 py-2 text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors font-medium shadow-md flex items-center gap-2">生成行程</button>
          </div>
        </div>
      </div>

      <AttractionExplorer 
        isOpen={isExplorerOpen}
        onClose={() => setIsExplorerOpen(false)}
        initialLocation={formData.destination}
        initialInterests={formData.interests}
        onConfirm={handleExplorerConfirm}
      />
    </>
  );
}
