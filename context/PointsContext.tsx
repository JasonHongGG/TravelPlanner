
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/database/Database';
import { Transaction } from '../services/database/models/UserModel';

interface PointPackage {
    id: string;
    points: number;
    price: number;
    name: string;
    popular?: boolean;
    description: string;
    type?: 'points' | 'subscription'; // Added type
}

interface PointsContextType {
    balance: number;
    transactions: Transaction[];
    isSubscribed: boolean; // Added
    purchasePoints: (packageId: string) => Promise<void>;
    spendPoints: (amount: number, description: string) => Promise<boolean>;
    isLoading: boolean;
    isPurchaseModalOpen: boolean;
    openPurchaseModal: () => void;
    closePurchaseModal: () => void;
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);

export const AVAILABLE_PACKAGES: PointPackage[] = [
    {
        id: 'pkg_100',
        points: 100,
        price: 30,
        name: '輕量體驗',
        description: '適合偶爾使用',
        type: 'points'
    },
    {
        id: 'pkg_500',
        points: 500,
        price: 130,
        name: '超值方案',
        popular: true,
        description: '最受歡迎的選擇',
        type: 'points'
    },
    {
        id: 'pkg_1000',
        points: 1000,
        price: 250,
        name: '專業玩家',
        description: '大量生成無壓力',
        type: 'points'
    },
    {
        id: 'plan_unlimited',
        points: 0,
        price: 399,
        name: '旅遊貼身助理',
        description: '無限 AI 生成 + 專屬顧問',
        type: 'subscription'
    }
];

export const PointsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isSubscribed, setIsSubscribed] = useState(false); // Added
    const [isLoading, setIsLoading] = useState(false);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

    const openPurchaseModal = () => setIsPurchaseModalOpen(true);
    const closePurchaseModal = () => setIsPurchaseModalOpen(false);

    // Fetch user profile on mount or user change
    useEffect(() => {
        const fetchProfile = async () => {
            if (user?.email) {
                setIsLoading(true);
                try {
                    const userProfile = await db.users.getProfile(user.email);
                    if (userProfile) {
                        setBalance(userProfile.points);
                        setTransactions(userProfile.transactions || []);
                        // Check subscription validity
                        const sub = userProfile.subscription;
                        const isValid = sub?.active && sub.endDate > Date.now();
                        setIsSubscribed(!!isValid);
                    }
                } catch (error) {
                    console.error("Failed to fetch user points:", error);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setBalance(0);
                setTransactions([]);
                setIsSubscribed(false);
            }
        };

        fetchProfile();
    }, [user?.email]);

    const purchasePoints = async (packageId: string): Promise<void> => {
        if (!user?.email) return;

        setIsLoading(true);
        const pkg = AVAILABLE_PACKAGES.find(p => p.id === packageId);

        try {
            if (pkg) {
                let updatedUser;
                if (pkg.type === 'subscription') {
                    // Activate Subscription
                    updatedUser = await db.users.activateSubscription(user.email, pkg.id);
                    setIsSubscribed(true);
                } else {
                    // Add Points
                    updatedUser = await db.users.addPoints(user.email, pkg.points, `購買 ${pkg.name} 方案`);
                    setBalance(updatedUser.points);
                }

                // Common update
                if (updatedUser) {
                    setTransactions(updatedUser.transactions);
                }
            } else {
                throw new Error("Package not found");
            }
        } catch (error) {
            console.error("Purchase failed:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const spendPoints = async (amount: number, description: string): Promise<boolean> => {
        if (!user?.email) return false;

        // Optimistic check (If subscribed, always allow)
        if (!isSubscribed && balance < amount) return false;

        try {
            const updatedUser = await db.users.addPoints(user.email, -amount, description);
            setBalance(updatedUser.points);
            setTransactions(updatedUser.transactions);
            return true;
        } catch (error) {
            console.error("Spend failed:", error);
            return false;
        }
    };

    return (
        <PointsContext.Provider value={{
            balance,
            transactions,
            isSubscribed,
            purchasePoints,
            spendPoints,
            isLoading,
            isPurchaseModalOpen,
            openPurchaseModal,
            closePurchaseModal
        }}>
            {children}
        </PointsContext.Provider>
    );
};

export const usePoints = () => {
    const context = useContext(PointsContext);
    if (!context) {
        throw new Error('usePoints must be used within a PointsProvider');
    }
    return context;
};
