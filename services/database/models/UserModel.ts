
import { BaseModel } from "../BaseModel";

export interface Transaction {
    id: string;
    date: number;
    amount: number;
    type: 'purchase' | 'spend' | 'subscription_activation';
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

export class UserModel extends BaseModel<User> {
    protected collectionName = 'users';

    async getProfile(email: string): Promise<User | null> {
        // Our 'id' is the email for now
        return this.findById(email);
    }

    async addPoints(email: string, amount: number, description: string): Promise<User> {
        const transaction: Transaction = {
            id: crypto.randomUUID(),
            date: Date.now(),
            amount: amount,
            type: amount > 0 ? 'purchase' : 'spend',
            description
        };

        // Use the adapter's custom execution for atomic transaction
        return this.adapter.execute<User>(this.collectionName, 'transaction', {
            id: email,
            transaction
        });
    }

    async activateSubscription(email: string, planId: string): Promise<User> {
        const transaction: Transaction = {
            id: crypto.randomUUID(),
            date: Date.now(),
            amount: 0,
            type: 'subscription_activation',
            description: '啟用訂閱：旅遊貼身助理'
        };

        return this.adapter.execute<User>(this.collectionName, 'transaction', {
            id: email,
            transaction
        });
    }
}
