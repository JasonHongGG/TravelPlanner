import React from 'react';
import ReactDOM from 'react-dom';
import { X, FileJson, Lock, Download, ShieldCheck, Crown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePoints } from '../context/PointsContext';

interface ExportTripModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExportJson: () => void;
    onExportHong: () => void;
    tripTitle: string;
}

export default function ExportTripModal({ isOpen, onClose, onExportJson, onExportHong, tripTitle }: ExportTripModalProps) {
    const { t } = useTranslation();
    const { isSubscribed } = usePoints();

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-white/20">

                {/* Decorative Background */}
                <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-br from-indigo-50 via-white to-white pointer-events-none" />
                <div className="absolute -top-32 -right-32 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -top-20 -left-20 w-60 h-60 bg-indigo-100/40 rounded-full blur-3xl pointer-events-none" />

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-600 hover:bg-white/80 rounded-full transition-all z-20"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="relative z-10 px-8 pt-10 pb-6 text-center">
                    <div className="inline-flex items-center justify-center p-4 mb-5 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100">
                        <Download className="w-6 h-6 text-brand-600" />
                    </div>

                    <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
                        匯出您的旅程
                    </h2>
                    <p className="text-gray-500 text-sm font-medium">
                        選擇適合您的匯出格式。<br />
                        <span className="font-bold text-gray-700">{tripTitle}</span>
                    </p>
                </div>

                {/* Options Grid */}
                <div className="relative z-10 px-6 pb-8 space-y-4">

                    {/* .hong Option (Free) */}
                    <button
                        onClick={onExportHong}
                        className="group relative w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-brand-100 bg-gradient-to-r from-brand-50/50 to-white hover:border-brand-500 hover:shadow-lg hover:shadow-brand-100/50 hover:-translate-y-0.5 transition-all duration-300 text-left"
                    >
                        <div className="shrink-0 w-12 h-12 bg-white rounded-xl shadow-sm border border-brand-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <Lock className="w-6 h-6 text-brand-600" strokeWidth={2.5} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-gray-900 text-lg">
                                    加密格式 <span className="text-brand-600 font-black">.hong</span>
                                </h3>
                                <span className="px-2 py-0.5 bg-brand-600 text-white text-[10px] font-bold rounded-full tracking-wider uppercase">
                                    Free
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 font-medium leading-relaxed">
                                專屬加密格式，僅限本站讀取，<br className="hidden sm:block" />保護您的行程隱私，適合存檔備份。
                            </p>
                        </div>
                        <div className="shrink-0 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                            <ChevronRight className="w-5 h-5 text-brand-600" />
                        </div>
                    </button>

                    {/* JSON Option (Pro) */}
                    <button
                        onClick={isSubscribed ? onExportJson : onExportJson}
                        className={`group relative w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-300 text-left ${isSubscribed
                            ? 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
                            : 'border-gray-100 bg-gray-50/50 opacity-90 cursor-default'
                            }`}
                    >
                        <div className={`shrink-0 w-12 h-12 rounded-xl shadow-sm border flex items-center justify-center transition-transform duration-300 ${isSubscribed ? 'bg-white border-gray-200 group-hover:scale-110' : 'bg-gray-100 border-gray-200'
                            }`}>
                            <FileJson className={`w-6 h-6 ${isSubscribed ? 'text-gray-600' : 'text-gray-400'}`} strokeWidth={2} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className={`font-bold text-lg ${isSubscribed ? 'text-gray-900' : 'text-gray-500'}`}>
                                    通用格式 .json
                                </h3>
                                {!isSubscribed && (
                                    <span className="px-2 py-0.5 bg-gray-200 text-gray-500 text-[10px] font-bold rounded-full tracking-wider uppercase flex items-center gap-1">
                                        <Crown className="w-3 h-3" /> PRO
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-400 font-medium leading-relaxed">
                                開放標準格式，可被其他程式讀取，<br className="hidden sm:block" />適合開發者或跨平台使用。
                            </p>
                        </div>

                        {isSubscribed ? (
                            <div className="shrink-0 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                            </div>
                        ) : (
                            <div className="shrink-0">
                                <div className="px-3 py-1.5 bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-brand-200 hover:shadow-brand-300 hover:scale-105 transition-all flex items-center gap-1">
                                    <Crown className="w-3 h-3" />
                                    <span>升級解鎖</span>
                                </div>
                            </div>
                        )}
                    </button>

                    {!isSubscribed && (
                        <div className="text-center pt-2">
                            <p className="text-xs text-gray-400 mb-2">
                                升級會員即可無限次匯出並享有更多進階功能
                            </p>
                        </div>
                    )}

                </div>
            </div>
        </div>,
        document.body
    );
}
