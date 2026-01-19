import React, { useState, useRef, useEffect } from 'react';
import { LogOut, User, Coins, History, ChevronDown, ChevronUp, CreditCard, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePoints } from '../context/PointsContext';
import TransactionHistoryModal from './TransactionHistoryModal';
import { useTranslation } from 'react-i18next';

export default function UserProfileMenu() {
    const { t, i18n } = useTranslation();
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const { balance, openPurchaseModal, isSubscribed } = usePoints();
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    if (!user) return null;

    return (
        <div className="relative" ref={menuRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full transition-all duration-200 border ${isOpen
                    ? 'bg-white border-gray-300 shadow-sm'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
            >
                <div className="relative">
                    <img
                        src={user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}
                        alt={user.name}
                        className="w-8 h-8 rounded-full object-cover border border-white shadow-sm"
                    />
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                </div>

                <div className="flex flex-col items-start mr-1 hidden sm:flex">
                    <span className="text-xs font-bold text-gray-700 leading-tight">{user.name}</span>
                    {isSubscribed ? (
                        <span className="text-[10px] font-bold text-purple-600 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> PRO
                        </span>
                    ) : (
                        <span className="text-[10px] font-medium text-brand-600">{balance} P</span>
                    )}
                </div>

                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl shadow-gray-200 border border-gray-100 overflow-hidden transform origin-top-right animate-in fade-in zoom-in-95 duration-200 z-50">

                    {/* Header Profile Info */}
                    <div className="p-5 border-b border-gray-50 bg-gray-50/30">
                        <div className="flex items-center gap-4">
                            <img
                                src={user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}
                                alt={user.name}
                                className="w-14 h-14 rounded-full border-4 border-white shadow-sm"
                            />
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-bold text-gray-900 truncate">{user.name}</h3>
                                <p className="text-xs text-gray-500 truncate font-medium">{user.email}</p>
                            </div>
                        </div>
                    </div>

                    {/* Body Content */}
                    <div className="p-4 space-y-4">

                        {/* Points Card */}
                        <div className={`rounded-xl p-4 text-white shadow-lg relative overflow-hidden group transition-all duration-500
                            ${isSubscribed
                                ? 'bg-gradient-to-br from-indigo-900 via-purple-900 to-brand-900'
                                : 'bg-gradient-to-br from-gray-900 to-gray-800'
                            }`}>
                            {/* Decorative circles */}
                            <div className="absolute top-0 right-0 -mt-2 -mr-2 w-20 h-20 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-medium text-gray-400">
                                        {isSubscribed ? t('profile.current_plan') : t('profile.current_points')}
                                    </span>
                                    <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-sm">
                                        {isSubscribed ? <Sparkles className="w-4 h-4 text-yellow-400 fill-yellow-400 animate-pulse" /> : <Coins className="w-4 h-4 text-yellow-400" />}
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-1 mb-4">
                                    {isSubscribed ? (
                                        <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 to-amber-400">
                                            {t('profile.pro_member')}
                                        </span>
                                    ) : (
                                        <>
                                            <span className="text-2xl font-black tracking-tight">{balance}</span>
                                            <span className="text-sm font-medium text-gray-400">P</span>
                                        </>
                                    )}
                                </div>

                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        openPurchaseModal();
                                    }}
                                    className="w-full py-2 bg-white text-gray-900 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                                >
                                    <CreditCard className="w-3 h-3" />
                                    {t('profile.top_up')}
                                </button>
                            </div>
                        </div>

                        {/* Menu Items */}
                        <div className="space-y-1">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    setIsHistoryModalOpen(true);
                                }}
                                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                                        <History className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">{t('profile.history')}</span>
                                </div>
                                <ChevronDown className="w-4 h-4 text-gray-300 -rotate-90" />
                            </button>

                            <div className="border-t border-gray-100 my-2"></div>

                            {/* Language Switcher */}
                            <div className="px-3 py-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block ml-1">{t('profile.language')}</label>
                                <div className="flex bg-gray-100 p-1 rounded-lg">
                                    <button
                                        onClick={() => i18n.changeLanguage('zh-TW')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${i18n.language === 'zh-TW' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        繁中
                                    </button>
                                    <button
                                        onClick={() => i18n.changeLanguage('en-US')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${i18n.language === 'en-US' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        EN
                                    </button>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 my-2"></div>

                            <button
                                onClick={logout}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 hover:text-red-600 text-gray-500 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="text-sm font-medium">{t('profile.logout')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}



            <TransactionHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
            />
        </div>
    );
}
