import React, { useState, useMemo, useEffect } from 'react';
import { TripDay, TripStop, TripMeta } from '../../types';
import { safeRender, parseCostToNumber } from '../../utils/formatters';
import { getStopIcon } from '../../utils/icons';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip,
    AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
    Utensils, Coffee, Ticket, Landmark, Mountain, Camera, Train, Car,
    Navigation, ShoppingBag, MapPin, List, XCircle, Clock, Wallet,
    TrendingUp, Activity, DollarSign, Calendar, AlertCircle, Edit2, Check, RotateCcw
} from 'lucide-react';

interface Props {
    tripMeta: TripMeta;
    days: TripDay[];
    onUpdateMeta?: (updates: Partial<TripMeta>) => void;
    tripCurrency?: string; // New prop for currency code (JPY, TWD, etc)
}

import { useTranslation } from 'react-i18next'; // 1. Import hook

const getCurrencySymbol = (code: string = 'JPY') => {
    switch (code.toUpperCase()) {
        case 'JPY': return '¥';
        case 'USD': return '$';
        case 'KRW': return '₩';
        case 'TWD': return 'NT$';
        case 'CNY': return '¥';
        case 'EUR': return '€';
        default: return code; // Fallback to code if symbol unknown or just use code
    }
};

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6'];

// Map internal categories to display names
const CATEGORY_MAP: Record<string, string> = {
    transport: '交通',
    dining: '餐飲',
    tickets: '活動/門票',
    shopping: '購物',
    accommodation: '住宿',
    other: '其他'
};



const CATEGORY_ICONS: Record<string, any> = {
    transport: Train,
    dining: Utensils,
    tickets: Ticket,
    shopping: ShoppingBag,
    accommodation: MapPin,
    other: Wallet
};

