// Encryption Utility for .hong file format
// Security Level: Server-Side Encryption (AES-256-GCM)

import { requestJson } from '../services/http/apiClient';

export async function encryptData(data: any): Promise<string> {
    try {
        const result = await requestJson<{ encryptedContent: string }>('/api/exports/encrypt', {
            method: 'POST',
            body: { tripData: data },
            fallbackMessage: 'Encryption failed'
        });
        return result.encryptedContent;
    } catch (e) {
        console.error("Encryption failed:", e);
        throw new Error("Failed to encrypt trip data");
    }
}

export async function decryptData(encryptedString: string): Promise<any> {
    try {
        const result = await requestJson<{ tripData: any }>('/api/exports/decrypt', {
            method: 'POST',
            body: { encryptedContent: encryptedString },
            fallbackMessage: 'Decryption failed'
        });
        return result.tripData;
    } catch (e) {
        console.error("Decryption failed:", e);
        throw new Error("Invalid or corrupted .hong file");
    }
}
