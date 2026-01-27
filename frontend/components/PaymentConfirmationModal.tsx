
import React from 'react';
import { Sparkles, MapPin, Coins, ArrowRight } from 'lucide-react';

interface PaymentConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    subtitle: string;
    targetLabel: string;
    targetValue: string | React.ReactNode;
    costLabel: string;
    cost: number;
    balance: number;
    isSubscribed: boolean;
    confirmBtnText?: string;
    memberFreeLabel?: string;
    cancelBtnText?: string;
    insufficientPointsLabel?: string;
    onInsufficientPointsClick?: () => void;
}

export default function PaymentConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    subtitle,
    targetLabel,
    targetValue,
    costLabel,
    cost,
    balance,
    isSubscribed,
    confirmBtnText = "確認支付",
    memberFreeLabel = "會員免費",
    cancelBtnText = "取消",
    insufficientPointsLabel = "儲值點數",
    onInsufficientPointsClick
}: PaymentConfirmationModalProps) {
    if (!isOpen) return null;

    const canAfford = isSubscribed || balance >= cost;
    const remainingBalance = isSubscribed ? balance : balance - cost;

    const handleInsufficientPoints = () => {
        if (onInsufficientPointsClick) {
            onInsufficientPointsClick();
        } else {
            window.location.href = '/pricing';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header Gradient - Sky/Blue Theme */}
                <div className="bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-6 text-white relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 text-white/10">
                        <Sparkles className="w-24 h-24" />
                    </div>
                    <h3 className="text-xl font-bold relative z-10 flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        {title}
                    </h3>
                    <p className="text-blue-50 text-sm mt-1 relative z-10">
                        {subtitle}
                    </p>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Target Box */}
                    <div className="flex items-center justify-between mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div className="text-gray-500 text-sm">{targetLabel}</div>
                        <div className="font-bold text-gray-900 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-sky-500" />
                            {targetValue}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">{costLabel}</span>
                            <span className="font-medium">{cost} 點</span>
                        </div>
                        <div className="h-px bg-gray-100 my-2"></div>
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-900">總計花費</span>
                            <span className="font-black text-xl text-sky-600 flex items-center gap-1">
                                <Coins className="w-5 h-5" />
                                {isSubscribed ? (
                                    <>
                                        <span className="line-through text-gray-400 text-base mr-2">{cost}</span>
                                        <span>{memberFreeLabel}</span>
                                    </>
                                ) : (
                                    <span>{cost}</span>
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Balance Preview (Transformation View) */}
                    <div className="mt-6 bg-sky-50/50 rounded-xl p-3 flex items-center justify-between text-sm border border-sky-200">
                        <div className="flex flex-col">
                            <span className="text-gray-500 text-xs">目前點數</span>
                            <span className="font-bold text-gray-700">{balance}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <div className="flex flex-col items-end">
                            <span className="text-gray-500 text-xs">剩餘點數</span>
                            <span className={`font-bold ${!isSubscribed && remainingBalance < 0 ? 'text-red-600' : 'text-sky-600'}`}>
                                {remainingBalance}
                            </span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 mt-8">
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                        >
                            {cancelBtnText}
                        </button>
                        {canAfford ? (
                            <button
                                onClick={() => {
                                    onConfirm();
                                    onClose();
                                }}
                                className="px-4 py-2.5 rounded-xl bg-sky-600 text-white font-bold hover:bg-sky-700 transition-colors flex items-center justify-center gap-2"
                            >
                                {confirmBtnText}
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                onClick={handleInsufficientPoints}
                                className="px-4 py-2.5 rounded-xl bg-gray-900 text-white font-bold hover:bg-black transition-all shadow-lg shadow-gray-200 flex items-center justify-center gap-2"
                            >
                                {insufficientPointsLabel}
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
