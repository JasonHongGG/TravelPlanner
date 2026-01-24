// Encryption Utility for .hong file format
// Security Level: Server-Side Encryption (AES-256-GCM)

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export async function encryptData(data: any): Promise<string> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/trips/encrypt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tripData: data })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Encryption failed');
        }

        const result = await response.json();
        return result.encryptedContent;
    } catch (e) {
        console.error("Encryption failed:", e);
        throw new Error("Failed to encrypt trip data");
    }
}

export async function decryptData(encryptedString: string): Promise<any> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/trips/decrypt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ encryptedContent: encryptedString })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Decryption failed');
        }

        const result = await response.json();
        return result.tripData;
    } catch (e) {
        console.error("Decryption failed:", e);
        throw new Error("Invalid or corrupted .hong file");
    }
}
