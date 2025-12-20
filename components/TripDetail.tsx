import React, { useState, useEffect } from 'react';
import { Trip, TripData, TripMeta, TripStop, TripDay, Message } from '../types';
import { MapPin, Clock, DollarSign, Navigation, ExternalLink, AlertTriangle, Calendar, Info, ArrowRight, Share2, Printer, CheckCircle2, Car, Train, Footprints, Utensils, ShoppingBag, Landmark, TreeDeciduous, Camera, Coffee, Ticket, List, RotateCcw, Crosshair, ChevronDown, ChevronUp, Map as MapIcon, XCircle, Calculator, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';
import Assistant from './Assistant';
import { updateTripItinerary } from '../services/geminiService';

interface Props {
  trip: Trip;
  onBack: () => void;
  onUpdateTrip: (tripId: string, newData: TripData) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

// Helper to safely render content
const safeRender = (content: any): React.ReactNode => {
  if (typeof content === 'string') return content;
  if (typeof content === 'number') return content;
  if (typeof content === 'object' && content !== null) {
    if (content.description) return content.description;
    if (content.text) return content.text;
    if (content.type) return `${content.type}: ${content.description || ''}`;
    return JSON.stringify(content);
  }
  return '';
};

// Helper to parse cost string to number (e.g., "¥2000" -> 2000)
const parseCostToNumber = (costStr: string | undefined): number => {
  if (!costStr) return 0;
  // Remove commas and non-numeric chars except digits (and maybe dots if we want decimals, but usually int for Yen)
  // We'll take the first sequence of digits found.
  const clean = costStr.replace(/,/g, ''); 
  const match = clean.match(/(\d+)/);
  if (match) {
    return parseInt(match[0], 10);
  }
  return 0;
};

// Helper icon for transport
const TransportIcon = ({ text }: { text: string }) => {
  const lower = text.toLowerCase();
  if (lower.includes('walk') || lower.includes('foot') || lower.includes('步行') || lower.includes('走')) return <Footprints className="w-3 h-3" />;
  if (lower.includes('car') || lower.includes('drive') || lower.includes('taxi') || lower.includes('uber') || lower.includes('車') || lower.includes('計程車')) return <Car className="w-3 h-3" />;
  if (lower.includes('train') || lower.includes('subway') || lower.includes('rail') || lower.includes('shinkansen') || lower.includes('鐵') || lower.includes('新幹線') || lower.includes('捷運')) return <Train className="w-3 h-3" />;
  return <Navigation className="w-3 h-3" />;
};

// Helper to deduce icon from stop details
const getStopIcon = (stop: TripStop) => {
  const text = (stop.name + ' ' + (stop.notes || '')).toLowerCase();
  
  // Dining (餐飲)
  if (
    text.includes('lunch') || text.includes('dinner') || text.includes('breakfast') || 
    text.includes('eat') || text.includes('restaurant') || text.includes('food') || 
    text.includes('izakaya') || text.includes('ramen') || text.includes('sushi') ||
    text.includes('午餐') || text.includes('晚餐') || text.includes('早餐') || 
    text.includes('餐廳') || text.includes('美食') || text.includes('料理') || 
    text.includes('燒肉') || text.includes('居酒屋') || text.includes('食') ||
    text.includes('食堂') || text.includes('懷石') || text.includes('小吃')
  ) return Utensils;

  // Coffee/Dessert (咖啡/甜點 -> 歸類為餐飲)
  if (
    text.includes('coffee') || text.includes('cafe') || text.includes('tea') || text.includes('dessert') ||
    text.includes('咖啡') || text.includes('甜點') || text.includes('下午茶') || text.includes('喫茶') ||
    text.includes('蛋糕') || text.includes('冰淇淋') || text.includes('茶屋')
  ) return Coffee;

  // Shopping (購物 -> 歸類為其他)
  if (
    text.includes('shop') || text.includes('mall') || text.includes('store') || text.includes('market') || 
    text.includes('buy') || text.includes('souvenir') ||
    text.includes('購物') || text.includes('商場') || text.includes('百貨') || text.includes('商店') || 
    text.includes('市集') || text.includes('伴手禮') || text.includes('藥妝') || text.includes('outlet') ||
    text.includes('唐吉訶德') || text.includes('don quijote') || text.includes('超市')
  ) return ShoppingBag;

  // Nature (自然 -> 歸類為門票/景點)
  if (
    text.includes('park') || text.includes('garden') || text.includes('nature') || text.includes('mountain') || 
    text.includes('hike') || text.includes('beach') ||
    text.includes('公園') || text.includes('花園') || text.includes('御苑') || text.includes('山') || 
    text.includes('川') || text.includes('湖') || text.includes('海') || text.includes('散步')
  ) return TreeDeciduous;

  // Landmark/Culture (地標 -> 歸類為門票/景點)
  if (
    text.includes('museum') || text.includes('gallery') || text.includes('temple') || text.includes('shrine') || 
    text.includes('church') || text.includes('castle') || text.includes('palace') || text.includes('tower') ||
    text.includes('寺') || text.includes('神社') || text.includes('宮') || text.includes('城') || 
    text.includes('塔') || text.includes('博物館') || text.includes('美術館') || text.includes('紀念') ||
    text.includes('大佛')
  ) return Landmark;

  // Sightseeing/Photo (觀光 -> 歸類為門票/景點)
  if (
    text.includes('photo') || text.includes('view') || text.includes('observation') || text.includes('sight') ||
    text.includes('展望') || text.includes('夜景') || text.includes('景色') || text.includes('拍照') ||
    text.includes('打卡') || text.includes('巡禮')
  ) return Camera;

  // Tickets/Amusement (門票/樂園 -> 歸類為門票)
  if (
    text.includes('ticket') || text.includes('entrance') || text.includes('disney') || text.includes('universal') ||
    text.includes('門票') || text.includes('入場') || text.includes('樂園') || text.includes('影城') || 
    text.includes('迪士尼') || text.includes('動物園') || text.includes('水族館') || text.includes('遊樂園')
  ) return Ticket;
  
  // Transport Hubs (交通樞紐)
  if (
      text.includes('station') || text.includes('airport') || text.includes('terminal') ||
      text.includes('車站') || text.includes('駅') || text.includes('機場') || text.includes('空港') || text.includes('航廈') ||
      text.includes('轉運站')
  ) return Train;

  return MapPin;
};

// Helper to calculate the correct map configuration (Route vs Single City)
const getDayMapConfig = (day: TripDay | undefined, destination: string) => {
    const city = destination;
    if (day && day.stops && day.stops.length > 0) {
        if (day.stops.length === 1) {
            // Single Stop Focus
            const stopName = day.stops[0].name;
            const query = `${stopName}, ${city}`;
            return {
                url: `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=14&ie=UTF8&iwloc=&output=embed`,
                label: `Focusing on: ${stopName}`
            };
        } else {
            // Route Planning Mode (Start -> Waypoints -> End)
            const stops = day.stops;
            const origin = `${stops[0].name}, ${city}`;
            
            // Remaining stops are destinations/waypoints
            // "daddr" supports multiple locations separated by "+to:"
            const destinations = stops.slice(1).map(s => `${s.name}, ${city}`);
            
            const encodedOrigin = encodeURIComponent(origin);
            const encodedDestinations = destinations.map(d => encodeURIComponent(d)).join('+to:');
            
            return {
                url: `https://maps.google.com/maps?saddr=${encodedOrigin}&daddr=${encodedDestinations}&output=embed`,
                label: `Day ${day.day} Route • ${stops.length} Stops`
            };
        }
    } else {
        // Fallback to City View
        return {
            url: `https://maps.google.com/maps?q=${encodeURIComponent(city)}&t=&z=13&ie=UTF8&iwloc=&output=embed`,
            label: `Exploring: ${city}`
        };
    }
};

export default function TripDetail({ trip, onBack, onUpdateTrip }: Props) {
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'itinerary' | 'budget' | 'risks'>('itinerary');
  const [isMapMenuOpen, setIsMapMenuOpen] = useState<boolean>(true);
  
  // State for Budget Detail View
  const [selectedBudgetCategory, setSelectedBudgetCategory] = useState<string | null>(null);

  // State for Map URL and Label
  const [mapState, setMapState] = useState<{ url: string; label: string }>({
    url: '',
    label: ''
  });

  // Effect: Update map when day changes
  useEffect(() => {
      const day = trip.data?.days.find(d => d.day === selectedDay);
      const config = getDayMapConfig(day, trip.input.destination);
      setMapState(config);
  }, [selectedDay, trip.data, trip.input.destination]);

  // Handler: Reset Map to Full Route
  const handleResetMap = () => {
    const day = trip.data?.days.find(d => d.day === selectedDay);
    const config = getDayMapConfig(day, trip.input.destination);
    setMapState(config);
  };

  // Handler: Focus on a specific stop
  const handleFocusStop = (stop: TripStop) => {
    const city = trip.input.destination;
    const query = `${stop.name}, ${city}`;
    setMapState({
        url: `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=16&ie=UTF8&iwloc=&output=embed`,
        label: `📍 ${stop.name}`
    });
  };

  // Error State
  if (trip.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 px-4 text-center">
        <div className="bg-red-100 p-4 rounded-full mb-4">
          <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">行程生成失敗</h2>
        <p className="text-gray-600 max-w-md mb-8">
          {trip.errorMsg || "無法為您生成行程，請稍後再試。"}
        </p>
        <button onClick={onBack} className="px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700">
          返回主控台
        </button>
      </div>
    );
  }

  // Loading State
  if (!trip.data) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-500 mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-700">正在為您規劃夢想旅程...</h2>
        <button onClick={onBack} className="mt-8 text-brand-600 hover:underline">取消</button>
      </div>
    );
  }

  const tripMeta = trip.data.tripMeta || ({} as TripMeta);
  const days = trip.data.days || [];
  const risks = trip.data.risks || [];
  const currentDayData = days.find(d => d.day === selectedDay);

  const budgetEstimate = tripMeta.budgetEstimate || {};
  const budgetData = [
    { name: '交通', value: budgetEstimate.transport || 0 },
    { name: '餐飲', value: budgetEstimate.dining || 0 },
    { name: '門票', value: budgetEstimate.tickets || 0 },
    { name: '其他', value: budgetEstimate.other || 0 },
  ].filter(d => d.value > 0);

  // Logic to filter stops based on category
  const getBudgetDetailItems = (category: string) => {
    const allStops = days.flatMap(d => d.stops);
    
    let filterFn = (stop: TripStop) => false;

    if (category === '餐飲') {
       filterFn = (stop) => {
          const icon = getStopIcon(stop);
          return icon === Utensils || icon === Coffee;
       };
    } else if (category === '門票') {
       filterFn = (stop) => {
          const icon = getStopIcon(stop);
          return icon === Ticket || icon === Landmark || icon === TreeDeciduous || icon === Camera;
       };
    } else if (category === '交通') {
        filterFn = (stop) => {
            const icon = getStopIcon(stop);
            return icon === Train || icon === Car || icon === Navigation;
        };
    } else {
        filterFn = (stop) => {
             const icon = getStopIcon(stop);
             return icon === ShoppingBag || icon === MapPin;
        };
    }

    return allStops.filter(filterFn);
  };

  const handleAiUpdate = async (history: Message[], onThought: (text: string) => void): Promise<string> => {
    if (!trip.data) return "";
    try {
      const result = await updateTripItinerary(trip.data, history, onThought);
      if (result.updatedData) {
        onUpdateTrip(trip.id, result.updatedData);
      }
      return result.responseText;
    } catch (e) {
      console.error("Failed to update trip via AI", e);
      throw e; 
    }
  };

  // Construct a relevant image URL using Pollinations AI
  const city = trip.input.destination.split(',')[0].trim();
  const headerImageUrl = `https://image.pollinations.ai/prompt/cinematic%20wide%20shot%20of%20${encodeURIComponent(city)}%20landmark%20scenery%20travel%20photography?width=1280&height=720&nologo=true&seed=${trip.id}`;

  // Budget Calculations
  const selectedItems = selectedBudgetCategory ? getBudgetDetailItems(selectedBudgetCategory) : [];
  const selectedCategoryTotal = budgetData.find(b => b.name === selectedBudgetCategory)?.value || 0;
  const itemsTotal = selectedItems.reduce((acc, stop) => acc + parseCostToNumber(stop.costEstimate), 0);
  const difference = selectedCategoryTotal - itemsTotal;
  const isOverBudget = difference < 0;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* 1. Header (Sticky) */}
      <header className="bg-white border-b border-gray-200 h-16 flex-none z-50 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-900 font-medium text-sm flex items-center gap-1">
             ← 返回
          </button>
          <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block"></div>
          <h1 className="text-lg font-bold text-gray-800 truncate max-w-md hidden md:block">
            {trip.title || trip.input.destination}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title="分享">
            <Share2 className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title="列印" onClick={() => window.print()}>
            <Printer className="w-5 h-5" />
          </button>
          <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 準備就緒
          </div>
        </div>
      </header>

      {/* 2. Split Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Column: Itinerary (Scrollable) */}
        <div className="w-full lg:w-7/12 xl:w-1/2 overflow-y-auto bg-gray-50 flex flex-col scrollbar-hide">
          
          {/* Hero / Cover Section */}
          <div className="relative h-64 flex-shrink-0 w-full bg-gray-900 group">
            <img 
              src={headerImageUrl}
              onError={(e) => {
                 e.currentTarget.src = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=2000&q=80';
              }}
              alt={`Travel to ${trip.input.destination}`} 
              className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8">
              <span className="text-brand-300 font-bold tracking-wider text-xs mb-2 uppercase">互動式行程</span>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3 shadow-sm leading-tight">{trip.input.destination}</h1>
              <div className="flex flex-wrap items-center gap-4 text-white/90 text-sm font-medium">
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {safeRender(tripMeta.dateRange)}</span>
                <span className="w-1 h-1 bg-white/50 rounded-full"></span>
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {safeRender(tripMeta.days)} 天</span>
                <span className="w-1 h-1 bg-white/50 rounded-full"></span>
                <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> {safeRender(tripMeta.budgetEstimate?.total ? `~${tripMeta.budgetEstimate.total}` : trip.input.budget)}</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation (Main Sections) */}
          <div className="bg-white border-b border-gray-200 sticky top-0 z-40 px-6 pt-4 flex-none shadow-sm">
             <div className="flex space-x-6">
                <button 
                  onClick={() => setActiveTab('itinerary')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'itinerary' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  行程表
                </button>
                <button 
                  onClick={() => setActiveTab('budget')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'budget' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  預算預估
                </button>
                <button 
                  onClick={() => setActiveTab('risks')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'risks' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  風險提示
                </button>
             </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 bg-gray-50">
            
            {/* 1. Itinerary View */}
            {activeTab === 'itinerary' && (
              <>
                {/* Day Selector Bar (Horizontal Scroll) */}
                <div className="bg-white border-b border-gray-200 py-3 px-4 flex gap-3 overflow-x-auto scrollbar-hide sticky top-[57px] z-30">
                  {days.map((day) => {
                     const isSelected = selectedDay === day.day;
                     return (
                        <button
                          key={day.day}
                          onClick={() => setSelectedDay(day.day)}
                          className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[70px] px-3 py-2 rounded-lg border transition-all duration-200 ${
                            isSelected 
                              ? 'bg-brand-600 border-brand-600 text-white shadow-md transform scale-105' 
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                          }`}
                        >
                           <span className={`text-xs font-bold uppercase ${isSelected ? 'text-brand-100' : 'text-gray-400'}`}>第 {day.day} 天</span>
                           <span className={`text-lg font-bold leading-none ${isSelected ? 'text-white' : 'text-gray-800'}`}>{safeRender(day.date).toString().split('/')[1] || day.day}</span>
                           <span className={`text-[10px] mt-1 ${isSelected ? 'text-brand-100' : 'text-gray-400'}`}>{safeRender(day.date)}</span>
                        </button>
                     );
                  })}
                </div>

                {/* Day Content */}
                <div className="p-6 pb-24">
                  {currentDayData ? (
                     <div className="animate-in fade-in duration-300">
                        {/* Day Header */}
                        <div className="mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                           <div className="flex items-center gap-3 mb-2">
                             <div className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">
                               第 {currentDayData.day} 天
                             </div>
                             <span className="text-gray-400 text-xs font-medium">{safeRender(currentDayData.date)}</span>
                           </div>
                           <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                             {currentDayData.theme || `第 ${currentDayData.day} 天行程`}
                           </h2>
                        </div>

                        {/* Timeline Container */}
                        <div className="relative ml-4 md:ml-6 pb-4">
                           {/* Continuous Vertical Line */}
                           <div className="absolute top-0 bottom-0 left-8 w-0.5 bg-gray-300 transform -translate-x-1/2"></div>
                           
                           {currentDayData.stops?.map((stop, idx) => {
                              const StopIcon = getStopIcon(stop);
                              return (
                                <div key={idx} className="relative pl-16 pb-12 last:pb-0 group">
                                   {/* Timeline Node */}
                                   <div className="absolute left-8 -translate-x-1/2 top-0 h-8 w-8 rounded-full border-2 border-brand-500 bg-white z-10 shadow-sm flex items-center justify-center transition-transform duration-300 group-hover:scale-110 flex-shrink-0">
                                      <StopIcon className="w-4 h-4 text-brand-600 stroke-[2.5]" />
                                   </div>

                                   {/* Time & Transport Header */}
                                   <div className="flex items-center gap-3 mb-3">
                                      <span className="font-mono text-lg font-bold text-gray-900 bg-transparent">
                                         {safeRender(stop.startTime)}
                                      </span>
                                      {stop.transport && (
                                         <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-full shadow-sm">
                                            <TransportIcon text={safeRender(stop.transport) as string} />
                                            <span className="truncate max-w-[150px]">{safeRender(stop.transport)}</span>
                                         </div>
                                      )}
                                   </div>

                                   {/* Card */}
                                   <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow hover:border-brand-200 relative">
                                      <div className="flex justify-between items-start gap-4 mb-3">
                                         <h3 className="text-xl font-bold text-gray-900 leading-snug">
                                            {safeRender(stop.name)}
                                         </h3>
                                         <div className="text-right flex-shrink-0">
                                            <div className="text-sm font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-md">{safeRender(stop.costEstimate)}</div>
                                         </div>
                                      </div>

                                      <div className="prose prose-sm text-gray-600 mb-4 leading-relaxed">
                                         {safeRender(stop.notes)}
                                      </div>

                                      {/* Stop Meta Data */}
                                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                         <div className="flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                                            <span>{safeRender(stop.endTime) ? `直到 ${safeRender(stop.endTime)}` : '時間彈性'}</span>
                                         </div>
                                         <div className="flex items-center gap-2">
                                             <Info className="w-3.5 h-3.5 text-gray-400" />
                                             <span>{safeRender(stop.openHours) || '查看營業時間'}</span>
                                         </div>
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                                         {stop.placeLink && (
                                            <a 
                                               href={stop.placeLink} 
                                               target="_blank" 
                                               rel="noreferrer"
                                               className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-md"
                                            >
                                               <MapPin className="w-3.5 h-3.5" /> 查看地圖
                                            </a>
                                         )}
                                         <button 
                                            onClick={() => handleFocusStop(stop)}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md"
                                         >
                                            <Crosshair className="w-3.5 h-3.5" /> 地圖定位
                                         </button>
                                      </div>

                                      {/* Alternatives (if any) */}
                                      {stop.alternatives && stop.alternatives.length > 0 && (
                                         <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                                            <div className="text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">替代方案</div>
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

                        {/* Daily Checklist */}
                        {currentDayData.dailyChecklist && currentDayData.dailyChecklist.length > 0 && (
                           <div className="mt-8 bg-yellow-50 rounded-xl p-5 border border-yellow-200">
                              <h4 className="font-bold text-yellow-800 mb-3 flex items-center gap-2">
                                 <CheckCircle2 className="w-5 h-5" /> 第 {currentDayData.day} 天 待辦事項
                              </h4>
                              <ul className="space-y-2">
                                 {currentDayData.dailyChecklist.map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-yellow-900">
                                       <input type="checkbox" className="mt-0.5 rounded text-yellow-600 focus:ring-yellow-500" />
                                       <span className="decoration-yellow-900/50 peer-checked:line-through transition-all">{safeRender(item)}</span>
                                    </li>
                                 ))}
                              </ul>
                           </div>
                        )}
                     </div>
                  ) : (
                     <div className="text-center py-20 text-gray-500">
                        請選擇一天以查看詳情
                     </div>
                  )}
                </div>
              </>
            )}

            {/* 2. Budget View */}
            {activeTab === 'budget' && (
               <div 
                 className="p-6 min-h-full cursor-default"
                 onClick={() => setSelectedBudgetCategory(null)}
               >
                 <div 
                   className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
                   // Removed stopPropagation from main card so clicking whitespace inside allows dismissal
                   // But we must stop propagation on interactive children below
                 >
                   <h3 className="text-lg font-bold text-gray-900 mb-6">預估費用明細</h3>
                   
                   <div className="flex flex-col md:flex-row items-start gap-8">
                     
                     {/* Left: Interactive Pie Chart */}
                     <div 
                        className="w-full md:w-1/2 flex flex-col items-center"
                        onClick={(e) => e.stopPropagation()} // Stop clicking chart area from closing details
                     >
                        <div className="w-full h-[300px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                    data={budgetData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80} // Reduced radius to prevent label clipping
                                    paddingAngle={5}
                                    dataKey="value"
                                    onClick={(data) => {
                                        setSelectedBudgetCategory(data.name === selectedBudgetCategory ? null : data.name);
                                    }}
                                    label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    labelLine={true}
                                    cursor="pointer"
                                    >
                                    {budgetData.map((entry, index) => (
                                        <Cell 
                                          key={`cell-${index}`} 
                                          fill={COLORS[index % COLORS.length]} 
                                          stroke={entry.name === selectedBudgetCategory ? '#000' : 'none'}
                                          strokeWidth={entry.name === selectedBudgetCategory ? 2 : 0}
                                          opacity={selectedBudgetCategory && selectedBudgetCategory !== entry.name ? 0.3 : 1}
                                        />
                                    ))}
                                    </Pie>
                                    <ChartTooltip formatter={(value) => `${value}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 text-center">
                            點擊圖表區塊可查看該類別的相關行程項目
                        </p>
                     </div>

                     {/* Right: Legend & Details */}
                     <div className="flex-1 w-full space-y-6">
                        
                        {/* Legend / Totals */}
                        <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                            {budgetData.map((item, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => {
                                   setSelectedBudgetCategory(item.name === selectedBudgetCategory ? null : item.name);
                                }}
                                className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition-all ${
                                    selectedBudgetCategory === item.name 
                                    ? 'bg-brand-50 border-brand-300 shadow-sm ring-1 ring-brand-200' 
                                    : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                    <span className={`font-medium ${selectedBudgetCategory === item.name ? 'text-brand-800' : 'text-gray-700'}`}>
                                        {item.name}
                                    </span>
                                </div>
                                <span className="font-bold text-gray-900">{item.value}</span>
                            </div>
                            ))}
                        </div>

                        {/* Grand Total */}
                        <div className="pt-4 border-t border-gray-200 flex justify-between items-center text-lg">
                           <span className="font-bold text-gray-900">總預估</span>
                           <span className="font-extrabold text-brand-600">{safeRender(tripMeta.budgetEstimate?.total)}</span>
                        </div>

                        {/* Drill Down Details */}
                        {selectedBudgetCategory && (
                            <div 
                              className="animate-in fade-in slide-in-from-top-2 duration-300 mt-6 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-lg ring-1 ring-black/5"
                              onClick={(e) => e.stopPropagation()} // Stop interaction with details from closing it
                            >
                                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                    <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                        <List className="w-4 h-4 text-gray-500" />
                                        {selectedBudgetCategory} 細項清單
                                    </h4>
                                    <button 
                                      onClick={() => setSelectedBudgetCategory(null)} 
                                      className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
                                    >
                                        <XCircle className="w-4 h-4" />
                                    </button>
                                </div>
                                
                                <div className="max-h-[300px] overflow-y-auto p-0">
                                    {selectedItems.length > 0 ? (
                                        <>
                                            <div className="divide-y divide-gray-100">
                                                {selectedItems.map((stop, i) => (
                                                    <div key={i} className="px-4 py-3 hover:bg-gray-50 transition-colors flex justify-between items-start gap-4">
                                                        <div>
                                                            <div className="text-sm font-bold text-gray-900">{stop.name}</div>
                                                            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                                                <Clock className="w-3 h-3" /> 第 {days.find(d => d.stops.includes(stop))?.day} 天
                                                            </div>
                                                        </div>
                                                        <div className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded whitespace-nowrap">
                                                            {safeRender(stop.costEstimate)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            {/* Comparison Footer */}
                                            <div className="bg-gray-50 border-t border-gray-200 p-4 space-y-2">
                                                <div className="flex justify-between items-center text-xs text-gray-500">
                                                    <span>具體行程項目加總:</span>
                                                    <span className="font-medium">{itemsTotal}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs text-gray-500">
                                                    <span>{selectedBudgetCategory} 類別總預算:</span>
                                                    <span className="font-medium">{selectedCategoryTotal}</span>
                                                </div>
                                                
                                                <div className={`mt-2 pt-2 border-t border-dashed border-gray-300 flex justify-between items-center text-sm font-bold ${isOverBudget ? 'text-red-600' : 'text-green-700'}`}>
                                                    <span className="flex items-center gap-1">
                                                        {isOverBudget ? <TrendingUp className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                                                        {isOverBudget ? '超出預算:' : '未分配額度 (可用於雜支):'}
                                                    </span>
                                                    <span>{Math.abs(difference)}</span>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="p-6 text-center text-sm text-gray-500">
                                            <div className="mb-2">此類別包含在總體預算中，但未分配至具體景點。</div>
                                            <div className="flex justify-center items-center gap-2 text-brand-600 font-bold mt-2">
                                                <Wallet className="w-4 h-4" />
                                                可用預算額度: {selectedCategoryTotal}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                     </div>
                   </div>
                 </div>
               </div>
            )}

            {/* 3. Risks View */}
            {activeTab === 'risks' && (
              <div className="p-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertTriangle className="text-orange-500" /> 潛在風險與建議
                  </h3>
                  <ul className="space-y-3">
                    {risks.map((risk, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm text-gray-700 bg-orange-50 p-4 rounded-lg border border-orange-100">
                        <span className="w-2 h-2 bg-orange-400 rounded-full mt-1.5 flex-shrink-0"></span>
                        <span className="leading-relaxed">{safeRender(risk)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Right Column: Sticky Map (Hidden on mobile) */}
        <div className="hidden lg:block lg:w-5/12 xl:w-1/2 bg-gray-200 h-full relative border-l border-gray-200">
           <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
              {/* Fake Interactive Map using Embed */}
              <iframe
                title="Trip Map"
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={mapState.url}
                allowFullScreen
              ></iframe>
              
              {/* Top Right Floating Menu */}
              <div className="absolute top-6 right-6 z-20 flex flex-col items-end">
                 <div 
                   className={`bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200 transition-all duration-300 overflow-hidden flex flex-col ${
                     isMapMenuOpen ? 'w-72 max-h-[calc(100vh-120px)]' : 'w-auto'
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
                                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">第 {selectedDay} 天 路線</h4>
                                    <p className="text-[10px] text-gray-500 font-medium">{currentDayData?.stops.length || 0} 個站點</p>
                                </div>
                             )}
                        </div>
                        
                        <div className="flex items-center gap-1 pl-2">
                            {isMapMenuOpen ? (
                              <>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleResetMap(); }}
                                    className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-brand-600 transition-colors"
                                    title="重置視角"
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
                                        onClick={() => handleFocusStop(stop)}
                                        className="p-1.5 text-gray-300 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                                        title="地圖定位"
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

      </div>

      {/* Assistant is fixed to bottom right, adjusted z-index to be above map */}
      <Assistant onUpdate={handleAiUpdate} isGenerating={false} />
    </div>
  );
}