
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
}

interface PointsContextType {
    balance: number;
    transactions: Transaction[];
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
        id: 'basic',
        name: '旅人起步',
        points: 500,
        price: 150,
        description: '適合體驗單次行程生成',
    },
    {
        id: 'pro',
        name: '探險家',
        points: 1200,
        price: 300,
        popular: true,
        description: '最受歡迎！適合規劃 2-3 趟旅程',
    },
    {
        id: 'ultimate',
        name: '環遊世界',
        points: 3000,
        price: 600,
        description: '重度旅行者首選，盡情探索',
    }
];

export const PointsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
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
                    }
                } catch (error) {
                    console.error("Failed to fetch user points:", error);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setBalance(0);
                setTransactions([]);
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
                const updatedUser = await db.users.addPoints(user.email, pkg.points, `購買 ${pkg.name} 方案`);
                setBalance(updatedUser.points);
                setTransactions(updatedUser.transactions);
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

        // Optimistic check
        if (balance < amount) return false;

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
