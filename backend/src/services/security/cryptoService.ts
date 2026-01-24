import crypto from 'crypto';

// Encryption Configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 12 bytes standard for GCM, utilizing 16 here if needed, but usually 12 is preferred for GCM. Let's stick to Node crypto recommendations.
// Actually for aes-256-gcm, standard IV is 12 bytes (96 bits).
const AUTH_TAG_LENGTH = 16;

// Get Secret Key from Env or Fallback (DEV ONLY)
// In production, this MUST be provided via env vars
const SECRET_KEY_HEX = process.env.TRIP_ENCRYPTION_KEY || 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890'; // 32 bytes hex

function getSecretKey(): Buffer {
    let key = Buffer.from(SECRET_KEY_HEX, 'hex');
    if (key.length !== KEY_LENGTH) {
        // If provided key is not hex or wrong length, derive one using scrypt (fallback)
        // ideally we just throw error in production
        console.warn('[CryptoService] Invalid key length. Using derived key. Check TRIP_ENCRYPTION_KEY.');
        key = crypto.scryptSync(SECRET_KEY_HEX, 'salt', KEY_LENGTH);
    }
    return key;
}

export function encryptTripData(data: any): string {
    try {
        const key = getSecretKey();
        const iv = crypto.randomBytes(12); // GCM standard IV size

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const authTag = cipher.getAuthTag();

        // Format: IV:AuthTag:EncryptedContent
        // All parts encoded in Base64 for safe transport/storage
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
        console.error('[CryptoService] Encryption failed:', error);
        throw new Error('Encryption failed');
    }
}

export function decryptTripData(encryptedString: string): any {
    try {
        // Parse format: IV:AuthTag:EncryptedContent
        const parts = encryptedString.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted format');
        }

        const iv = Buffer.from(parts[0], 'base64');
        const authTag = Buffer.from(parts[1], 'base64');
        const encryptedContent = parts[2];

        const key = getSecretKey();

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedContent, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);

    } catch (error) {
        console.error('[CryptoService] Decryption failed:', error);
        throw new Error('Decryption failed or invalid file');
    }
}
