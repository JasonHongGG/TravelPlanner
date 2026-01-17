
import { IStorageAdapter } from "../interfaces/IStorageAdapter";

const API_BASE_URL = 'http://localhost:3002';

export class RestApiAdapter implements IStorageAdapter {

    async findById<T>(collection: string, id: string): Promise<T | null> {
        try {
            const response = await fetch(`${API_BASE_URL}/${collection}/${id}`);
            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`Api Error: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`[RestApiAdapter] Find Error:`, error);
            return null;
        }
    }

    async create<T>(collection: string, data: any): Promise<T> {
        // In our simple DB server, creation often happens via find or custom endpoints, 
        // but we can implement standard create if needed. 
        // For now, let's assume 'create' might map to a specific endpoint or be unused if we rely on specific flows.
        console.warn("[RestApiAdapter] Create generic not fully implemented, using mock pass-through");
        return data as T;
    }

    async update<T>(collection: string, id: string, data: Partial<T>): Promise<T | null> {
        // Generic update logic would go here
        console.warn("[RestApiAdapter] Update generic not fully implemented");
        return null;
    }

    async execute<T>(collection: string, operation: string, params: any): Promise<T> {
        // Handles custom operations like 'transaction'
        // Example: collection='users', operation='transaction', params={ id: '...', ... }
        if (operation === 'transaction') {
            const { id, transaction } = params;
            // construct URL: /users/:id/transaction
            const response = await fetch(`${API_BASE_URL}/${collection}/${id}/transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transaction })
            });

            if (!response.ok) {
                throw new Error(`Transaction failed: ${response.statusText}`);
            }

            return await response.json();
        }

        throw new Error(`Unknown operation: ${operation}`);
    }
}
