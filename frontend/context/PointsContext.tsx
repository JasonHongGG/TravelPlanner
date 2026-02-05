
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { addUserPoints, activateUserSubscription, getUserProfile, Transaction } from '../services/database/userService';

interface PointPackage {
    id: string;
    points: number;
    price: number;
    name: string;
    popular?: boolean;
    description: string;
    type?: 'points' | 'subscription'; // Added type
}

export interface PointConfig {
    TRIP_BASE_COST: number;
    TRIP_DAILY_COST: number;
    NEW_USER_BONUS: number;
    ATTRACTION_SEARCH_COST: number;
    RECOMMENDATION_COUNT: number;
    GALLERY_PAGE_SIZE_DEFAULT: number;
    GALLERY_PAGE_SIZE_MAX: number;
    GALLERY_PAGE_MAX: number;
    RANDOM_TRIPS_DEFAULT: number;
    RANDOM_TRIPS_MAX: number;
}

interface PointsContextType {
    balance: number;
    transactions: Transaction[];
    isSubscribed: boolean; // Added
    purchasePoints: (packageId: string) => Promise<void>;
    spendPoints: (amount: number, description: string) => Promise<boolean>;
    isLoading: boolean;
    isPurchaseModalOpen: boolean;
    openPurchaseModal: (initialTab?: 'points' | 'membership') => void;
    initialTab: 'points' | 'membership';

    closePurchaseModal: () => void;
    packages: PointPackage[]; // Added
    config: PointConfig; // Added
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);



export const PointsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isSubscribed, setIsSubscribed] = useState(false); // Added
    const [isLoading, setIsLoading] = useState(false);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [initialTab, setInitialTab] = useState<'points' | 'membership'>('points');

    const openPurchaseModal = (tab: 'points' | 'membership' = 'points') => {
        setInitialTab(tab);
        setIsPurchaseModalOpen(true);
    };
    const closePurchaseModal = () => setIsPurchaseModalOpen(false);

    // Fetch user profile on mount or user change
    useEffect(() => {
        const fetchProfile = async () => {
            if (user?.email) {
                // setIsLoading(true); // Don't block whole UI, just profile loading
                try {
                    const userProfile = await getUserProfile(user.email);
                    if (userProfile) {
                        setBalance(userProfile.points);
                        setTransactions(userProfile.transactions || []);
                        const sub = userProfile.subscription;
                        const isValid = sub?.active && sub.endDate > Date.now();
                        setIsSubscribed(!!isValid);
                    }
                } catch (error) {
                    console.error("Failed to fetch user points:", error);
                }
            } else {
                setBalance(0);
                setTransactions([]);
                setIsSubscribed(false);
            }
        };

        fetchProfile();
    }, [user?.email]);

    // Fetch Packages from Backend
    const [packages, setPackages] = useState<PointPackage[]>([]);

    useEffect(() => {
        const fetchPackages = async () => {
            try {
                const response = await fetch('http://localhost:3001/packages');
                if (response.ok) {
                    const data = await response.json();
                    setPackages(data);
                }
            } catch (e) {
                console.error("Failed to fetch packages:", e);
            }
        };
        fetchPackages();
        fetchPackages();
    }, []);

    const [pointConfig, setPointConfig] = useState<PointConfig>({
        TRIP_BASE_COST: 50,
        TRIP_DAILY_COST: 10,
        NEW_USER_BONUS: 500,
        ATTRACTION_SEARCH_COST: 10,
        RECOMMENDATION_COUNT: 12,
        GALLERY_PAGE_SIZE_DEFAULT: 12,
        GALLERY_PAGE_SIZE_MAX: 24,
        GALLERY_PAGE_MAX: 1000,
        RANDOM_TRIPS_DEFAULT: 6,
        RANDOM_TRIPS_MAX: 12
    });

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await fetch('http://localhost:3001/config');
                if (response.ok) {
                    const data = await response.json();
                    setPointConfig(data);
                }
            } catch (e) {
                console.error("Failed to fetch points config:", e);
            }
        };
        fetchConfig();
    }, []);

    const purchasePoints = async (packageId: string): Promise<void> => {
        if (!user?.email) return;

        setIsLoading(true);
        const pkg = packages.find(p => p.id === packageId);

        try {
            if (pkg) {
                let updatedUser;
                if (pkg.type === 'subscription') {
                    // Activate Subscription
                    updatedUser = await activateUserSubscription(user.email, pkg.id);
                    setIsSubscribed(true);
                } else {
                    // Add Points
                    updatedUser = await addUserPoints(user.email, pkg.points, `購買 ${pkg.name} 方案`);
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
            const updatedUser = await addUserPoints(user.email, -amount, description);
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
            initialTab,
            closePurchaseModal,
            packages, // Added
            config: pointConfig // Added
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
