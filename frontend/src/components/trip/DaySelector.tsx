import React from 'react';
import { TripDay } from '../../types';
import { safeRender } from '../../utils/formatters';
import { useDraggableScroll } from '../../hooks/useDraggableScroll';

interface Props {
  days: TripDay[];
  selectedDay: number;
  onSelectDay: (day: number) => void;
}

export default function DaySelector({ days, selectedDay, onSelectDay }: Props) {
  const { scrollRef, events } = useDraggableScroll();

  return (
    <div 
      ref={scrollRef}
      className="bg-white border-b border-gray-200 py-4 px-4 flex gap-3 overflow-x-auto scrollbar-hide sticky top-[57px] z-30 cursor-grab active:cursor-grabbing select-none"
      {...events}
    >
      {days.map((day) => {
         const isSelected = selectedDay === day.day;
         return (
            <button
              key={day.day}
              onClick={() => onSelectDay(day.day)}
              className={`flex-shrink-0 flex flex-col items-center justify-center w-[70px] py-2 rounded-lg border transition-all duration-200 select-none ${
                isSelected 
                  ? 'bg-white border-brand-600 ring-1 ring-brand-600 shadow-sm' 
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
               <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">DAY</span>
               <span className={`text-2xl font-bold my-0.5 ${isSelected ? 'text-brand-600' : 'text-gray-700'}`}>
                 {day.day}
               </span>
               <span className="text-[10px] text-gray-400 font-medium">
                 {safeRender(day.date)}
               </span>
            </button>
         );
      })}
    </div>
  );
}
