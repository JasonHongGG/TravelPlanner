import { parseErrorResponse } from "../http/parseError";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
const SETTINGS_API_BASE_URL = `${API_BASE_URL}/db`;

export interface AppSettings {
    explorerQueueSize: number;
    titleLanguageMode: 'local' | 'specified';
}

export const DEFAULT_SETTINGS: AppSettings = {
    explorerQueueSize: 0,
    titleLanguageMode: 'local'
};

const SETTINGS_STORAGE_KEY = 'travel_planner_settings';

const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem("google_auth_token");
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
};

export const fetchRemoteSettings = async (email: string): Promise<AppSettings> => {
    try {
        const response = await fetch(`${SETTINGS_API_BASE_URL}/users/${email}/settings`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw await parseErrorResponse(response, "Failed to fetch settings");
        }

        return await response.json();
    } catch (error) {
        console.error("[SettingsService] Failed to fetch remote settings:", error);
        throw error;
    }
};

export const updateRemoteSettings = async (email: string, settings: Partial<AppSettings>): Promise<AppSettings> => {
    try {
        const response = await fetch(`${SETTINGS_API_BASE_URL}/users/${email}/settings`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ settings })
        });

        if (!response.ok) {
            throw await parseErrorResponse(response, "Failed to update settings");
        }

        return await response.json();
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
