import { OAuth2Client } from 'google-auth-library';
import type { Request, Response, NextFunction } from 'express';

export interface AuthUser {
    email: string;
    name?: string;
    picture?: string;
    sub?: string;
}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verifyIdToken(idToken: string): Promise<AuthUser> {
    if (!process.env.GOOGLE_CLIENT_ID) {
        throw new Error('GOOGLE_CLIENT_ID is not configured.');
    }

    const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
        throw new Error('Invalid token payload.');
    }

    return {
        email: payload.email,
        name: payload.name || undefined,
        picture: payload.picture || undefined,
        sub: payload.sub || undefined
    };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing auth token.' });
    }

    const token = authHeader.substring('Bearer '.length);
    try {
        const user = await verifyIdToken(token);
        (req as Request & { user?: AuthUser }).user = user;
        return next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid auth token.' });
    }
}
