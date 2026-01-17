
import React from 'react';
import ReactDOM from 'react-dom';
import { X, Calendar, TrendingUp, TrendingDown, History, CircleDollarSign } from 'lucide-react';
import { usePoints } from '../context/PointsContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function TransactionHistoryModal({ isOpen, onClose }: Props) {
    const { transactions } = usePoints();

    if (!isOpen) return null;

    // Helper to format date relative (Today, Yesterday, or full date)
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return `今天 ${date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays === 1) {
            return `昨天 ${date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">

                {/* Header with decorative background */}
                <div className="relative p-6 border-b border-gray-100 bg-gray-50/50 overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-100 rounded-full blur-3xl opacity-50"></div>
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-purple-100 rounded-full blur-3xl opacity-50"></div>

                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                                <History className="w-6 h-6 text-brand-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-900">交易歷史紀錄</h2>
                                <p className="text-sm text-gray-500 font-medium">查看您的點數變動明細</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-200/50 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white min-h-[400px]">
                    {transactions.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-0 animate-in fade-in duration-700 fill-mode-forwards">
                            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 border border-gray-100">
                                <CircleDollarSign className="w-10 h-10 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">尚無交易紀錄</h3>
                            <p className="text-gray-500 max-w-xs text-sm">
                                您目前的帳戶尚未有任何點數變動。開始規畫您的第一趟旅程吧！
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {transactions.map((tx, index) => {
                                const isPurchase = tx.type === 'purchase';
                                const isPositive = tx.amount > 0; // Sometimes 'spend' might be refund? Assume amount sign is truth

                                return (
                                    <div
                                        key={tx.id || index}
                                        className="group flex items-center justify-between p-4 rounded-2xl border border-gray-100 hover:border-brand-100 hover:bg-brand-50/20 hover:shadow-sm transition-all duration-200"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${isPurchase
                                                    ? 'bg-green-50 border-green-100 text-green-600'
                                                    : 'bg-orange-50 border-orange-100 text-orange-600'
                                                }`}>
                                                {isPurchase ? (
                                                    <TrendingUp className="w-5 h-5" />
                                                ) : (
                                                    <TrendingDown className="w-5 h-5" />
                                                )}
                                            </div>

                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-900 text-sm group-hover:text-brand-700 transition-colors">
                                                    {tx.description}
                                                </span>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                                                    <Calendar className="w-3 h-3" />
                                                    <span>{formatDate(tx.date)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={`text-base font-black tracking-tight ${isPositive ? 'text-green-600' : 'text-gray-900'
                                            }`}>
                                            {isPositive ? '+' : ''}{tx.amount}
                                            <span className="text-xs font-medium ml-1 text-gray-400">P</span>
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="text-center pt-8 pb-4">
                                <span className="text-[10px] text-gray-300 tracking-widest uppercase">End of History</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Summary */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                    <span>共 {transactions.length} 筆紀錄</span>
                    <span className="font-mono">ID: {transactions.length > 0 ? transactions[0].id?.slice(0, 8) : '---'}...</span>
                </div>
            </div>
        </div>,
        document.body
    );
}
