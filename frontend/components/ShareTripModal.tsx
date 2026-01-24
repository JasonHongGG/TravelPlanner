import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Globe, Lock, UserPlus, Trash2, Link2, Users, Edit3, Eye, Link } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Trip, TripVisibility } from '../types';
import { tripShareService } from '../services/TripShareService';

interface ShareTripModalProps {
    isOpen: boolean;
    onClose: () => void;
    trip: Trip;
    onVisibilityChange?: (visibility: TripVisibility) => void;
}

type Permission = 'read' | 'write';

export default function ShareTripModal({ isOpen, onClose, trip, onVisibilityChange }: ShareTripModalProps) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const [permissions, setPermissions] = useState<Record<string, Permission>>({});
    const [newEmail, setNewEmail] = useState('');
    const [newPermission, setNewPermission] = useState<Permission>('read');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const shareUrl = tripShareService.getShareUrl(trip.serverTripId || trip.id);
    const isPublic = trip.visibility === 'public';

    useEffect(() => {
        if (isOpen && trip.serverTripId) {
            loadPermissions();
        }
    }, [isOpen, trip.serverTripId]);

    const loadPermissions = async () => {
        if (!trip.serverTripId) return;
        try {
            const shared = await tripShareService.getTrip(trip.serverTripId);
            setPermissions(shared.permissions || {});

            // Backward compatibility for legacy allowedUsers array
            if (!shared.permissions && shared.allowedUsers) {
                const migrated: Record<string, Permission> = {};
                shared.allowedUsers.forEach(u => migrated[u] = 'read');
                setPermissions(migrated);
            }
        } catch (e) {
            console.error('Failed to load permissions:', e);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Failed to copy:', e);
        }
    };

    const handleAddUser = async () => {
        if (!newEmail.trim() || !trip.serverTripId) return;

        const email = newEmail.trim().toLowerCase();
        if (permissions[email]) {
            setError('該用戶已在列表中');
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const newPermissions = { ...permissions, [email]: newPermission };
            await tripShareService.updatePermissions(trip.serverTripId, newPermissions);
            setPermissions(newPermissions);
            setNewEmail('');
        } catch (e: any) {
            setError(e.message || '新增失敗');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveUser = async (email: string) => {
        if (!trip.serverTripId) return;

        setIsLoading(true);
        try {
            const newPermissions = { ...permissions };
            delete newPermissions[email];
            await tripShareService.updatePermissions(trip.serverTripId, newPermissions);
            setPermissions(newPermissions);
        } catch (e: any) {
            setError(e.message || '移除失敗');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePermission = async (email: string, perm: Permission) => {
        if (!trip.serverTripId) return;
        if (permissions[email] === perm) return; // Prevent redundant update

        // Optimistic update
        const oldPermissions = { ...permissions };
        const newPermissions = { ...permissions, [email]: perm };
        setPermissions(newPermissions);

        try {
            await tripShareService.updatePermissions(trip.serverTripId, newPermissions);
        } catch (e: any) {
            setError(e.message || '更新權限失敗');
            setPermissions(oldPermissions); // Revert
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-sky-400 rounded-xl flex items-center justify-center shadow-lg shadow-brand-200">
                            <Link2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">分享旅程</h2>
                            <p className="text-xs text-gray-500">
                                {isPublic ? '所有人都可以查看' : '僅授權用戶可查看/編輯'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Visibility Status */}
                    <div className={`flex items-center gap-3 p-4 rounded-xl border ${isPublic
                        ? 'bg-green-50 border-green-200'
                        : 'bg-amber-50 border-amber-200'
                        }`}>
                        {isPublic ? (
                            <Globe className="w-5 h-5 text-green-600" />
                        ) : (
                            <Lock className="w-5 h-5 text-amber-600" />
                        )}
                        <div className="flex-1">
                            <p className={`text-sm font-medium ${isPublic ? 'text-green-700' : 'text-amber-700'}`}>
                                {isPublic ? '公開旅程' : '私人旅程'}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {isPublic
                                    ? '任何人都可以透過連結查看此旅程'
                                    : '只有下方列表中的用戶可以存取'}
                            </p>
                        </div>
                    </div>

                    {/* Share Link */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <Link className="w-4 h-4" />
                            分享連結
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={shareUrl}
                                readOnly
                                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 truncate"
                            />
                            <button
                                onClick={handleCopy}
                                className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 flex items-center gap-2 ${copied
                                    ? 'bg-green-500 text-white'
                                    : 'bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-200 hover:-translate-y-0.5'
                                    }`}
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        已複製
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" />
                                        複製
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Private Mode: Permission Management */}
                    {!isPublic && trip.serverTripId && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                授權與權限管理
                            </label>

                            {/* Add User */}
                            <div className="flex gap-2 mb-3">
                                <div className="relative flex-1 group">
                                    <input
                                        type="email"
                                        placeholder="輸入 Email..."
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
                                        className="w-full pl-4 pr-12 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                                    />

                                    {/* Floating Permission Toggle Icon */}
                                    <button
                                        onClick={() => setNewPermission(prev => prev === 'read' ? 'write' : 'read')}
                                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all duration-200 flex items-center gap-1.5 ${newPermission === 'write'
                                            ? 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                            }`}
                                        title={newPermission === 'read' ? "目前權限：可查看 (點擊切換為編輯)" : "目前權限：可編輯 (點擊切換為查看)"}
                                    >
                                        {newPermission === 'read' ? (
                                            <Eye className="w-4 h-4" />
                                        ) : (
                                            <Edit3 className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                                <button
                                    onClick={handleAddUser}
                                    disabled={!newEmail.trim() || isLoading}
                                    className="px-4 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-gray-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-1.5"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    <span className="hidden sm:inline">新增</span>
                                </button>
                            </div>

                            {/* Error */}
                            {error && (
                                <p className="text-red-500 text-xs mb-2">{error}</p>
                            )}

                            {/* User List */}
                            <div className="bg-gray-50 rounded-xl border border-gray-100 max-h-40 overflow-y-auto">
                                {Object.keys(permissions).length === 0 ? (
                                    <p className="text-center text-gray-400 text-sm py-6">
                                        尚未授權任何用戶
                                    </p>
                                ) : (
                                    <ul className="divide-y divide-gray-100">
                                        {Object.entries(permissions).map(([email, perm]) => (
                                            <li
                                                key={email}
                                                className="flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors group"
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden mr-2">
                                                    <span className="text-sm text-gray-700 truncate">{email}</span>
                                                    {perm === 'write' ? (
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md font-medium shrink-0">編輯者</span>
                                                    ) : (
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-md font-medium shrink-0">查看者</span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    {/* Permission Toggle (Hover to see) */}
                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                                        <button
                                                            onClick={() => handleChangePermission(email, 'read')}
                                                            disabled={perm === 'read'}
                                                            className={`p-1.5 ${perm === 'read' ? 'bg-gray-100 text-gray-900 cursor-default' : 'text-gray-400 hover:text-gray-600'}`}
                                                            title={perm === 'read' ? '目前為查看者' : '設定為僅查看'}
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                        <div className="w-px bg-gray-200"></div>
                                                        <button
                                                            onClick={() => handleChangePermission(email, 'write')}
                                                            disabled={perm === 'write'}
                                                            className={`p-1.5 ${perm === 'write' ? 'bg-blue-50 text-blue-600 cursor-default' : 'text-gray-400 hover:text-gray-600'}`}
                                                            title={perm === 'write' ? '目前為編輯者' : '設定為可編輯'}
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>

                                                    <button
                                                        onClick={() => handleRemoveUser(email)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                        title="移除用戶"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 rounded-b-2xl border-t border-gray-100">
                    <p className="text-xs text-gray-400 text-center">
                        {isPublic
                            ? '提示：將旅程設為私人可限制特定用戶查看'
                            : '提示：您可以為每個用戶設定「可查看」或「可編輯」權限'}
                    </p>
                </div>
            </div>
        </div>
    );
}
