import React from 'react';
import ReactDOM from 'react-dom';
import { X, Infinity, Bot, ShieldCheck, Upload, Sparkles, ChevronRight, Crown, Star } from 'lucide-react';
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
            title: t('pro_promo.benefits.export.title', '匯出行程資料'),
            desc: t('pro_promo.benefits.export.desc', '支援完整的 JSON 格式匯出')
        },
        {
            icon: Infinity,
            key: 'ai',
            title: t('pro_promo.benefits.ai.title', '無限 AI 生成'),
            desc: t('pro_promo.benefits.ai.desc', '無限制建立您的專屬行程')
        },
        {
            icon: ShieldCheck,
            key: 'sync',
            title: t('pro_promo.benefits.sync.title', '雲端自動備份'),
            desc: t('pro_promo.benefits.sync.desc', '多裝置同步，資料不遺失')
        },
        {
            icon: Bot,
            key: 'support',
            title: t('pro_promo.benefits.support.title', 'AI 旅遊顧問'),
            desc: t('pro_promo.benefits.support.desc', '24/7 隨時解答您的旅遊疑問')
        }
    ];

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Content - Split Layout */}
            <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300 min-h-[500px]">

                {/* Close Button (Mobile Only) */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-white/80 rounded-full transition-all z-30 md:hidden"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* LEFT PANEL: Premium Visual */}
                <div className="relative w-full md:w-2/5 bg-gray-900 p-8 md:p-12 text-white flex flex-col justify-center overflow-hidden">
                    {/* Background Effects */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                    {/* Content Container */}
                    <div className="relative z-10 flex flex-col h-full">

                        {/* 1. Badge (Top) */}
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-xs font-bold tracking-wider uppercase mb-8 text-brand-300 shadow-sm">
                                <Crown className="w-3 h-3" />
                                <span>{t('pro_promo.badge', 'Premium Member')}</span>
                            </div>
                        </div>

                        {/* 2. Main Text (Center) */}
                        <div className="flex-1 flex flex-col justify-center mb-8">
                            <h2 className="text-4xl md:text-5xl font-black leading-none mb-6 tracking-tight">
                                Unlock <br />
                                <span className="text-3xl md:text-4xl text-brand-300 drop-shadow-sm">
                                    Infinite Possibilities
                                </span>
                            </h2>
                            <p className="text-gray-400 text-base md:text-lg leading-relaxed font-medium">
                                {t('pro_promo.hero_desc', '升級您的旅程，享受專為深度旅遊者設計的獨家工具。')}
                            </p>
                        </div>

                        {/* 3. Security Badge (Bottom Fixed) - REPLACED TRUST BADGE */}
                        <div className="mt-auto">
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm self-start flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0 border border-brand-500/30">
                                    <ShieldCheck className="w-6 h-6 text-brand-300" />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-white mb-0.5">
                                        {t('pro_promo.security_title', '資料安全保障')}
                                    </h4>
                                    <p className="text-xs text-gray-400 font-medium leading-snug">
                                        {t('pro_promo.security_desc', '採用企業級加密技術保護您的行程')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL: Features & Action */}
                <div className="relative w-full md:w-3/5 bg-white p-8 md:p-12 flex flex-col justify-center">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all hidden md:block"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <h3 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2">
                        {t('pro_promo.whats_included', '完整免費功能，以及：')}
                    </h3>

                    {/* Grid of Benefits */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
                        {benefits.map((benefit) => (
                            <div key={benefit.key} className="flex gap-3">
                                <div className="shrink-0 w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
                                    <benefit.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm md:text-base">{benefit.title}</h4>
                                    <p className="text-xs md:text-sm text-gray-500 leading-snug">{benefit.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CTA Section */}
                    <div className="pt-6 border-t border-gray-100 flex flex-col gap-3">
                        <button
                            onClick={onUpgrade}
                            className="group w-full py-4 bg-gray-900 hover:bg-black text-white text-lg rounded-xl font-bold shadow-xl shadow-gray-200 hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                        >
                            <span>{t('pro_promo.upgrade_btn', '立即升級會員')}</span>
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>

                        {/* Cancel Button */}
                        <button
                            onClick={onClose}
                            className="w-full py-2 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            {t('pro_promo.later_btn', '稍後再說')}
                        </button>
                    </div>
                </div>

            </div>
        </div>,
        document.body
    );
}
