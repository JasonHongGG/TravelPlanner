
import React from 'react';
import { AlertTriangle, CheckCircle, ArrowRight, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FeasibilityResult } from '../types';

interface Props {
    result: FeasibilityResult;
    onCancel: () => void;
    onProceed: () => void;
    isOpen: boolean;
}

export default function FeasibilityModal({ result, onCancel, onProceed, isOpen }: Props) {
    const { t } = useTranslation();

    if (!isOpen) return null;

    const isHighRisk = result.riskLevel === 'high';
    const colorClass = isHighRisk ? 'text-red-600 bg-red-50 border-red-200' : 'text-orange-600 bg-orange-50 border-orange-200';
    const btnClass = isHighRisk ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onCancel} />

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-start">
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${colorClass}`}>
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">
                                {isHighRisk ? t('feasibility.title_risk') : t('feasibility.title_suggestion')}
                            </h3>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {t('feasibility.desc')}
                            </p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">

                    {/* Issues */}
                    {result.issues.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('feasibility.issues')}</h4>
                            <div className="space-y-2">
                                {result.issues.map((issue, idx) => (
                                    <div key={idx} className={`flex items-start gap-2 text-sm p-3 rounded-lg border ${isHighRisk ? 'bg-red-50 border-red-100 text-red-800' : 'bg-orange-50 border-orange-100 text-orange-800'}`}>
                                        <span className="mt-0.5 font-bold">•</span>
                                        <span className="leading-relaxed">{issue}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Suggestions */}
                    {result.suggestions.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('feasibility.suggestions')}</h4>
                            <div className="space-y-2">
                                {result.suggestions.map((suggestion, idx) => (
                                    <div key={idx} className="flex items-start gap-2 text-sm text-gray-700 p-3 rounded-lg bg-gray-50 border border-gray-200">
                                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                        <span className="leading-relaxed">{suggestion}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 text-gray-600 font-bold text-sm hover:bg-gray-200 rounded-xl transition-colors"
                    >
                        {t('feasibility.back')}
                    </button>
                    <button
                        onClick={onProceed}
                        className={`px-6 py-2.5 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 ${btnClass}`}
                    >
                        <span>{t('feasibility.ignore')}</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>

            </div>
        </div>
    );
}