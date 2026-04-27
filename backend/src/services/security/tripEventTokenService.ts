import crypto from 'crypto';

type TripEventTokenPayload = {
    tripId: string;
    userId: string;
    role?: 'read' | 'write';
    revision?: number;
    expiresAt: number;
};

const TOKEN_TTL_MS = Number.parseInt(process.env.TRIP_EVENT_TOKEN_TTL_MS || '', 10) || 10 * 60 * 1000;

function getSecret() {
    const secret = process.env.TRIP_EVENT_TOKEN_SECRET || process.env.TRIP_ENCRYPTION_KEY;
    if (!secret && process.env.NODE_ENV === 'production') {
        throw new Error('TRIP_EVENT_TOKEN_SECRET is required in production.');
    }
    return secret || 'development-trip-event-token-secret';
}

function toBase64Url(value: string) {
    return Buffer.from(value, 'utf-8').toString('base64url');
}

function fromBase64Url(value: string) {
    return Buffer.from(value, 'base64url').toString('utf-8');
}

function signPayload(encodedPayload: string) {
    return crypto.createHmac('sha256', getSecret()).update(encodedPayload).digest('base64url');
}

export function createTripEventToken(tripId: string, userId: string, options: { role?: 'read' | 'write'; revision?: number } = {}) {
    const payload: TripEventTokenPayload = {
        tripId,
        userId,
        role: options.role,
        revision: options.revision,
        expiresAt: Date.now() + TOKEN_TTL_MS
    };
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signature = signPayload(encodedPayload);
    return {
        token: `${encodedPayload}.${signature}`,
        expiresAt: payload.expiresAt
    };
}

export function verifyTripEventToken(tripId: string, token: string): TripEventTokenPayload | null {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return null;

    const expectedSignature = signPayload(encodedPayload);
    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;

    try {
        const payload = JSON.parse(fromBase64Url(encodedPayload)) as TripEventTokenPayload;
        if (payload.tripId !== tripId) return null;
        if (payload.expiresAt < Date.now()) return null;
        if (!payload.userId) return null;
        return payload;
    } catch {
        return null;
    }
}
