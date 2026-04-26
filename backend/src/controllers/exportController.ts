import type { Request, Response } from 'express';
import * as cryptoService from '../services/security/cryptoService.js';
import { readUsers } from '../services/data/userStore.js';

export function encryptTrip(req: Request, res: Response) {
    try {
        const { tripData } = req.body;
        if (!tripData) {
            return res.status(400).json({ error: 'tripData is required' });
        }

        const encrypted = cryptoService.encryptTripData(tripData);
        res.json({ encryptedContent: encrypted });
    } catch (error: any) {
        console.error('[ExportController] Encryption error:', error);
        res.status(500).json({ error: 'Encryption failed' });
    }
}

export function decryptTrip(req: Request, res: Response) {
    try {
        const { encryptedContent } = req.body;
        if (!encryptedContent) {
            return res.status(400).json({ error: 'encryptedContent is required' });
        }

        const tripData = cryptoService.decryptTripData(encryptedContent);
        res.json({ tripData });
    } catch (error: any) {
        console.error('[ExportController] Decryption error:', error);
        res.status(400).json({ error: 'Invalid or corrupted file' });
    }
}

export function exportTripJson(req: Request, res: Response) {
    try {
        const { tripData } = req.body;
        const authUser = (req as Request & { user?: { email?: string } }).user;

        if (!authUser?.email) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!tripData) {
            return res.status(400).json({ error: 'tripData is required' });
        }

        const users = readUsers();
        const user = users[authUser.email.toLowerCase()];

        if (!user?.subscription?.active) {
            console.warn(`[ExportController] Blocked JSON export for unauthorized user: ${authUser.email}`);
            return res.status(403).json({ error: 'Subscription required for JSON export.' });
        }

        const filename = `trip_${tripData.title || 'export'}.json`;
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Content-Type', 'application/json');
        res.json(tripData);
    } catch (error: any) {
        console.error('[ExportController] Export error:', error);
        res.status(500).json({ error: 'Export failed' });
    }
}
