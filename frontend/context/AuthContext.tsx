
import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

interface User {
    name: string;
    email: string;
    picture: string;
    apiSecret?: string; // New Security Field
    subscription?: {
        active: boolean;
        startDate: number;
        endDate: number;
        planId: string;
    };
}

interface AuthContextType {
    user: User | null;
    login: (token: string) => Promise<void>;
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
                // NEW: Sync with DB Server to get latest state & API Secret
                fetch('http://localhost:3002/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: decoded.email,
                        name: decoded.name,
                        picture: decoded.picture
                    })
                })
                    .then(res => res.json())
                    .then(userData => {
                        if (userData.error) {
                            console.error('Auth sync error:', userData.error);
                            return;
                        }
                        setUser(userData);
                    })
                    .catch(e => {
                        console.error("Auth sync failed", e);
                        // Optional: logout if server unreachable? For now keep local session but APIs might fail.
                    });
            } catch (e) {
                console.error("Invalid token found", e);
                localStorage.removeItem('google_auth_token');
            }
        }
    }, []);

    const login = async (token: string) => {
        try {
            const decoded: any = jwtDecode(token);

            // Authenticate with DB Server
            const res = await fetch('http://localhost:3002/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: decoded.email,
                    name: decoded.name,
                    picture: decoded.picture
                })
            });

            const userData = await res.json();

            if (userData.error) throw new Error(userData.error);

            setUser(userData);
            localStorage.setItem('google_auth_token', token);
        } catch (e) {
            console.error("Login failed:", e);
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
