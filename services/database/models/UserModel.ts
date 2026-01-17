
import { BaseModel } from "../BaseModel";

export interface Transaction {
    id: string;
    date: number;
    amount: number;
    type: 'purchase' | 'spend';
    description: string;
}

export interface User {
    email: string;
    points: number;
    transactions: Transaction[];
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
}
