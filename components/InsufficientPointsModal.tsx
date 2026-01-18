import React from 'react';
import { X, ArrowRight, Zap, BatteryWarning } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    requiredPoints: number;
    currentPoints: number;
    onPurchaseClick: () => void;
}

export default function InsufficientPointsModal({ isOpen, onClose, requiredPoints, currentPoints, onPurchaseClick }: Props) {
    if (!isOpen) return null;

    const missingPoints = requiredPoints - currentPoints;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Main Card */}
            <div className="relative w-full max-w-[400px] overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-300">

                {/* Decorative Background Elements */}
                <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-brand-50/80 to-transparent pointer-events-none" />
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-sky-100 rounded-full blur-3xl opacity-60 pointer-events-none" />
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-brand-100 rounded-full blur-3xl opacity-60 pointer-events-none" />

                <div className="relative p-8 flex flex-col items-center text-center">

                    {/* Icon Group */}
                    <div className="relative mb-6">
                        <div className="w-20 h-20 bg-white rounded-3xl shadow-xl shadow-brand-100 flex items-center justify-center relative z-10 border border-white">
                            <div className="w-16 h-16 bg-gradient-to-tr from-brand-100 to-sky-50 rounded-2xl flex items-center justify-center">
                                <Zap className="w-8 h-8 text-brand-600 fill-brand-600" />
                            </div>
                        </div>
                        {/* Decorative particles */}
                        <div className="absolute top-0 right-0 -mt-2 -mr-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-sm z-20 animate-bounce">
                            <BatteryWarning className="w-3 h-3 text-white" />
                        </div>
                    </div>

                    <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
                        能量不足
                    </h3>

                    <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-[280px] font-medium">
                        生成此行程需要更多點數，<br />
                        立即補充以繼續您的探索旅程。
                    </p>

                    {/* Status Card */}
                    <div className="w-full bg-gray-50 rounded-2xl p-5 border border-gray-100 mb-8 grid grid-cols-3 divide-x divide-gray-200 shadow-inner">
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">持有</span>
                            <span className="text-xl font-black text-gray-700 font-mono">{currentPoints}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">需要</span>
                            <span className="text-xl font-black text-gray-900 font-mono">{requiredPoints}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] uppercase font-bold text-red-500 tracking-wider">不足</span>
                            <span className="text-xl font-black text-red-500 font-mono">-{missingPoints}</span>
                        </div>
                    </div>

                    {/* Main Action */}
                    <button
                        onClick={() => {
                            onClose();
                            onPurchaseClick();
                        }}
                        className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-200 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group"
                    >
                        <span>前往儲值中心</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>

                    {/* Secondary Action */}
                    <button
                        onClick={onClose}
                        className="mt-5 text-xs font-bold text-gray-400 hover:text-gray-700 transition-colors py-2"
                    >
                        稍後再說
                    </button>
                </div>

                {/* Close X */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-gray-300 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
                >
                    <X className="w-5 h-5" />
                </button>

            </div>
        </div>
    );
}
