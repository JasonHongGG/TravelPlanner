import { apiUrl, getAuthHeaders, requestJson } from "../http/apiClient";
import { parseErrorResponse } from "../http/parseError";

export interface Transaction {
    id: string;
    date: number;
    amount: number;
    type: "purchase" | "spend" | "subscription_activation";
    description: string;
}

export interface User {
    email: string;
    points: number;
    transactions: Transaction[];
    subscription?: {
        active: boolean;
        startDate: number;
        endDate: number;
        planId: string;
    };
}

export const getUserProfile = async (email: string): Promise<User | null> => {
    try {
        const response = await fetch(apiUrl(`/db/users/${email}`), {
            headers: getAuthHeaders(false)
        });

        if (!response.ok) {
            if (response.status === 404) return null;
            throw await parseErrorResponse(response, "Api Error");
        }

        return await response.json();
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`[UserService] ${error.message}`);
        }
        throw new Error("[UserService] Unknown error");
    }
};

const postTransaction = async (email: string, transaction: Transaction): Promise<User> => {
    try {
        return await requestJson<User>(`/db/users/${email}/transaction`, {
            method: "POST",
            headers: {
                "Idempotency-Key": transaction.id
            },
            body: { transaction },
            fallbackMessage: "Transaction failed"
        });
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`[UserService] ${error.message}`);
        }
        throw new Error("[UserService] Unknown error");
    }
};

export const addUserPoints = async (email: string, amount: number, description: string): Promise<User> => {
    const transaction: Transaction = {
        id: crypto.randomUUID(),
        date: Date.now(),
        amount,
        type: amount > 0 ? "purchase" : "spend",
        description
    };

    return postTransaction(email, transaction);
};

export const activateUserSubscription = async (email: string, planId: string): Promise<User> => {
    const transaction: Transaction = {
        id: crypto.randomUUID(),
        date: Date.now(),
        amount: 0,
        type: "subscription_activation",
        description: "啟用訂閱：旅遊貼身助理"
    };

    return postTransaction(email, transaction);
};