export default function BudgetView({ tripMeta, days, onUpdateMeta, tripCurrency = 'JPY' }: Props) {
    const { t } = useTranslation(); // 2. Use hook
    const [selectedBudgetCategory, setSelectedBudgetCategory] = useState<string | null>(null);
    const [selectedDetailDay, setSelectedDetailDay] = useState<number | null>(null);

    // Local state for budget targets, initialized from tripMeta
    const [budgetTargets, setBudgetTargets] = useState<Record<string, number>>(tripMeta.budgetTargets || {});
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');

    // Sync back to parent when editing finishes
    const handleSaveTarget = (categoryKey: string) => {
        const val = parseInt(editingValue.replace(/,/g, ''), 10);
        const newTargets = { ...budgetTargets, [categoryKey]: isNaN(val) ? 0 : val };
        setBudgetTargets(newTargets);
        setEditingCategory(null);
        onUpdateMeta?.({ budgetTargets: newTargets });
    };

    // Initialize targets if empty (optional: can leave empty for "no limit")
    useEffect(() => {
        if (tripMeta.budgetTargets) {
            setBudgetTargets(tripMeta.budgetTargets);
        }
    }, [tripMeta.budgetTargets]);

    // Parse traveler count for Budget Multiplier
    const travelerCount = useMemo(() => {
        if (!tripMeta.travelers) return 1;
        const match = tripMeta.travelers.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 1;
    }, [tripMeta.travelers]);

    // Dynamic Calculation of Budget
    const {
        budgetData,
        chartData,
        categoryDetails,
        totalBudget,
        dailyTrend,
        averageDailySpend,
        highestCategory,
        totals
    } = useMemo(() => {
        const details: Record<string, TripStop[]> = {
            transport: [], dining: [], tickets: [], shopping: [], accommodation: [], other: []
        };

        const totals: Record<string, number> = {
            transport: 0, dining: 0, tickets: 0, shopping: 0, accommodation: 0, other: 0
        };

        const dailyTotals: Record<number, number> = {};
        days.forEach(d => dailyTotals[d.day] = 0);

        const allStops = days.flatMap(d => d.stops);

        allStops.forEach(stop => {
            let category = 'other';
            let amount = 0;

            // 1. Determine Category
            if (stop.costCategory) {
                category = stop.costCategory;
            } else {
                // Fallback Logic
                if (stop.type) {
                    if (['dining', 'cafe'].includes(stop.type)) category = 'dining';
                    else if (['transport'].includes(stop.type)) category = 'transport';
                    else if (['shopping'].includes(stop.type)) category = 'shopping';
                    else if (['accommodation'].includes(stop.type)) category = 'accommodation';
                    else if (['attraction', 'landmark', 'nature', 'activity', 'history'].includes(stop.type)) category = 'tickets';
                    else category = 'other';
                } else {
                    const icon = getStopIcon(stop);
                    if (icon === Utensils || icon === Coffee) category = 'dining';
                    else if (icon === Train || icon === Car || icon === Navigation) category = 'transport';
                    else if (icon === ShoppingBag) category = 'shopping';
                    else category = 'other';
                }
            }

            if (!totals.hasOwnProperty(category)) category = 'other';

            // 2. Determine Amount & Multiplier
            if (typeof stop.costAmount === 'number') {
                amount = stop.costAmount;
            } else {
                amount = parseCostToNumber(stop.costEstimate);
            }

            // Apply Multiplier for Per-Person Categories
            const isPerPerson = ['dining', 'transport', 'tickets'].includes(category);
            if (isPerPerson) {
                amount = amount * travelerCount;
            }

            // 3. Find Day
            const dayNum = days.find(d => d.stops.includes(stop))?.day || 1;

            if (amount > 0) {
                totals[category] += amount;
                details[category].push(stop);
                dailyTotals[dayNum] = (dailyTotals[dayNum] || 0) + amount;
            }
        });

        // Format for Pie Chart and Legend
        // 1. Full data for Legend (all categories)
        const allCategoriesData = Object.keys(totals).map(key => {
            const value = totals[key] || 0;
            // Use translation for display name
            const displayName = t(`categories.${key}`, key);
            return {
                name: displayName,
                key: key,
                value: value,
                icon: CATEGORY_ICONS[key] || Wallet
            };
        }).sort((a, b) => b.value - a.value);
        // Let's stick to the previous sorting behavior (descending value) for now as it highlights big spenders, but 0s will be present.

        // 2. Filtered data for Pie Chart (only > 0)
        const chartData = allCategoriesData.filter(d => d.value > 0);

        const total = Object.values(totals).reduce((a, b) => a + b, 0);

        // Daily Trend Data
        const trendData = Object.entries(dailyTotals).map(([day, value]) => ({
            day: `Day ${day}`,
            amount: value
        }));

        // Stats
        const avgDaily = days.length > 0 ? Math.round(total / days.length) : 0;
        const highest = chartData.length > 0 ? chartData[0] : null;

        return {
            budgetData: allCategoriesData, // User full list for legend
            chartData: chartData,          // Use filtered list for chart
            categoryDetails: details,
            totalBudget: total,
            dailyTrend: trendData,
            averageDailySpend: avgDaily,
            highestCategory: highest,
            totals
        };
    }, [days]);

    const selectedItems = selectedBudgetCategory
        ? categoryDetails[selectedBudgetCategory] || []
        : [];

    const dayItems = useMemo(() => {
        if (!selectedDetailDay) return [];
        return days.find(d => d.day === selectedDetailDay)?.stops || [];
    }, [days, selectedDetailDay]);

    const handlePieClick = (data: any) => {
        if (!data) return;
        setSelectedDetailDay(null); // Clear day selection
        setSelectedBudgetCategory(selectedBudgetCategory === data.key ? null : data.key);
    };

    const handleTrendClick = (data: any) => {
        let dayStr = '';

        // Priority: activeLabel (provided by AreaChart onClick)
        if (data && data.activeLabel) {
            dayStr = data.activeLabel;
        }
        // Fallback: activePayload
        else if (data && data.activePayload && data.activePayload.length > 0) {
            dayStr = data.activePayload[0].payload.day;
        }

        if (dayStr) {
            const dayNum = parseInt(dayStr.replace('Day ', ''));
            if (!isNaN(dayNum)) {
                setSelectedBudgetCategory(null); // Clear category selection
                setSelectedDetailDay(selectedDetailDay === dayNum ? null : dayNum);
            }
        }
    };

    // Helper to check over budget
    const getBudgetStatus = (categoryKey: string, actual: number) => {
        const target = budgetTargets[categoryKey] || 0;
        if (target === 0) return { status: 'neutral', percent: 0, remaining: 0 };
        const percent = (actual / target) * 100;
        const remaining = target - actual;
        if (percent > 100) return { status: 'danger', percent, remaining };
        if (percent > 80) return { status: 'warning', percent, remaining };
        return { status: 'success', percent, remaining };
    };

    const hasBudgetAlert = useMemo(() => {
        return Object.keys(totals).some(k => getBudgetStatus(k, totals[k]).status === 'danger');
    }, [totals, budgetTargets]);

    return (
        <div
            className="p-4 sm:p-6 md:p-8 min-h-full bg-gray-50/50"
            onClick={() => {
                setSelectedBudgetCategory(null);
                setEditingCategory(null);
            }}
        >
            <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">

                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{t('budget_view.overview_title')}</h2>
                        <p className="text-gray-500 text-xs sm:text-sm mt-1">{t('budget_view.overview_desc')}</p>
                    </div>

                    <div className="flex items-center gap-2 bg-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl shadow-sm border border-gray-200 self-start sm:self-auto">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">{t('budget_view.total_days', { count: days.length })}</span>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                    {/* Card 1: Total */}
                    <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-gray-100 flex items-center justify-between group hover:border-blue-500 transition-all">
                        <div>
                            <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">{t('budget_view.total_estimated_cost')}</p>
                            <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight group-hover:text-blue-600 transition-colors">
                                <span className="text-sm sm:text-lg align-top mr-1 font-bold text-gray-400">{getCurrencySymbol(tripCurrency)}</span>
                                {safeRender(totalBudget.toLocaleString())}
                            </h3>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                        </div>
                    </div>

                    {/* Card 2: Daily Avg */}
                    <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-gray-100 flex items-center justify-between group hover:border-green-500 transition-all">
                        <div>
                            <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">{t('budget_view.daily_average')}</p>
                            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 group-hover:text-green-600 transition-colors">
                                <span className="text-xs sm:text-sm align-top mr-1 text-gray-400">{getCurrencySymbol(tripCurrency)}</span>
                                {safeRender(averageDailySpend.toLocaleString())}
                            </h3>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                        </div>
                    </div>

                    {/* Card 3: Alert Status (Replaces Highest Category if over budget exists) */}
                    <div className={`bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-gray-100 flex items-center justify-between group transition-all sm:col-span-2 md:col-span-1 ${hasBudgetAlert ? 'hover:border-red-500' : 'hover:border-green-500'
                        }`}>
                        {/* Simple logic: if any category is over budget, show warning */}
                        {hasBudgetAlert ? (
                            <>
                                <div>
                                    <p className="text-sm font-medium text-red-500 mb-1">{t('budget_view.alert_title')}</p>
                                    <h3 className="text-xl font-bold text-gray-900 truncate">
                                        {t('budget_view.alert_over_budget')}
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-1">{t('budget_view.alert_check_list')}</p>
                                </div>
                                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center animate-pulse">
                                    <AlertCircle className="w-6 h-6 text-red-600" />
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">{t('budget_view.status_title')}</p>
                                    <h3 className="text-xl font-bold text-gray-900 truncate">
                                        {t('budget_view.status_within_range')}
                                    </h3>
                                    <p className="text-xs text-green-500 font-medium mt-1">
                                        {t('budget_view.status_all_good')}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                                    <Check className="w-6 h-6 text-green-600" />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">

                    {/* Left Column (Charts & Legend) */}
                    <div className="lg:col-span-12 xl:col-span-7 space-y-6 min-h-screen">

                        {/* Chart Container */}
                        <div className="bg-white rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="font-bold text-lg text-gray-900">{t('budget_view.cost_breakdown_title')}</h3>
                            </div>

                            <div className="flex flex-col items-center gap-8">

                                {/* Donut Chart */}
                                <div id="pie-chart-container" className="w-48 h-48 sm:w-64 sm:h-64 md:w-72 md:h-72 relative shrink-0 outline-none">
                                    <style>{`
                                        #pie-chart-container .recharts-wrapper,
                                        #pie-chart-container .recharts-surface,
                                        #pie-chart-container .recharts-sector,
                                        #pie-chart-container path {
                                            outline: none !important;
                                            box-shadow: none !important;
                                        }
                                        #pie-chart-container *:focus {
                                            outline: none !important;
                                        }
                                    `}</style>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={chartData} // Use Valid Data only
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={80}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                onClick={(prevData) => {
                                                    // Robust check for key: data.key or data.payload.key
                                                    const key = prevData.key || (prevData.payload && prevData.payload.key);
                                                    if (key) {
                                                        setSelectedBudgetCategory(selectedBudgetCategory === key ? null : key);
                                                    }
                                                }}
                                                cornerRadius={6}
                                                cursor="pointer"
                                                stroke="none"
                                            >
                                                {chartData.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={COLORS[index % COLORS.length]}
                                                        opacity={selectedBudgetCategory && selectedBudgetCategory !== entry.key ? 0.3 : 1}
                                                        className="transition-all duration-300 hover:filter hover:brightness-110 focus:outline-none cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const key = entry.key;
                                                            setSelectedBudgetCategory(selectedBudgetCategory === key ? null : key);
                                                        }}
                                                    />
                                                ))}
                                            </Pie>
                                            <ChartTooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                itemStyle={{ color: '#374151', fontWeight: 600 }}
                                                formatter={(value: number) => `${getCurrencySymbol(tripCurrency)}${value.toLocaleString()}`}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>

                                    {/* Centered Total */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">{t('budget_view.total_label')}</span>
                                        <span className="text-2xl font-black text-gray-800">
                                            {totalBudget > 1000000 ? `${(totalBudget / 10000).toFixed(1)}萬` : totalBudget.toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                {/* Legend Positioned Below Chart - Shows ALL Categories */}
                                <div className="w-full grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 sm:gap-3">
                                    {budgetData.map((item, idx) => {
                                        const isSelected = selectedBudgetCategory === item.key;
                                        const status = getBudgetStatus(item.key, item.value);
                                        const color = COLORS[idx % COLORS.length];

                                        return (
                                            <div
                                                key={idx}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedDetailDay(null);
                                                    setSelectedBudgetCategory(isSelected ? null : item.key);
                                                }}
                                                className={`flex flex-col justify-between p-3 sm:p-4 rounded-lg sm:rounded-xl cursor-pointer border transition-all duration-200 group relative ${isSelected
                                                    ? 'bg-gray-900 border-gray-900 text-white shadow-lg shadow-gray-200 scale-[1.02]'
                                                    : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-600 hover:shadow-md'
                                                    }`}
                                            >
                                                {/* Status Dot */}
                                                {status.status === 'danger' && !isSelected && (
                                                    <div className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                )}

                                                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                                                    {/* Color Indicator (Icon Background) */}
                                                    <div
                                                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 transition-colors`}
                                                        style={{
                                                            backgroundColor: `${color}20`,
                                                            color: color
                                                        }}
                                                    >
                                                        {React.createElement(item.icon || Wallet, { className: "w-4 h-4 sm:w-5 sm:h-5" })}
                                                    </div>

                                                    <span className={`font-bold text-xs sm:text-sm truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                                        {item.name}
                                                    </span>
                                                </div>

                                                <div className="flex items-end justify-between">
                                                    <span className={`text-[10px] sm:text-xs ${isSelected ? 'text-gray-400' : 'text-gray-400'}`}>
                                                        {((item.value / totalBudget) * 100).toFixed(0)}%
                                                    </span>
                                                    <span className={`font-bold text-base sm:text-lg leading-none ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                                        {item.value.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Daily Trend Chart */}
                        <div className="bg-white rounded-xl sm:rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-gray-100 p-4 sm:p-6 md:p-8">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-6 sm:mb-8">
                                <div>
                                    <h3 className="font-bold text-base sm:text-lg text-gray-900">{t('budget_view.daily_trend_title')}</h3>
                                </div>
                                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 bg-gray-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-gray-100 self-start sm:self-auto">
                                    <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-brand-500" />
                                    <span className="font-medium">{t('budget_view.average_per_day', { amount: `${getCurrencySymbol(tripCurrency)}${averageDailySpend.toLocaleString()}` })}</span>
                                </div>
                            </div>
                            <style>{`
                                #trend-chart-container .recharts-wrapper,
                                #trend-chart-container .recharts-surface,
                                #trend-chart-container .recharts-layer,
                                #trend-chart-container path,
                                #trend-chart-container circle {
                                    outline: none !important;
                                    box-shadow: none !important;
                                }
                                #trend-chart-container *:focus {
                                    outline: none !important;
                                }
                            `}</style>
                            <div id="trend-chart-container" className="h-48 sm:h-64 md:h-72 w-full outline-none cursor-default">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={dailyTrend}
                                        margin={{ top: 30, right: 20, left: 0, bottom: 10 }} // Increased margins for labels
                                        onClick={handleTrendClick}
                                        className="cursor-pointer"
                                    >
                                        <defs>
                                            <linearGradient id="colorBrand" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />

                                        <XAxis
                                            dataKey="day"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 500 }}
                                            dy={10}
                                            tickFormatter={(value) => value.replace('Day ', '')}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 500 }}
                                            tickFormatter={(value) => `${value.toLocaleString()}`}
                                        />
                                        <ChartTooltip
                                            cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '4 4' }}
                                            contentStyle={{
                                                borderRadius: '16px',
                                                border: 'none',
                                                boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.1)',
                                                padding: '12px 16px',
                                            }}
                                            formatter={(value: number) => [
                                                <span className="text-gray-900 font-bold text-base">{getCurrencySymbol(tripCurrency)}{value.toLocaleString()}</span>,
                                                <span className="text-gray-500 text-xs uppercase tracking-wider">{t('budget_view.spending')}</span>
                                            ]}
                                            labelStyle={{ color: '#6B7280', fontSize: '12px', marginBottom: '4px' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="amount"
                                            stroke="#3B82F6"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorBrand)"
                                            activeDot={{ r: 6, strokeWidth: 0, fill: '#2563EB', fillOpacity: 1 }}
                                            animationDuration={1500}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Right Column (Conditional: Dashbord vs Details) */}
                    <div className="lg:col-span-12 xl:col-span-5">
                        {selectedDetailDay ? (
                            // MODE: VIEW DAY DETAILS
                            <div className="sticky top-20 z-10 max-h-[calc(100vh-180px)] flex flex-col">
                                <div
                                    className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-200 overflow-hidden h-full flex flex-col"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 backdrop-blur-sm shrink-0">
                                        <div>
                                            <h4 className="font-bold text-gray-900 flex items-center gap-2">
                                                <Calendar className="w-5 h-5 text-brand-600" />
                                                <Calendar className="w-5 h-5 text-brand-600" />
                                                {t('timeline.day_label', { day: selectedDetailDay })}
                                                <span className="text-gray-400 font-normal">{t('budget_view.daily_list_title')}</span>
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-0.5 ml-7">{t('budget_view.total_items', { count: dayItems.length })}</p>
                                        </div>
                                        <button
                                            onClick={() => setSelectedDetailDay(null)}
                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-900 hover:border-gray-300 transition-all shadow-sm"
                                        >
                                            <XCircle className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-200 flex-1 bg-gray-50/30">
                                        <div className="space-y-3">
                                            {dayItems.map((stop, i) => {
                                                // Determine Category & Color for EACH item independently
                                                let catKey = 'other';
                                                // Reuse simple logic or just check type strictly
                                                if (stop.costCategory) catKey = stop.costCategory;
                                                else if (stop.type && ['dining', 'cafe'].includes(stop.type)) catKey = 'dining';
                                                else if (stop.type && ['transport'].includes(stop.type)) catKey = 'transport';
                                                else if (stop.type && ['shopping'].includes(stop.type)) catKey = 'shopping';
                                                else if (stop.type && ['accommodation'].includes(stop.type)) catKey = 'accommodation';
                                                else if (stop.type && ['attraction', 'landmark', 'nature', 'activity'].includes(stop.type)) catKey = 'tickets';

                                                const catIdx = Object.keys(CATEGORY_MAP).indexOf(catKey);

                                                // Fix: Use dynamic color from budgetData (spending order) to match dashboard buttons
                                                const displayName = CATEGORY_MAP[catKey];
                                                const budgetIndex = budgetData.findIndex(b => b.name === displayName);
                                                // Fallback to static catIdx if not found in budgetData (e.g. 0 spending in that category?? unlikely if present here)
                                                // Actually if 0 spending it might not be in budgetData if filtered. 
                                                // budgetData in line 145 includes all categories.
                                                const themeColor = budgetIndex !== -1 ? COLORS[budgetIndex % COLORS.length] :
                                                    (catIdx !== -1 ? COLORS[catIdx % COLORS.length] : '#9CA3AF');

                                                const ItemIcon = CATEGORY_ICONS[catKey] || Wallet;

                                                return (
                                                    <div
                                                        key={i}
                                                        className="group relative bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                                                    >
                                                        <div className="flex items-start gap-4">
                                                            {/* Icon Box */}
                                                            <div
                                                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                                                                style={{
                                                                    backgroundColor: `${themeColor}20`,
                                                                    color: themeColor
                                                                }}
                                                            >
                                                                <ItemIcon className="w-5 h-5" />
                                                            </div>

                                                            <div className="flex-1 flex justify-between items-start">
                                                                <div className="space-y-1">
                                                                    <h5 className="font-bold text-gray-900 text-sm leading-snug">{stop.name}</h5>
                                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                                        <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-md text-gray-500 font-medium border border-gray-100">
                                                                            <Clock className="w-3 h-3" />
                                                                            <span>Day {selectedDetailDay}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="text-right">
                                                                    <span
                                                                        className="font-bold text-base block"
                                                                        style={{ color: themeColor }}
                                                                    >
                                                                        ¥{(stop.costAmount || parseCostToNumber(stop.costEstimate)).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : selectedBudgetCategory ? (
                            // MODE: VIEW DETAILS
                            <div className="sticky top-20 z-10 max-h-[calc(100vh-180px)] flex flex-col">
                                <div
                                    className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-200 overflow-hidden h-full flex flex-col"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 backdrop-blur-sm shrink-0">
                                        {/* Find Color for the selected category */}
                                        {(() => {
                                            // Fix: Find index in budgetData to match the button color logic exactly
                                            const foundIndex = budgetData.findIndex(b => b.key === selectedBudgetCategory);
                                            const themeColor = foundIndex !== -1 ? COLORS[foundIndex % COLORS.length] : '#3B82F6';

                                            return (
                                                <>
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 flex items-center gap-2">
                                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: themeColor }} />
                                                            {/* Localize Category Name if it matches a key */}
                                                            {t(`categories.${selectedBudgetCategory}`, selectedBudgetCategory || '')}
                                                            <span className="text-gray-400 font-normal">{t('budget_view.detail_list_title')}</span>
                                                        </h4>
                                                        <p className="text-xs text-gray-500 mt-0.5 ml-5">{t('budget_view.total_items', { count: selectedItems.length })}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setSelectedBudgetCategory(null)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-900 hover:border-gray-300 transition-all shadow-sm"
                                                    >
                                                        <XCircle className="w-5 h-5" />
                                                    </button>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    <div className="overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-200 flex-1 bg-gray-50/30">
                                        <div className="space-y-3">
                                            {selectedItems.map((stop, i) => {
                                                const catKey = selectedBudgetCategory || 'other';

                                                // Fix: Find index in budgetData to match the button color logic exactly
                                                const foundIndex = budgetData.findIndex(b => b.key === selectedBudgetCategory);
                                                const themeColor = foundIndex !== -1 ? COLORS[foundIndex % COLORS.length] : '#3B82F6';

                                                return (
                                                    <div
                                                        key={i}
                                                        className="group relative bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                                                    >
                                                        <div className="flex items-start gap-4">
                                                            {/* Icon Box (Replaces Accent Bar) */}
                                                            <div
                                                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                                                                style={{
                                                                    backgroundColor: `${themeColor}20`,
                                                                    color: themeColor
                                                                }}
                                                            >
                                                                {/* Use specific icon based on type if available, else generic category icon */}
                                                                {stop.type === 'dining' || catKey === 'dining' ? <Utensils className="w-5 h-5" /> :
                                                                    catKey === 'transport' ? <Train className="w-5 h-5" /> :
                                                                        catKey === 'accommodation' ? <Landmark className="w-5 h-5" /> :
                                                                            catKey === 'shopping' ? <Wallet className="w-5 h-5" /> :
                                                                                <MapPin className="w-5 h-5" />
                                                                }
                                                            </div>

                                                            <div className="flex-1 flex justify-between items-start">
                                                                <div className="space-y-1">
                                                                    <h5 className="font-bold text-gray-900 text-sm leading-snug">{stop.name}</h5>
                                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                                        <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-md text-gray-500 font-medium border border-gray-100">
                                                                            <Clock className="w-3 h-3" />
                                                                            <span>Day {days.find(d => d.stops.includes(stop))?.day}</span>
                                                                        </div>
                                                                        {/* <span className="text-gray-300">|</span> */}
                                                                        {/* <span className="capitalize">{stop.type || 'Activity'}</span> */}
                                                                    </div>
                                                                </div>

                                                                <div className="text-right">
                                                                    <span
                                                                        className="font-bold text-base block"
                                                                        style={{ color: themeColor }}
                                                                    >
                                                                        {getCurrencySymbol(tripCurrency)}{(stop.costAmount || parseCostToNumber(stop.costEstimate)).toLocaleString()}
                                                                    </span>
                                                                    {/* Show Multiplier Badge if applicable */}
                                                                    {(() => {
                                                                        const catKey = stop.costCategory || (stop.type === 'dining' ? 'dining' : stop.type === 'transport' ? 'transport' : 'other');
                                                                        const isPerPerson = ['dining', 'transport', 'tickets'].includes(catKey);
                                                                        if (isPerPerson && travelerCount > 1) {
                                                                            return (
                                                                                <span className="text-xs text-gray-400 block mt-0.5">
                                                                                    x{travelerCount} {t('budget_view.people_label', 'people')}
                                                                                </span>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // MODE: BUDGET SETTINGS DASHBOARD
                            <div className="sticky top-20 z-10 max-h-[calc(100vh-180px)] flex flex-col">
                                <div className="bg-white rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden flex flex-col h-full">
                                    <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                                        <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                            <Edit2 className="w-4 h-4 text-brand-600" />
                                            {t('budget_view.control_panel_title')}
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {t('budget_view.control_panel_desc')}
                                        </p>
                                    </div>

                                    <div className="p-4 space-y-4 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-200">
                                        {Object.keys(CATEGORY_MAP).map((key, idx) => {
                                            const actual = totals[key] || 0;
                                            const target = budgetTargets[key] || 0;
                                            const { status, percent, remaining } = getBudgetStatus(key, actual);
                                            const isEditing = editingCategory === key;
                                            const DisplayName = CATEGORY_MAP[key];

                                            // Show ALL categories now
                                            // if (actual === 0 && target === 0) return null; 

                                            return (
                                                <div key={key} className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-300 transition-all">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${status === 'danger' ? 'bg-red-500' : status === 'warning' ? 'bg-orange-400' : 'bg-green-500'}`} />
                                                            <span className="font-bold text-gray-700">{t(`categories.${key}`, DisplayName)}</span>
                                                        </div>

                                                        {/* Edit Mode vs View Mode */}
                                                        {isEditing ? (
                                                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                                <input
                                                                    autoFocus
                                                                    type="text"
                                                                    className="w-24 text-right text-sm px-2 py-1 rounded border border-gray-300 focus:outline-none focus:border-brand-500"
                                                                    value={editingValue}
                                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleSaveTarget(key);
                                                                        if (e.key === 'Escape') setEditingCategory(null);
                                                                    }}
                                                                    placeholder="0"
                                                                />
                                                                <button
                                                                    onClick={() => handleSaveTarget(key)}
                                                                    className="p-1 rounded bg-brand-100 text-brand-600 hover:bg-brand-200"
                                                                >
                                                                    <Check className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="flex items-center gap-1 cursor-pointer group"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingCategory(key);
                                                                    setEditingValue(target === 0 ? '' : target.toString());
                                                                }}

                                                            >
                                                                <span className={`text-sm font-bold ${actual > target && target > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                                    {target === 0 ? t('budget_view.set_limit') : `${getCurrencySymbol(tripCurrency)}${target.toLocaleString()}`}
                                                                </span>
                                                                <Edit2 className="w-3 h-3 text-gray-300 group-hover:text-gray-500" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Progress Bar */}
                                                    <div className="relative h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                                        <div
                                                            className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${status === 'danger' ? 'bg-red-500' :
                                                                status === 'warning' ? 'bg-orange-400' :
                                                                    'bg-brand-500'
                                                                }`}
                                                            style={{ width: `${Math.min(percent, 100)}%` }}
                                                        />
                                                    </div>

                                                    {/* Footer Stats */}
                                                    <div className="flex justify-between items-center mt-2 text-xs">
                                                        <span className="text-gray-500">{t('budget_view.spent_label')} <span className="font-medium text-gray-900">{getCurrencySymbol(tripCurrency)}{actual.toLocaleString()}</span></span>
                                                        {target > 0 && (
                                                            <span className={status === 'danger' ? 'text-red-600 font-bold' : 'text-gray-400'}>
                                                                {status === 'danger' ? `${t('budget_view.over_budget_label')} ${getCurrencySymbol(tripCurrency)}${Math.abs(remaining).toLocaleString()}` : `${t('budget_view.remaining_label')} ${getCurrencySymbol(tripCurrency)}${remaining.toLocaleString()}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}