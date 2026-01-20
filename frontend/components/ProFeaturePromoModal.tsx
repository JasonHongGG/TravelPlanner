import React from 'react';
import ReactDOM from 'react-dom';
import { X, Check, Infinity, Bot, ShieldCheck, Upload, Sparkles, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onUpgrade: () => void;
}

export default function ProFeaturePromoModal({ isOpen, onClose, onUpgrade }: Props) {
    const { t } = useTranslation();

    if (!isOpen) return null;

    const benefits = [
        {
            icon: Upload,
            key: 'export',
            color: 'text-blue-500',
            bg: 'bg-blue-50',
            border: 'border-blue-100'
        },
        {
            icon: Infinity,
            key: 'ai',
            color: 'text-purple-500',
            bg: 'bg-purple-50',
            border: 'border-purple-100'
        },
        {
            icon: ShieldCheck,
            key: 'sync',
            color: 'text-emerald-500',
            bg: 'bg-emerald-50',
            border: 'border-emerald-100'
        },
        {
            icon: Bot,
            key: 'support',
            color: 'text-amber-500',
            bg: 'bg-amber-50',
            border: 'border-amber-100'
        }
    ];

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-[420px] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">

                {/* Minimalist Background Decoration */}
                <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-gray-50 to-white pointer-events-none" />
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-100/50 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -top-12 -left-12 w-48 h-48 bg-blue-100/50 rounded-full blur-3xl pointer-events-none" />

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all z-20"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="relative z-10 px-8 pt-10 pb-2 text-center">
                    <div className="inline-flex items-center justify-center p-3 mb-6 bg-gradient-to-tr from-purple-100 to-white rounded-2xl shadow-sm border border-purple-50 ring-4 ring-purple-50/50">
                        <Sparkles className="w-8 h-8 text-purple-600 fill-purple-600" />
                    </div>

                    <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight leading-tight">
                        {t('pro_promo.title')}
                    </h2>
                    <p className="text-gray-500 text-sm font-medium leading-relaxed px-4">
                        {t('pro_promo.desc')}
                    </p>
                </div>

                {/* Benefits List (Compact Vertical) */}
                <div className="relative z-10 px-6 py-6 space-y-3">
                    {benefits.map((benefit) => (
                        <div
                            key={benefit.key}
                            className={`group flex items-start gap-4 p-3 rounded-xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-md transition-all duration-300 cursor-default`}
                        >
                            <div className={`shrink-0 w-10 h-10 ${benefit.bg} ${benefit.color} rounded-lg flex items-center justify-center transition-transform group-hover:scale-110`}>
                                <benefit.icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                                <h3 className="text-sm font-bold text-gray-900 mb-0.5 truncate">
                                    {t(`pro_promo.benefits.${benefit.key}.title`)}
                                </h3>
                                <p className="text-xs text-gray-500 leading-normal line-clamp-2">
                                    {t(`pro_promo.benefits.${benefit.key}.desc`)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div className="relative z-10 p-6 pt-2 bg-gradient-to-t from-white via-white to-transparent">
                    <button
                        onClick={onUpgrade}
                        className="group w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold shadow-lg shadow-gray-200 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 overflow-hidden mb-3"
                    >
                        <span className="flex items-center gap-2">
                            {t('pro_promo.upgrade_btn')}
                            <ChevronRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 transition-transform" />
                        </span>
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full py-2.5 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        {t('pro_promo.cancel_btn')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
