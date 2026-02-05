import React, { useMemo } from 'react';
import { TripMeta } from '../../types';
import { safeRender } from '../../utils/formatters';
import { useTranslation } from 'react-i18next';
import {
    AlertTriangle, ShieldCheck, CloudRain, Car, Users,
    Thermometer, Mountain, AlertOctagon, Info, CheckCircle2
} from 'lucide-react';

interface Props {
    risks: string[];
    tripMeta?: TripMeta;
}

// Keyword mapping for smart icons and colors
const getRiskCategory = (text: string) => {
    const lowerText = text.toLowerCase();

    if (lowerText.match(/(rain|snow|weather|climate|storm|typhoon|forecast|temperature|cold|hot|sun)/)) {
        return { type: 'weather', icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' };
    }
    if (lowerText.match(/(traffic|train|bus|flight|subway|transport|drive|road|rush hour|commute)/)) {
        return { type: 'transport', icon: Car, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' };
    }
    if (lowerText.match(/(crowd|queue|busy|popular|book|reservation|wait|holiday|peak)/)) {
        return { type: 'crowd', icon: Users, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200' };
    }
    if (lowerText.match(/(health|hike|hiking|physical|altitude|sickness|tired|exhaust|walk)/)) {
        return { type: 'health', icon: Mountain, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    }
    if (lowerText.match(/(safe|scam|pickpocket|crime|emergency|danger|security|warning)/)) {
        return { type: 'safety', icon: AlertOctagon, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' };
    }

    // Default
    return { type: 'general', icon: Info, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' };
};

export default function RiskAssessmentView({ risks = [], tripMeta }: Props) {
    const { t } = useTranslation();

    const categorizedRisks = useMemo(() => {
        return risks.map(risk => ({
            text: risk,
            ...getRiskCategory(risk)
        }));
    }, [risks]);

    if (!risks || risks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[400px]">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6 animate-in fade-in zoom-in duration-500">
                    <ShieldCheck className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {t('risk_view.all_clear_title', '行程看起來非常順利')}
                </h3>
                <p className="text-gray-500 max-w-md">
                    {t('risk_view.all_clear_desc', 'AI 目前沒有偵測到顯著的風險或問題。祝您旅途愉快！')}
                </p>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 min-h-full bg-gray-50/50">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                            {t('trip.risks_title', '潛在風險與建議')}
                            <span className="text-sm font-medium bg-orange-100 text-orange-700 px-3 py-1 rounded-full border border-orange-200">
                                {risks.length} {t('risk_view.count_suffix', '個提示')}
                            </span>
                        </h2>
                        <p className="text-gray-500 text-sm mt-1">
                            {t('risk_view.subtitle', 'AI 根據您的行程安排、季節與當地狀況，為您整理的注意事項。')}
                        </p>
                    </div>
                </div>

                {/* Risk Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categorizedRisks.map((item, idx) => (
                        <div
                            key={idx}
                            className={`group relative bg-white p-6 rounded-2xl shadow-sm border ${item.border} hover:shadow-md transition-all duration-300 overflow-hidden flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2`}
                            style={{ animationDelay: `${idx * 100}ms` }}
                        >
                            {/* Icon */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${item.bg} ${item.color} group-hover:scale-110 transition-transform duration-300`}>
                                <item.icon className="w-6 h-6" strokeWidth={2} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${item.bg} ${item.color}`}>
                                        {/* You might want to translate these categories too if needed */}
                                        {item.type.toUpperCase()}
                                    </span>
                                </div>
                                <p className="text-gray-700 leading-relaxed font-medium">
                                    {safeRender(item.text)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom Disclaimer */}
                <div className="bg-blue-50/50 rounded-xl p-4 flex items-start gap-3 border border-blue-100 text-sm text-blue-700">
                    <Info className="w-5 h-5 shrink-0 mt-0.5" />
                    <p>
                        {t('risk_view.disclaimer', '以上建議為 AI 基於一般旅遊資訊生成，僅供參考。實際情況請以當地最新公告與天氣預報為準。')}
                    </p>
                </div>
            </div>
        </div>
    );
}
