
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';

export default function LanguageSwitcher() {
    const { t, i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const languages = [
        { code: 'zh-TW', label: '繁體中文', short: '繁' },
        { code: 'en-US', label: 'English', short: 'EN' },
        { code: 'ja-JP', label: '日本語', short: '日' },
        { code: 'ko-KR', label: '한국어', short: '한' }
    ];

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-full transition-all duration-200 relative group flex items-center justify-center ${isOpen
                    ? 'bg-brand-50 text-brand-600 ring-4 ring-brand-50/50'
                    : 'text-gray-500 hover:text-brand-600 hover:bg-brand-50'
                    }`}
                title={t('profile.language')}
            >
                <div className="absolute inset-0 bg-current opacity-10 rounded-full scale-0 group-hover:scale-100 transition-transform" />

                {/* Badge for current language */}
                <div className={`
                    absolute -bottom-1 -right-1 flex items-center justify-center
                    text-[10px] font-bold leading-none
                    bg-white border rounded-[6px] px-1.5 py-0.5 shadow-sm 
                    transition-colors duration-200
                    ${isOpen ? 'text-brand-600 border-brand-200' : 'text-gray-500 border-gray-100 group-hover:border-brand-200 group-hover:text-brand-600'}
                `}>
                    {languages.find(l => l.code === i18n.language)?.short || 'EN'}
                </div>

                <Globe className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-12' : 'group-hover:rotate-12'}`} />
            </button>

            {/* Dropdown Menu */}
            <div
                className={`
                    absolute right-0 top-full mt-3 w-48 
                    bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl shadow-brand-900/5 
                    border border-white/50 ring-1 ring-black/5
                    transform origin-top-right transition-all duration-200 z-50 overflow-hidden
                    ${isOpen
                        ? 'opacity-100 translate-y-0 scale-100 visible'
                        : 'opacity-0 -translate-y-2 scale-95 invisible pointer-events-none'
                    }
                `}
            >
                {/* Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-gray-50/50 to-white border-b border-gray-100/50">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                        {t('profile.language')}
                    </span>
                </div>

                {/* List */}
                <div className="p-1.5 space-y-0.5">
                    {languages.map((lang) => {
                        const isActive = i18n.language === lang.code;
                        return (
                            <button
                                key={lang.code}
                                onClick={() => {
                                    i18n.changeLanguage(lang.code);
                                    setIsOpen(false);
                                }}
                                className={`
                                    w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                                    ${isActive
                                        ? 'bg-gradient-to-r from-brand-50 to-blue-50 text-brand-700 shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }
                                `}
                            >
                                <span className={isActive ? 'font-bold' : ''}>{lang.label}</span>
                                {isActive && (
                                    <div className="bg-brand-100 text-brand-600 p-1 rounded-full">
                                        <Check className="w-3 h-3" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
