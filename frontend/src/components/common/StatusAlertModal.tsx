import React from 'react';
import ReactDOM from 'react-dom';
import { X, CheckCircle2, AlertTriangle, AlertOctagon, Info, Check, RefreshCw, ArrowRight } from 'lucide-react';

export type AlertType = 'success' | 'warning' | 'error' | 'info';

export interface AlertAction {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
}

interface StatusAlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: AlertType;
    title: string;
    description: React.ReactNode;
    code?: string;
    actions?: AlertAction[];
    dismissible?: boolean;
}

const themeConfig = {
    success: {
        bg: 'bg-green-50',
        border: 'border-green-100',
        text: 'text-green-900',
        subText: 'text-green-700/80',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
        icon: CheckCircle2,
        primaryBtn: 'bg-gray-900 hover:bg-black text-white shadow-gray-200',
        secondaryBtn: 'bg-white text-green-700 hover:bg-green-50 border-green-200',
        glow: 'shadow-green-500/20'
    },
    warning: {
        bg: 'bg-amber-50',
        border: 'border-amber-100',
        text: 'text-gray-900', // Use gray for title to avoid "muddy/brown" yellow text
        subText: 'text-gray-600', // Use gray for description
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-500', // Bright Amber for icon
        icon: AlertTriangle,
        primaryBtn: 'bg-gray-900 hover:bg-black text-white shadow-gray-200',
        secondaryBtn: 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200', // Neutral secondary button
        glow: 'shadow-amber-500/20'
    },
    error: {
        bg: 'bg-red-50',
        border: 'border-red-100',
        text: 'text-red-900',
        subText: 'text-gray-500', // Grey looks cleaner for error details
        iconBg: 'bg-red-50', // Light red for icon circle
        iconColor: 'text-red-500',
        icon: AlertOctagon,
        primaryBtn: 'bg-gray-900 hover:bg-black text-white shadow-gray-200',
        secondaryBtn: 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-transparent',
        glow: 'shadow-red-500/20'
    },
    info: {
        bg: 'bg-blue-50',
        border: 'border-blue-100',
        text: 'text-blue-900',
        subText: 'text-blue-700/80',
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-500',
        icon: Info,
        primaryBtn: 'bg-gray-900 hover:bg-black text-white shadow-gray-200',
        secondaryBtn: 'bg-white text-blue-700 hover:bg-blue-50 border-blue-200',
        glow: 'shadow-blue-500/20'
    }
};

export default function StatusAlertModal({
    isOpen,
    onClose,
    type = 'error',
    title,
    description,
    code,
    actions = [],
    dismissible = true
}: StatusAlertModalProps) {
    if (!isOpen) return null;

    const theme = themeConfig[type];
    const Icon = theme.icon;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
                onClick={dismissible ? onClose : undefined}
            />

            {/* Modal Card */}
            <div className="relative w-full max-w-[360px] bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100/50">

                {/* Decorative Glow */}
                <div className={`absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 ${theme.bg} rounded-full blur-3xl opacity-50 pointer-events-none`} />

                <div className="relative p-8 flex flex-col items-center text-center">

                    {/* Icon Circle */}
                    <div className={`mb-6 p-4 rounded-full ${theme.iconColor} ${theme.iconBg} relative`}>
                        {/* Ping Animation for Error/Warning */}
                        {(type === 'error' || type === 'warning') && (
                            <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${theme.iconBg}`} />
                        )}
                        {/* Icon */}
                        <div className="relative z-10">
                            {type === 'error' ? (
                                // Custom Error Icon styling to match user reference (Red Circle with !)
                                <div className="w-12 h-12 flex items-center justify-center">
                                    <div className="w-10 h-10 rounded-full border-[3px] border-red-500 flex items-center justify-center">
                                        <svg width="6" height="20" viewBox="0 0 6 20" fill="currentColor" className="text-red-500">
                                            <rect x="0" y="2" width="6" height="10" rx="3" />
                                            <circle cx="3" cy="17" r="3" />
                                        </svg>
                                    </div>
                                </div>
                            ) : (
                                <Icon className="w-10 h-10 stroke-[2.5px]" />
                            )}
                        </div>
                    </div>

                    {/* Title */}
                    <h3 className={`text-2xl font-black mb-2 tracking-tight text-gray-900`}>
                        {title}
                    </h3>

                    {/* Description */}
                    <div className={`text-base font-medium leading-relaxed mb-6 ${theme.subText}`}>
                        {description}
                    </div>

                    {/* Error Code (Optional) */}
                    {code && (
                        <div className={`mb-8 px-3 py-1 bg-white border ${theme.border} rounded-lg text-sm font-mono font-medium ${type === 'error' ? 'text-red-500' : theme.text} inline-block`}>
                            {code}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-4 w-full justify-center items-center mt-2">
                        {actions.length === 0 && (
                            <button
                                onClick={onClose}
                                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg hover:-translate-y-0.5 transition-all transform active:scale-95 ${theme.primaryBtn}`}
                            >
                                Close
                            </button>
                        )}

                        {actions.length === 1 && (
                            <button
                                onClick={actions[0].onClick}
                                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg hover:-translate-y-0.5 transition-all transform active:scale-95 ${theme.primaryBtn}`}
                            >
                                {actions[0].label}
                            </button>
                        )}

                        {actions.length === 2 && (
                            <>
                                {/* Secondary Action (Small, Text Only) - 1/3 width visually (flex-1 vs flex-[2]) */}
                                <button
                                    onClick={actions[0].onClick}
                                    className={`flex-1 py-4 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors`}
                                >
                                    {actions[0].label}
                                </button>

                                {/* Primary Action (Large, Button Style) - 2/3 width visually */}
                                <button
                                    onClick={actions[1].onClick}
                                    className={`flex-[2] py-4 rounded-xl font-bold text-white shadow-lg hover:-translate-y-0.5 transition-all transform active:scale-95 ${theme.primaryBtn}`}
                                >
                                    {actions[1].label}
                                </button>
                            </>
                        )}

                        {actions.length > 2 && (
                            // Fallback for > 2 actions if needed in future
                            actions.map((action, idx) => (
                                <button
                                    key={idx}
                                    onClick={action.onClick}
                                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${idx === actions.length - 1 ? theme.primaryBtn : 'bg-gray-100'}`}
                                >
                                    {action.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
