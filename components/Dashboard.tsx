import React, { useState, useEffect } from 'react';
import { Trip } from '../types';
import { Plus, Map, Loader2, AlertCircle, ChevronRight } from 'lucide-react';

interface Props {
  trips: Trip[];
  onNewTrip: () => void;
  onSelectTrip: (trip: Trip) => void;
}

// Sub-component for live timer updates
const LiveTimer = ({ startTime }: { startTime: number }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    // Initial update
    setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return <span className="ml-1 tabular-nums">({elapsedSeconds}秒)</span>;
};

export default function Dashboard({ trips, onNewTrip, onSelectTrip }: Props) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="bg-brand-600 p-2 rounded-lg">
                <Map className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">Travel Planner Dashboard</span>
            </div>
            <div className="flex items-center">
              <button 
                onClick={onNewTrip}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-all"
              >
                <Plus className="w-5 h-5 mr-2" />
                新增行程
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">您的行程</h1>
          <p className="mt-1 text-gray-500">管理您生成的行程並規劃新的冒險。</p>
        </div>

        {trips.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-300">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <Map className="w-12 h-12" />
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">尚未有行程</h3>
            <p className="mt-1 text-sm text-gray-500">開始建立您的第一個 AI 行程吧。</p>
            <div className="mt-6">
              <button
                onClick={onNewTrip}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-600 hover:bg-brand-700"
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                規劃第一個行程
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <div 
                key={trip.id} 
                onClick={() => onSelectTrip(trip)}
                className="group bg-white overflow-hidden rounded-xl border border-gray-200 hover:border-brand-300 hover:shadow-lg transition-all cursor-pointer relative"
              >
                {/* Status Indicator */}
                <div className="absolute top-4 right-4">
                  {trip.status === 'generating' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" /> 
                      生成中 <LiveTimer startTime={trip.createdAt} />
                    </span>
                  )}
                  {trip.status === 'complete' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      完成 {trip.generationTimeMs ? `(${(trip.generationTimeMs / 1000).toFixed(1)}秒)` : ''}
                    </span>
                  )}
                   {trip.status === 'error' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      錯誤
                    </span>
                  )}
                </div>

                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center">
                       <Map className="h-6 w-6 text-brand-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900 group-hover:text-brand-600 transition-colors">
                        {trip.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {new Date(trip.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex items-center text-sm text-gray-500 mb-2">
                       <span className="font-medium text-gray-700 mr-2">日期:</span> {trip.input.dateRange}
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                       <span className="font-medium text-gray-700 mr-2">人數:</span> {trip.input.travelers}
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {trip.status === 'generating' ? '處理中...' : '查看行程'}
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-500 transform group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}