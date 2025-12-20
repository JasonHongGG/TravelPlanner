import React, { useState, useEffect } from 'react';
import { Trip, TripData, TripMeta, TripStop, TripDay } from '../types';
import { MapPin, Clock, DollarSign, Navigation, ExternalLink, AlertTriangle, Calendar, Info, ArrowRight, Share2, Printer, CheckCircle2, Car, Train, Footprints, Utensils, ShoppingBag, Landmark, TreeDeciduous, Camera, Coffee, Ticket, List, RotateCcw, Crosshair, ChevronDown, ChevronUp, Map as MapIcon } from 'lucide-react';
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

// Helper icon for transport
const TransportIcon = ({ text }: { text: string }) => {
  const lower = text.toLowerCase();
  if (lower.includes('walk') || lower.includes('foot')) return <Footprints className="w-3 h-3" />;
  if (lower.includes('car') || lower.includes('drive') || lower.includes('taxi') || lower.includes('uber')) return <Car className="w-3 h-3" />;
  if (lower.includes('train') || lower.includes('subway') || lower.includes('rail') || lower.includes('shinkansen')) return <Train className="w-3 h-3" />;
  return <Navigation className="w-3 h-3" />;
};

// Helper to deduce icon from stop details
const getStopIcon = (stop: TripStop) => {
  const text = (stop.name + ' ' + (stop.notes || '')).toLowerCase();
  if (text.includes('lunch') || text.includes('dinner') || text.includes('breakfast') || text.includes('eat') || text.includes('restaurant') || text.includes('food') || text.includes('izakaya') || text.includes('ramen') || text.includes('sushi')) return Utensils;
  if (text.includes('coffee') || text.includes('cafe') || text.includes('tea') || text.includes('dessert')) return Coffee;
  if (text.includes('shop') || text.includes('mall') || text.includes('store') || text.includes('market') || text.includes('buy') || text.includes('souvenir')) return ShoppingBag;
  if (text.includes('park') || text.includes('garden') || text.includes('nature') || text.includes('mountain') || text.includes('hike') || text.includes('beach')) return TreeDeciduous;
  if (text.includes('museum') || text.includes('gallery') || text.includes('temple') || text.includes('shrine') || text.includes('church') || text.includes('castle') || text.includes('palace') || text.includes('tower')) return Landmark;
  if (text.includes('photo') || text.includes('view') || text.includes('observation') || text.includes('sight')) return Camera;
  if (text.includes('ticket') || text.includes('entrance') || text.includes('disney') || text.includes('universal')) return Ticket;
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Itinerary Generation Failed</h2>
        <p className="text-gray-600 max-w-md mb-8">
          {trip.errorMsg || "We couldn't generate the itinerary. Please try again."}
        </p>
        <button onClick={onBack} className="px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700">
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Loading State
  if (!trip.data) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-500 mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-700">Generating your dream trip...</h2>
        <button onClick={onBack} className="mt-8 text-brand-600 hover:underline">Cancel</button>
      </div>
    );
  }

  const tripMeta = trip.data.tripMeta || ({} as TripMeta);
  const days = trip.data.days || [];
  const risks = trip.data.risks || [];
  const currentDayData = days.find(d => d.day === selectedDay);

  const budgetEstimate = tripMeta.budgetEstimate || {};
  const budgetData = [
    { name: 'Transport', value: budgetEstimate.transport || 0 },
    { name: 'Dining', value: budgetEstimate.dining || 0 },
    { name: 'Tickets', value: budgetEstimate.tickets || 0 },
    { name: 'Other', value: budgetEstimate.other || 0 },
  ].filter(d => d.value > 0);

  const handleAiUpdate = async (request: string) => {
    if (!trip.data) return;
    try {
      const updatedData = await updateTripItinerary(trip.data, request);
      onUpdateTrip(trip.id, updatedData);
    } catch (e) {
      console.error("Failed to update trip via AI", e);
      throw e; 
    }
  };

  // Construct a relevant image URL using Pollinations AI
  const city = trip.input.destination.split(',')[0].trim();
  const headerImageUrl = `https://image.pollinations.ai/prompt/cinematic%20wide%20shot%20of%20${encodeURIComponent(city)}%20landmark%20scenery%20travel%20photography?width=1280&height=720&nologo=true&seed=${trip.id}`;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* 1. Header (Sticky) */}
      <header className="bg-white border-b border-gray-200 h-16 flex-none z-50 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-900 font-medium text-sm flex items-center gap-1">
             ← Back
          </button>
          <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block"></div>
          <h1 className="text-lg font-bold text-gray-800 truncate max-w-md hidden md:block">
            {trip.title || trip.input.destination}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title="Share">
            <Share2 className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title="Print" onClick={() => window.print()}>
            <Printer className="w-5 h-5" />
          </button>
          <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Ready
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
              <span className="text-brand-300 font-bold tracking-wider text-xs mb-2 uppercase">Interactive Itinerary</span>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3 shadow-sm leading-tight">{trip.input.destination}</h1>
              <div className="flex flex-wrap items-center gap-4 text-white/90 text-sm font-medium">
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {safeRender(tripMeta.dateRange)}</span>
                <span className="w-1 h-1 bg-white/50 rounded-full"></span>
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {safeRender(tripMeta.days)} Days</span>
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
                  Itinerary
                </button>
                <button 
                  onClick={() => setActiveTab('budget')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'budget' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Budget
                </button>
                <button 
                  onClick={() => setActiveTab('risks')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'risks' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Risks
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
                           <span className={`text-xs font-bold uppercase ${isSelected ? 'text-brand-100' : 'text-gray-400'}`}>Day</span>
                           <span className={`text-lg font-bold leading-none ${isSelected ? 'text-white' : 'text-gray-800'}`}>{day.day}</span>
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
                               Day {currentDayData.day}
                             </div>
                             <span className="text-gray-400 text-xs font-medium">{safeRender(currentDayData.date)}</span>
                           </div>
                           <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                             {currentDayData.theme || `Day ${currentDayData.day} Adventure`}
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
                                            <span>{safeRender(stop.endTime) ? `Until ${safeRender(stop.endTime)}` : 'Duration varies'}</span>
                                         </div>
                                         <div className="flex items-center gap-2">
                                             <Info className="w-3.5 h-3.5 text-gray-400" />
                                             <span>{safeRender(stop.openHours) || 'Check opening hours'}</span>
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
                                               <MapPin className="w-3.5 h-3.5" /> View Map
                                            </a>
                                         )}
                                         <button 
                                            onClick={() => handleFocusStop(stop)}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md"
                                         >
                                            <Crosshair className="w-3.5 h-3.5" /> Focus on Map
                                         </button>
                                      </div>

                                      {/* Alternatives (if any) */}
                                      {stop.alternatives && stop.alternatives.length > 0 && (
                                         <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                                            <div className="text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Alternatives</div>
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
                                 <CheckCircle2 className="w-5 h-5" /> Day {currentDayData.day} Checklist
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
                        Select a day to view details
                     </div>
                  )}
                </div>
              </>
            )}

            {/* 2. Budget View */}
            {activeTab === 'budget' && (
               <div className="p-6">
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                   <h3 className="text-lg font-bold text-gray-900 mb-6">Estimated Cost Breakdown</h3>
                   <div className="flex flex-col md:flex-row items-center gap-8">
                     <div className="w-64 h-64 flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={budgetData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                              {budgetData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <ChartTooltip formatter={(value) => `${value}`} />
                          </PieChart>
                        </ResponsiveContainer>
                     </div>
                     <div className="flex-1 space-y-4 w-full">
                        {budgetData.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                             <div className="flex items-center gap-2">
                               <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                               <span className="font-medium text-gray-700">{item.name}</span>
                             </div>
                             <span className="font-bold text-gray-900">{item.value}</span>
                          </div>
                        ))}
                        <div className="pt-4 mt-4 border-t border-gray-200 flex justify-between items-center text-lg">
                           <span className="font-bold text-gray-900">Total Estimate</span>
                           <span className="font-extrabold text-brand-600">{safeRender(tripMeta.budgetEstimate?.total)}</span>
                        </div>
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
                    <AlertTriangle className="text-orange-500" /> Potential Risks & Advisories
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
                                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Day {selectedDay} Route</h4>
                                    <p className="text-[10px] text-gray-500 font-medium">{currentDayData?.stops.length || 0} Stops</p>
                                </div>
                             )}
                        </div>
                        
                        <div className="flex items-center gap-1 pl-2">
                            {isMapMenuOpen ? (
                              <>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleResetMap(); }}
                                    className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-brand-600 transition-colors"
                                    title="Reset View"
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
                                        title="Focus on Map"
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