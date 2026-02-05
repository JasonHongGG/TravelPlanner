import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DateRangePickerProps {
    startDate: Date | null;
    endDate: Date | null;
    onChange: (start: Date | null, end: Date | null) => void;
    onClose: () => void;
}

export default function DateRangePicker({ startDate, endDate, onChange, onClose }: DateRangePickerProps) {
    const { t, i18n } = useTranslation();

    // Determine initial view month
    const [currentMonth, setCurrentMonth] = useState(() => {
        return startDate ? new Date(startDate.getFullYear(), startDate.getMonth(), 1) : new Date();
    });

    const [hoverDate, setHoverDate] = useState<Date | null>(null);

    // Helpers
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const isSameDay = (d1: Date | null, d2: Date | null) => {
        if (!d1 || !d2) return false;
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    };

    const getDayClass = (date: Date) => {
        const resetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()); // Clear time
        const resetStart = startDate ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()) : null;
        const resetEnd = endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()) : null;

        const isStart = isSameDay(resetDate, resetStart);
        const isEnd = isSameDay(resetDate, resetEnd);

        let inRange = false;
        if (resetStart && resetEnd) {
            inRange = resetDate > resetStart && resetDate < resetEnd;
        } else if (resetStart && hoverDate && !resetEnd) {
            // Preview range on hover
            const hoverReset = new Date(hoverDate.getFullYear(), hoverDate.getMonth(), hoverDate.getDate());
            if (hoverReset > resetStart) {
                inRange = resetDate > resetStart && resetDate <= hoverReset;
            }
        }

        const isToday = isSameDay(resetDate, new Date());

        let classes = "relative w-9 h-9 flex items-center justify-center text-sm rounded-full transition-all duration-200 z-10 ";

        if (isStart || isEnd) {
            classes += "bg-brand-600 text-white font-bold shadow-md shadow-brand-200 scale-105 ";
        } else if (inRange) {
            classes += "bg-brand-50 text-brand-700 font-medium ";
        } else {
            classes += "text-gray-700 hover:bg-gray-100 ";
            if (isToday) classes += "border border-brand-200 text-brand-600 font-bold ";
        }

        return classes;
    };

    const handleDateClick = (day: number) => {
        const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);

        if (!startDate || (startDate && endDate)) {
            // Start new selection
            onChange(clickedDate, null);
        } else if (startDate && !endDate) {
            if (clickedDate < startDate) {
                // If clicked before start, just reset start
                onChange(clickedDate, null);
            } else {
                // Complete range
                onChange(startDate, clickedDate);
            }
        }
    };

    // Render Grid
    const renderCalendar = () => {
        const daysInMonth = getDaysInMonth(currentMonth);
        const firstDay = getFirstDayOfMonth(currentMonth);
        const days = [];

        // Padding
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`pad-${i}`} className="w-9 h-9" />);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
            days.push(
                <button
                    key={d}
                    onClick={(e) => { e.preventDefault(); handleDateClick(d); }}
                    onMouseEnter={() => setHoverDate(date)}
                    onMouseLeave={() => setHoverDate(null)}
                    className={getDayClass(date)}
                >
                    {d}
                </button>
            );
        }
        return days;
    };

    // Calculate nights/days
    const daysCount = (startDate && endDate)
        ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1
        : 0;

    // Generate weekdays based on locale (starts Sunday)
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(2023, 0, i + 1); // 2023-01-01 is Sunday
        return d.toLocaleString(i18n.language, { weekday: 'short' });
    });

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 w-[360px] animate-in zoom-in-95 duration-200 select-none overflow-hidden">

                {/* Header Decoration */}
                <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-brand-50 to-transparent pointer-events-none" />

                <div className="relative p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={(e) => { e.preventDefault(); handlePrevMonth(); }} className="p-2 hover:bg-white rounded-full text-gray-500 hover:text-gray-900 hover:shadow-sm transition-all">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-xl font-black text-gray-900 tracking-tight">
                            {currentMonth.toLocaleString(i18n.language, { year: 'numeric', month: 'long' })}
                        </span>
                        <button onClick={(e) => { e.preventDefault(); handleNextMonth(); }} className="p-2 hover:bg-white rounded-full text-gray-500 hover:text-gray-900 hover:shadow-sm transition-all">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Weekdays */}
                    <div className="grid grid-cols-7 mb-3 text-center">
                        {weekDays.map(day => (
                            <span key={day} className="text-xs font-bold text-gray-400 uppercase tracking-wider h-8 flex items-center justify-center">
                                {day}
                            </span>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-y-1 justify-items-center">
                        {renderCalendar()}
                    </div>

                    {/* Footer */}
                    <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('calendar.selected')}</span>
                            <span className="text-sm font-bold text-brand-600">
                                {startDate && endDate ? t('calendar.days', { count: daysCount }) : t('calendar.select_date')}
                            </span>
                        </div>
                        <button
                            onClick={(e) => { e.preventDefault(); onClose(); }}
                            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 hover:shadow-lg transition-all"
                        >
                            {t('calendar.confirm')}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
