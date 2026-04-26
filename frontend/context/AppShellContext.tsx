import React, { createContext, useContext, useMemo, useState } from 'react';

interface AppShellContextType {
    isSettingsModalOpen: boolean;
    openSettingsModal: () => void;
    closeSettingsModal: () => void;
}

const AppShellContext = createContext<AppShellContextType | undefined>(undefined);

export const AppShellProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    const value = useMemo(() => ({
        isSettingsModalOpen,
        openSettingsModal: () => setIsSettingsModalOpen(true),
        closeSettingsModal: () => setIsSettingsModalOpen(false)
    }), [isSettingsModalOpen]);

    return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
};

export const useAppShell = () => {
    const context = useContext(AppShellContext);
    if (!context) {
        throw new Error('useAppShell must be used within an AppShellProvider');
    }
    return context;
};
