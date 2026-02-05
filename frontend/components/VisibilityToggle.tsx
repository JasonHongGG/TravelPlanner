import React from 'react';
import { Globe, Lock, Loader2, CloudOff, Share2, Link2Off } from 'lucide-react';
import type { TripVisibility } from '../types';

interface VisibilityToggleProps {
    visibility: TripVisibility;
    isShared: boolean;  // Whether the trip is currently on server
    isSyncing?: boolean;
    onVisibilityChange: (newVisibility: TripVisibility) => void;
    onShareToggle: (shouldShare: boolean) => void;
    disabled?: boolean;
}

export default function VisibilityToggle({
    visibility,
    isShared,
    isSyncing = false,
    onVisibilityChange,
    onShareToggle,
    disabled = false
}: VisibilityToggleProps) {
    const isPublic = visibility === 'public';

    return (
        <div className="flex items-center gap-1.5">
            {/* Visibility Toggle: Private / Public */}
            <button
                onClick={() => onVisibilityChange(isPublic ? 'private' : 'public')}
                disabled={disabled || isSyncing}
                className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
                    transition-all duration-300 ease-out
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${isPublic
                        ? 'bg-gradient-to-r from-brand-500 to-sky-400 text-white shadow-md shadow-brand-200/50'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }
                `}
                title={isPublic ? '切換為私人' : '切換為公開'}
            >
                {isSyncing ? (
                    <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>處理中...</span>
                    </>
                ) : (
                    <>
                        {isPublic ? (
                            <Globe className="w-3.5 h-3.5" />
                        ) : (
                            <Lock className="w-3.5 h-3.5" />
                        )}
                        <span>{isPublic ? '公開' : '私人'}</span>
                    </>
                )}
            </button>

            {/* Share Toggle Button - Only visible for Private mode */}
            {!isPublic && (
                <button
                    onClick={() => onShareToggle(!isShared)}
                    disabled={disabled || isSyncing}
                    className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
                        transition-all duration-300 ease-out
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${isShared
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }
                    `}
                    title={isShared ? '取消分享 (將從伺服器刪除)' : '分享此旅程'}
                >
                    {isShared ? (
                        <>
                            <Share2 className="w-3.5 h-3.5" />
                            <span>分享中</span>
                        </>
                    ) : (
                        <>
                            <Link2Off className="w-3.5 h-3.5" />
                            <span>分享</span>
                        </>
                    )}
                </button>
            )}

            {/* For Public mode - Share is always on (indicated but not toggleable) */}
            {isPublic && isShared && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                    <Share2 className="w-3.5 h-3.5" />
                    <span>已分享</span>
                </div>
            )}

            {/* Local/Shared Status Indicator */}
            {!isShared ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-bold cursor-default select-none">
                    <CloudOff className="w-3.5 h-3.5" />
                    <span>本地</span>
                </div>
            ) : null}
        </div>
    );
}
