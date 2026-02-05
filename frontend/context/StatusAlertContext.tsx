import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import StatusAlertModal, { AlertType, AlertAction } from '../components/common/StatusAlertModal';

interface ShowAlertOptions {
    type: AlertType;
    title: string;
    description: ReactNode;
    code?: string;
    actions?: AlertAction[];
    dismissible?: boolean;
    onClose?: () => void;
}

interface StatusAlertContextType {
    showAlert: (options: ShowAlertOptions) => void;
    hideAlert: () => void;
}

const StatusAlertContext = createContext<StatusAlertContextType | undefined>(undefined);

export const useStatusAlert = () => {
    const context = useContext(StatusAlertContext);
    if (!context) {
        throw new Error('useStatusAlert must be used within a StatusAlertProvider');
    }
    return context;
};

export const StatusAlertProvider = ({ children }: { children: ReactNode }) => {
    const [alertState, setAlertState] = useState<{
        isOpen: boolean;
        type: AlertType;
        title: string;
        description: ReactNode;
        code?: string;
        actions?: AlertAction[];
        dismissible: boolean;
        onCloseCallback?: () => void;
    }>({
        isOpen: false,
        type: 'info',
        title: '',
        description: null,
        dismissible: true
    });

    const showAlert = useCallback((options: ShowAlertOptions) => {
        setAlertState({
            isOpen: true,
            type: options.type,
            title: options.title,
            description: options.description,
            code: options.code,
            actions: options.actions,
            dismissible: options.dismissible !== undefined ? options.dismissible : true,
            onCloseCallback: options.onClose
        });
    }, []);

    const hideAlert = useCallback(() => {
        setAlertState(prev => {
            if (prev.onCloseCallback) {
                prev.onCloseCallback();
            }
            return { ...prev, isOpen: false };
        });
    }, []);

    return (
        <StatusAlertContext.Provider value={{ showAlert, hideAlert }}>
            {children}
            <StatusAlertModal
                isOpen={alertState.isOpen}
                onClose={hideAlert}
                type={alertState.type}
                title={alertState.title}
                description={alertState.description}
                code={alertState.code}
                actions={alertState.actions}
                dismissible={alertState.dismissible}
            />
        </StatusAlertContext.Provider>
    );
};
