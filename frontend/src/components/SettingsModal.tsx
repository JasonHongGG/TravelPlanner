import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Settings, Sparkles, Globe, RotateCcw, Cloud, CloudOff, Loader2, Check, AlertTriangle, MapPin, Languages } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from 'react-i18next';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: Props) {
    const { t } = useTranslation();
    const { settings, updateSettings, resetToDefaults, isSyncing, lastSyncError } = useSettings();
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    if (!isOpen) return null;

    const handleQueueSizeChange = (size: number) => {
        updateSettings({ explorerQueueSize: size });
    };

    const handleLanguageModeChange = (mode: 'local' | 'specified') => {
        updateSettings({ titleLanguageMode: mode });
    };

    const handleResetClick = () => {
        setShowResetConfirm(true);
    };

    const handleResetConfirm = () => {
        resetToDefaults();
        setShowResetConfirm(false);
    };

    const handleResetCancel = () => {
        setShowResetConfirm(false);
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">

            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="absolute inset-0 z-[110] bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Content */}
                        <div className="p-6 text-center">
                            {/* Icon */}
                            <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                                <RotateCcw className="w-6 h-6 text-amber-600" />
                            </div>

                            {/* Title */}
                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                                {t('settings.reset_title')}
                            </h3>

                            {/* Description */}
                            <p className="text-sm text-gray-500">
                                {t('settings.reset_confirm')}
                            </p>
                        </div>

                        {/* Action Buttons - Horizontal layout */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={handleResetCancel}
                                className="flex-1 px-4 py-2.5 rounded-xl text-gray-500 font-medium text-sm hover:bg-gray-100 transition-all"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleResetConfirm}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 font-medium text-sm hover:bg-amber-100 transition-all"
                            >
                                {t('settings.reset_btn')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">

                {/* Header with decorative background */}
                <div className="relative p-6 border-b border-gray-100 bg-gray-50/50 overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-purple-100 rounded-full blur-3xl opacity-50"></div>
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-blue-100 rounded-full blur-3xl opacity-50"></div>

                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                                <Settings className="w-6 h-6 text-brand-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-900">{t('settings.title')}</h2>
                                <p className="text-sm text-gray-500 font-medium">{t('settings.subtitle')}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Sync Status Indicator */}
                            <div className="flex items-center gap-1.5 text-xs">
                                {isSyncing ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />
                                        <span className="text-gray-500">{t('settings.syncing')}</span>
                                    </>
                                ) : lastSyncError ? (
                                    <>
                                        <CloudOff className="w-3.5 h-3.5 text-amber-500" />
                                        <span className="text-amber-600">{lastSyncError}</span>
                                    </>
                                ) : (
                                    <>
                                        <Cloud className="w-3.5 h-3.5 text-green-500" />
                                        <span className="text-green-600">{t('settings.synced')}</span>
                                    </>
                                )}
                            </div>

                            {/* Reset Button */}
                            <button
                                onClick={handleResetClick}
                                className="p-2 rounded-full hover:bg-gray-200/50 text-gray-400 hover:text-gray-600 transition-colors"
                                title={t('settings.reset_defaults')}
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>

                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-gray-200/50 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">

                    {/* AI Assistant Settings */}
                    <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white shadow-sm">
                        <div className="px-5 py-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-purple-600" />
                                <h3 className="font-bold text-gray-900">{t('settings.ai_assistant')}</h3>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-3">
                                    {t('settings.queue_size')}
                                </label>

                                {/* Queue Size Selector */}
                                <div className="flex items-center gap-2">
                                    {[0, 1, 2, 3, 4, 5].map((size) => (
                                        <button
                                            key={size}
                                            onClick={() => handleQueueSizeChange(size)}
                                            className={`
                                                w-11 h-11 rounded-xl font-bold text-base transition-all duration-200
                                                ${settings.explorerQueueSize === size
                                                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-200 scale-105'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }
                                            `}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                    <span className="ml-3 text-sm text-gray-500 font-medium">
                                        {settings.explorerQueueSize} {t('settings.batch_unit')}
                                    </span>
                                </div>

                                <p className="mt-3 text-xs text-gray-400">
                                    {t('settings.queue_hint')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Language Preferences */}
                    <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white shadow-sm">
                        <div className="px-5 py-4 bg-gradient-to-r from-sky-50 to-teal-50 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <Globe className="w-5 h-5 text-sky-600" />
                                <h3 className="font-bold text-gray-900">{t('settings.language_pref')}</h3>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            <label className="block text-sm font-bold text-gray-700 mb-3">
                                {t('settings.title_language')}
                            </label>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Local Language Option */}
                                <button
                                    onClick={() => handleLanguageModeChange('local')}
                                    className={`
                                        relative p-4 rounded-xl border-2 text-left transition-all duration-200
                                        ${settings.titleLanguageMode === 'local'
                                            ? 'border-brand-500 bg-brand-50 shadow-md'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }
                                    `}
                                >
                                    {settings.titleLanguageMode === 'local' && (
                                        <div className="absolute top-3 right-3 w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}

                                    <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center mb-2">
                                        <MapPin className="w-4 h-4 text-sky-600" />
                                    </div>
                                    <div className="font-bold text-gray-900 text-sm mb-1">
                                        {t('settings.local_lang')}
                                    </div>
                                    <div className="text-xs text-gray-500 mb-2">
                                        {t('settings.local_lang_desc')}
                                    </div>
                                    <div className="text-[10px] px-2 py-1 bg-gray-100 rounded-md text-gray-600 inline-block">
                                        {t('settings.local_lang_example')}
                                    </div>
                                </button>

                                {/* Specified Language Option */}
                                <button
                                    onClick={() => handleLanguageModeChange('specified')}
                                    className={`
                                        relative p-4 rounded-xl border-2 text-left transition-all duration-200
                                        ${settings.titleLanguageMode === 'specified'
                                            ? 'border-brand-500 bg-brand-50 shadow-md'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }
                                    `}
                                >
                                    {settings.titleLanguageMode === 'specified' && (
                                        <div className="absolute top-3 right-3 w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}

                                    <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center mb-2">
                                        <Languages className="w-4 h-4 text-teal-500" />
                                    </div>
                                    <div className="font-bold text-gray-900 text-sm mb-1">
                                        {t('settings.specified_lang')}
                                    </div>
                                    <div className="text-xs text-gray-500 mb-2">
                                        {t('settings.specified_lang_desc')}
                                    </div>
                                    <div className="text-[10px] px-2 py-1 bg-gray-100 rounded-md text-gray-600 inline-block">
                                        {t('settings.specified_lang_example')}
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
