import { requestJson } from "../http/apiClient";

export interface AppSettings {
    explorerQueueSize: number;
    titleLanguageMode: 'local' | 'specified';
}

export const DEFAULT_SETTINGS: AppSettings = {
    explorerQueueSize: 0,
    titleLanguageMode: 'local'
};

const SETTINGS_STORAGE_KEY = 'travel_planner_settings';

export const fetchRemoteSettings = async (email: string): Promise<AppSettings> => {
    try {
        return await requestJson<AppSettings>(`/db/users/${email}/settings`, {
            fallbackMessage: "Failed to fetch settings"
        });
    } catch (error) {
        console.error("[SettingsService] Failed to fetch remote settings:", error);
        throw error;
    }
};

export const updateRemoteSettings = async (email: string, settings: Partial<AppSettings>): Promise<AppSettings> => {
    try {
        return await requestJson<AppSettings>(`/db/users/${email}/settings`, {
            method: 'PUT',
            body: { settings },
            fallbackMessage: "Failed to update settings"
        });
    } catch (error) {
        console.error("[SettingsService] Failed to update remote settings:", error);
        throw error;
    }
};

export const saveLocalSettings = (email: string, settings: AppSettings): void => {
    try {
        const key = `${SETTINGS_STORAGE_KEY}_${email}`;
        localStorage.setItem(key, JSON.stringify(settings));
    } catch (error) {
        console.error("[SettingsService] Failed to save local settings:", error);
    }
};

export const loadLocalSettings = (email: string): AppSettings | null => {
    try {
        const key = `${SETTINGS_STORAGE_KEY}_${email}`;
        const data = localStorage.getItem(key);
        if (data) {
            return JSON.parse(data) as AppSettings;
        }
        return null;
    } catch (error) {
        console.error("[SettingsService] Failed to load local settings:", error);
        return null;
    }
};

export const clearLocalSettings = (email: string): void => {
    try {
        const key = `${SETTINGS_STORAGE_KEY}_${email}`;
        localStorage.removeItem(key);
    } catch (error) {
        console.error("[SettingsService] Failed to clear local settings:", error);
    }
};
