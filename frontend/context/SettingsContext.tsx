import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
    AppSettings,
    DEFAULT_SETTINGS,
    fetchRemoteSettings,
    updateRemoteSettings,
    saveLocalSettings,
    loadLocalSettings
} from '../services/database/settingsService';

// ============================================================
// Context Types
// ============================================================

interface SettingsContextType {
    settings: AppSettings;
    updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
    resetToDefaults: () => Promise<void>;
    isSyncing: boolean;
    lastSyncError: string | null;
    isSettingsModalOpen: boolean;
    openSettingsModal: () => void;
    closeSettingsModal: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// ============================================================
// Provider Component
// ============================================================

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncError, setLastSyncError] = useState<string | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    const openSettingsModal = () => setIsSettingsModalOpen(true);
    const closeSettingsModal = () => setIsSettingsModalOpen(false);

    // ============================================================
    // Sync Settings on User Login
    // ============================================================
    useEffect(() => {
        const syncSettings = async () => {
            if (!user?.email) {
                // Reset to defaults when logged out
                setSettings(DEFAULT_SETTINGS);
                setLastSyncError(null);
                return;
            }

            setIsSyncing(true);
            setLastSyncError(null);

            try {
                // Try to fetch from cloud
                const remoteSettings = await fetchRemoteSettings(user.email);
                setSettings({ ...DEFAULT_SETTINGS, ...remoteSettings });
                // Update local backup
                saveLocalSettings(user.email, { ...DEFAULT_SETTINGS, ...remoteSettings });
                console.log("[SettingsContext] Synced settings from cloud");
            } catch (error) {
                console.warn("[SettingsContext] Failed to sync from cloud, trying local backup");

                // Fallback to local backup
                const localSettings = loadLocalSettings(user.email);
                if (localSettings) {
                    setSettings(localSettings);
                    setLastSyncError("使用本地備份設定");
                    console.log("[SettingsContext] Loaded settings from local backup");
                } else {
                    // Use defaults
                    setSettings(DEFAULT_SETTINGS);
                    setLastSyncError("使用預設設定");
                    console.log("[SettingsContext] Using default settings");
                }
            } finally {
                setIsSyncing(false);
            }
        };

        syncSettings();
    }, [user?.email]);

    // ============================================================
    // Update Settings
    // ============================================================
    const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
        if (!user?.email) return;

        // Optimistic update
        const newSettings = { ...settings, ...updates };
        setSettings(newSettings);

        // Save to local backup immediately
        saveLocalSettings(user.email, newSettings);

        // Sync to cloud asynchronously
        setIsSyncing(true);
        setLastSyncError(null);

        try {
            const confirmedSettings = await updateRemoteSettings(user.email, updates);
            setSettings(confirmedSettings);
            saveLocalSettings(user.email, confirmedSettings);
            console.log("[SettingsContext] Settings synced to cloud");
        } catch (error) {
            console.error("[SettingsContext] Failed to sync to cloud:", error);
            setLastSyncError("同步失敗，僅儲存至本地");
        } finally {
            setIsSyncing(false);
        }
    }, [user?.email, settings]);

    // ============================================================
    // Reset to Defaults
    // ============================================================
    const resetToDefaults = useCallback(async () => {
        if (!user?.email) return;

        setSettings(DEFAULT_SETTINGS);
        saveLocalSettings(user.email, DEFAULT_SETTINGS);

        setIsSyncing(true);
        setLastSyncError(null);

        try {
            await updateRemoteSettings(user.email, DEFAULT_SETTINGS);
            console.log("[SettingsContext] Reset to defaults and synced");
        } catch (error) {
            console.error("[SettingsContext] Failed to sync reset:", error);
            setLastSyncError("重設成功，但同步失敗");
        } finally {
            setIsSyncing(false);
        }
    }, [user?.email]);

    // ============================================================
    // Render
    // ============================================================
    return (
        <SettingsContext.Provider value={{
            settings,
            updateSettings,
            resetToDefaults,
            isSyncing,
            lastSyncError,
            isSettingsModalOpen,
            openSettingsModal,
            closeSettingsModal
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

// ============================================================
// Hook
// ============================================================

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
