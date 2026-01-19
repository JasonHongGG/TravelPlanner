import React, { useState } from 'react';
import { TripDay, TripStop, TripMeta } from '../../types';
import { safeRender, parseCostToNumber } from '../../utils/formatters';
import { getStopIcon } from '../../utils/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';
import { Utensils, Coffee, Ticket, Landmark, Mountain, Camera, Train, Car, Navigation, ShoppingBag, MapPin, List, XCircle, Clock, Wallet, TrendingUp } from 'lucide-react';

interface Props {
  tripMeta: TripMeta;
  days: TripDay[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function BudgetView({ tripMeta, days }: Props) {
  const [selectedBudgetCategory, setSelectedBudgetCategory] = useState<string | null>(null);

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
          if (stop.type) {
              return stop.type === 'dining' || stop.type === 'cafe';
          }
          const icon = getStopIcon(stop);
          return icon === Utensils || icon === Coffee;
       };
    } else if (category === '門票') {
       filterFn = (stop) => {
          if (stop.type) {
              return stop.type === 'activity' || stop.type === 'attraction' || stop.type === 'landmark' || stop.type === 'nature' || stop.type === 'history';
          }
          const icon = getStopIcon(stop);
          return icon === Ticket || icon === Landmark || icon === Mountain || icon === Camera || icon === MapPin;
       };
    } else if (category === '交通') {
        filterFn = (stop) => {
            if (stop.type) {
                return stop.type === 'transport';
            }
            const icon = getStopIcon(stop);
            return icon === Train || icon === Car || icon === Navigation;
        };
    } else {
        filterFn = (stop) => {
             if (stop.type) {
                 return stop.type === 'shopping' || stop.type === 'accommodation' || stop.type === 'other';
             }
             const icon = getStopIcon(stop);
             return icon === ShoppingBag;
        };
    }

    return allStops.filter(filterFn);
  };

  const selectedItems = selectedBudgetCategory ? getBudgetDetailItems(selectedBudgetCategory) : [];
  const selectedCategoryTotal = budgetData.find(b => b.name === selectedBudgetCategory)?.value || 0;
  const itemsTotal = selectedItems.reduce((acc, stop) => acc + parseCostToNumber(stop.costEstimate), 0);
  const difference = selectedCategoryTotal - itemsTotal;
  const isOverBudget = difference < 0;

  return (
   <div 
     className="p-6 min-h-full cursor-default"
     onClick={() => setSelectedBudgetCategory(null)}
   >
     <div 
       className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
       onClick={(e) => e.stopPropagation()} // Stop bubbling
     >
       <h3 className="text-lg font-bold text-gray-900 mb-6">預估費用明細</h3>
       
       <div className="flex flex-col md:flex-row items-start gap-8">
         
         {/* Left: Interactive Pie Chart */}
         <div className="w-full md:w-1/2 flex flex-col items-center">
            <div className="w-full h-[300px] relative">
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
            <div className="space-y-4">
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
                  onClick={(e) => e.stopPropagation()} 
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
  );
}