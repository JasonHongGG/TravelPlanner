
import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

interface User {
    name: string;
    email: string;
    picture: string;
    subscription?: {
        active: boolean;
        startDate: number;
        endDate: number;
        planId: string;
    };
}

interface AuthContextType {
    user: User | null;
    login: (token: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        // Check for saved token on mount
        const token = localStorage.getItem('google_auth_token');
        if (token) {
            try {
                const decoded: any = jwtDecode(token);
                setUser({
                    name: decoded.name,
                    email: decoded.email,
                    picture: decoded.picture,
                });
            } catch (e) {
                console.error("Invalid token found", e);
                localStorage.removeItem('google_auth_token');
            }
        }
    }, []);

    const login = (token: string) => {
        try {
            const decoded: any = jwtDecode(token);
            setUser({
                name: decoded.name,
                email: decoded.email,
                picture: decoded.picture,
            });
            localStorage.setItem('google_auth_token', token);
        } catch (e) {
            console.error("Login failed: Invalid token", e);
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('google_auth_token');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
