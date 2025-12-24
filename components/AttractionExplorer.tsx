
import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Plus, Minus, X, Loader2, Check, MapPin, Info, Clock, Map as MapIcon, Utensils, Mountain } from 'lucide-react';
import { AttractionRecommendation } from '../types';
import { getAttractionRecommendations } from '../services/geminiService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialLocation: string;
  initialInterests: string;
  onConfirm: (mustVisit: string[], avoid: string[]) => void;
}

type TabType = 'attraction' | 'food';

export default function AttractionExplorer({ isOpen, onClose, initialLocation, initialInterests, onConfirm }: Props) {
  const [location, setLocation] = useState(initialLocation);
  const [activeTab, setActiveTab] = useState<TabType>('attraction');
  
  const [loading, setLoading] = useState(false);
  // Store results separately
  const [results, setResults] = useState<{ attraction: AttractionRecommendation[], food: AttractionRecommendation[] }>({
    attraction: [],
    food: []
  });
  
  const [selections, setSelections] = useState<Record<string, 'must' | 'avoid' | null>>({});

  // Initial fetch when opened
  useEffect(() => {
    if (isOpen && initialLocation) {
      // If current tab is empty, fetch
      if (results[activeTab].length === 0) {
        handleSearch(true);
      }
    }
  }, [isOpen]);

  // Handle Tab Switch
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (results[tab].length === 0 && !loading) {
       // Need to trigger fetch for this new tab, pass specific tab to avoid closure stale state
       handleSearch(true, tab);
    }
  };

  const handleSearch = async (isNewSearch = true, overrideTab?: TabType) => {
    if (!location.trim()) return;
    
    const targetTab = overrideTab || activeTab;

    // FIX: If it is a new search, clear the current list immediately.
    // This forces the UI to render the full loading state instead of showing stale data.
    if (isNewSearch) {
        setResults(prev => ({
            ...prev,
            [targetTab]: []
        }));
    }
    
    setLoading(true);
    
    // If loading more, exclude current names
    // Note: If isNewSearch is true, we just cleared it above, but we also pass [] here logically.
    // If isNewSearch is false (load more), we use the existing data from state (before setResults updates it? No, react state update is async but we need current val)
    // Actually, inside the async function, 'results' is the value from render closure.
    // For 'Load More', we need the existing list.
    const existingItems = isNewSearch ? [] : results[targetTab];
    const excludeNames = existingItems.map(i => i.name);

    try {
      const newItems = await getAttractionRecommendations(location, initialInterests, targetTab, excludeNames);
      
      setResults(prev => ({
        ...prev,
        [targetTab]: isNewSearch ? newItems : [...prev[targetTab], ...newItems]
      }));

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (name: string, type: 'must' | 'avoid') => {
    setSelections(prev => ({
      ...prev,
      [name]: prev[name] === type ? null : type
    }));
  };

  const handleApply = () => {
    const mustVisit = Object.entries(selections).filter(([_, v]) => v === 'must').map(([name]) => name);
    const avoid = Object.entries(selections).filter(([_, v]) => v === 'avoid').map(([name]) => name);
    onConfirm(mustVisit, avoid);
    onClose();
  };

  const openInGoogleMaps = (name: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + location)}`;
    window.open(url, '_blank');
  };

  const currentList = results[activeTab];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-7xl h-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex-none bg-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-brand-500 fill-brand-500" />
                AI 景點探索助手
              </h2>
              <p className="text-sm text-gray-500 font-medium">根據您的目的地推薦值得一去的寶藏地點</p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <input 
                  type="text" 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(true)}
                  className="pl-10 pr-4 py-2.5 bg-gray-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-brand-500 w-full md:w-64"
                  placeholder="輸入目的地..."
                />
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              </div>
              <button 
                onClick={() => handleSearch(true)}
                disabled={loading}
                className="bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-md shadow-brand-100"
              >
                {loading && results[activeTab].length === 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                重新搜尋
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2">
             <button 
                onClick={() => handleTabChange('attraction')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                   activeTab === 'attraction' 
                     ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 shadow-sm' 
                     : 'text-gray-500 hover:bg-gray-50'
                }`}
             >
                <Mountain className="w-4 h-4" />
                探索景點
             </button>
             <button 
                onClick={() => handleTabChange('food')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                   activeTab === 'food' 
                     ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200 shadow-sm' 
                     : 'text-gray-500 hover:bg-gray-50'
                }`}
             >
                <Utensils className="w-4 h-4" />
                尋找美食
             </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50/50 scrollbar-hide">
          {loading && currentList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin"></div>
                <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-brand-600 animate-pulse" />
              </div>
              <p className="font-bold text-lg text-gray-600">正在為您挖掘{activeTab === 'attraction' ? '特色景點' : '必吃美食'}...</p>
            </div>
          ) : currentList.length > 0 ? (
            <>
              {/* Grid Layout Adjusted: Removed xl:grid-cols-4 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {currentList.map((item, idx) => {
                  // Use Bing Image Proxy for high relevance based on search query
                  // "c=7" asks for high quality cropping, "w=800" for decent resolution
                  const query = `${item.name} ${location} ${activeTab === 'food' ? 'food' : 'view'}`;
                  const realImageUrl = `https://tse2.mm.bing.net/th?q=${encodeURIComponent(query)}&w=800&h=600&c=7&rs=1&p=0`;
                  const fallbackUrl = `https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80`;

                  return (
                    <div 
                      key={`${item.name}-${idx}`} 
                      className={`group bg-white rounded-2xl overflow-hidden border transition-all duration-300 shadow-sm hover:shadow-xl flex flex-col ${
                        selections[item.name] === 'must' ? 'ring-2 ring-brand-500 border-brand-200' : 
                        selections[item.name] === 'avoid' ? 'opacity-60 grayscale' : 'border-gray-100'
                      }`}
                    >
                      {/* Image Area - Updated to match screenshot overlay style */}
                      <div className="h-52 bg-gray-200 relative overflow-hidden flex-none">
                        <img 
                          src={realImageUrl} 
                          onError={(e) => { e.currentTarget.src = fallbackUrl; }}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        
                        {/* Category Tag on Image */}
                        <div className="absolute top-3 right-3">
                           <span className="bg-black/60 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider shadow-sm border border-white/10">
                             {item.category}
                           </span>
                        </div>

                        {/* Map External Link on Image */}
                        <button 
                          onClick={() => openInGoogleMaps(item.name)}
                          className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm p-2 rounded-xl text-gray-700 hover:text-brand-600 hover:scale-110 shadow-lg transition-all group/map"
                          title="在 Google Maps 中查看"
                        >
                          <MapIcon className="w-5 h-5 group-hover/map:text-brand-600" />
                        </button>
                      </div>
                      
                      <div className="p-6 flex flex-col flex-1">
                        <div className="mb-4">
                          <h3 className="font-bold text-gray-900 text-xl mb-1 tracking-tight">{item.name}</h3>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-50 w-fit px-2 py-1 rounded-md">
                             <Clock className="w-3.5 h-3.5 text-brand-500" />
                             {item.openHours}
                          </div>
                        </div>

                        {/* Reason Box */}
                        <div className={`${activeTab === 'food' ? 'bg-orange-50 border-orange-100' : 'bg-sky-50 border-sky-100'} rounded-xl p-4 mb-4 border flex items-start gap-3`}>
                          <Sparkles className={`w-4 h-4 flex-shrink-0 mt-0.5 ${activeTab === 'food' ? 'text-orange-500' : 'text-sky-500'}`} /> 
                          <p className={`text-[13px] font-bold leading-relaxed ${activeTab === 'food' ? 'text-orange-700' : 'text-sky-700'}`}>
                            {item.reason}
                          </p>
                        </div>

                        {/* Description Quote */}
                        <p className="text-xs text-gray-500 leading-relaxed flex-1 italic mb-6 border-l-2 border-gray-200 pl-3">
                          "{item.description}"
                        </p>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-3 mt-auto">
                          <button 
                            onClick={() => toggleSelect(item.name, 'must')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-black transition-all ${
                              selections[item.name] === 'must' 
                                ? 'bg-brand-600 text-white shadow-lg shadow-brand-200 transform scale-[1.02]' 
                                : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                            }`}
                          >
                            {selections[item.name] === 'must' ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            我想去
                          </button>
                          <button 
                            onClick={() => toggleSelect(item.name, 'avoid')}
                            className={`px-5 flex items-center justify-center py-3 rounded-2xl text-xs font-bold transition-all ${
                              selections[item.name] === 'avoid' 
                                ? 'bg-gray-800 text-white transform scale-[1.02]' 
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                            title="不感興趣"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More Button */}
              <div className="mt-8 flex justify-center">
                 <button 
                   onClick={() => handleSearch(false)}
                   disabled={loading}
                   className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-8 py-3 rounded-2xl font-bold hover:bg-gray-50 hover:border-brand-300 hover:text-brand-600 transition-all shadow-sm"
                 >
                   {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                   {loading ? '載入更多中...' : '載入更多推薦'}
                 </button>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
               <Search className="w-16 h-16 mb-4 opacity-10" />
               <p className="text-lg font-medium">輸入目的地來探索推薦景點</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-white border-t border-gray-100 flex items-center justify-between flex-none">
           <div className="hidden md:flex items-center gap-4 text-sm font-medium">
              <span className="flex items-center gap-2 text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-100">
                <Check className="w-4 h-4" /> 已選 {Object.values(selections).filter(v => v === 'must').length} 個必去
              </span>
              <span className="flex items-center gap-2 text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                <Minus className="w-4 h-4" /> 排除 {Object.values(selections).filter(v => v === 'avoid').length} 個
              </span>
           </div>
           
           <div className="flex gap-4 w-full md:w-auto">
             <button onClick={onClose} className="flex-1 md:flex-none px-8 py-3.5 text-gray-600 font-bold hover:bg-gray-50 rounded-2xl transition-all">
                取消
             </button>
             <button 
                onClick={handleApply}
                disabled={Object.values(selections).filter(v => v !== null).length === 0}
                className="flex-[2] md:flex-none bg-gray-900 text-white px-12 py-3.5 rounded-2xl font-bold hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl shadow-gray-200"
             >
                確認並帶入表單
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}
