import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Trip, TripData, TripVisibility } from '../types';
import { tripShareService } from '../services/TripShareService';
import { createTripDocumentSaveQueue, type TripDocumentSaveQueue, type TripDocumentSaveResult } from '../services/tripDocumentSession';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

type ShowAlert = (options: {
    type: 'error';
    title: string;
    description: ReactNode;
}) => void;

type UseTripCloudSyncInput = {
    trip: Trip;
    isSharedView: boolean;
    onUpdateTrip: (tripId: string, newData: TripData) => void;
    onUpdateTripMeta?: (updates: Partial<Trip>) => void;
    showAlert: ShowAlert;
    t: (key: string) => string;
};

export function useTripCloudSync({ trip, isSharedView, onUpdateTrip, onUpdateTripMeta, showAlert, t }: UseTripCloudSyncInput) {
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
    const saveQueueRef = useRef<TripDocumentSaveQueue | null>(null);

    useEffect(() => {
        if (!trip.serverTripId || isSharedView) return;

        const validateServerStatus = async () => {
            try {
                const sharedTrip = await tripShareService.getTrip(trip.serverTripId!);

                if (sharedTrip.visibility !== trip.visibility && onUpdateTripMeta) {
                    console.log(`[TripDetail] Syncing visibility mismatch. Server: ${sharedTrip.visibility}, Local: ${trip.visibility}`);
                    onUpdateTripMeta({ visibility: sharedTrip.visibility });
                }
            } catch (error: any) {
                console.warn('[TripDetail] Server validation failed:', error);
                if (error.message.includes('not found') || error.message.includes('Access denied') || error.message.includes('Unauthorized')) {
                    console.log('[TripDetail] Trip not found on server. Reverting to private local state.');
                    onUpdateTripMeta?.({ serverTripId: undefined, visibility: undefined });
                }
            }
        };

        void validateServerStatus();
    }, [isSharedView, onUpdateTripMeta, trip.serverTripId, trip.visibility]);

    useEffect(() => {
        if (!trip.serverTripId || isSharedView) {
            setConnectionStatus('connected');
            return;
        }

        let eventSource: EventSource | null = null;
        let heartbeatTimer: ReturnType<typeof setInterval>;

        const setupConnection = async () => {
            const handleServerEvent = async (type: string) => {
                if (type !== 'trip_updated' && type !== 'visibility_updated') return;

                try {
                    const sharedTrip = await tripShareService.getTrip(trip.serverTripId!);
                    if (sharedTrip?.tripData?.data) {
                        onUpdateTrip(trip.id, sharedTrip.tripData.data);
                        if (onUpdateTripMeta && sharedTrip.visibility !== trip.visibility) {
                            onUpdateTripMeta({ visibility: sharedTrip.visibility });
                        }
                    }
                } catch (error) {
                    console.error('[TripDetail] Failed to sync remote changes', error);
                }
            };

            const token = await tripShareService.createTripEventToken(trip.serverTripId!);
            eventSource = tripShareService.subscribeToTrip(trip.serverTripId!, handleServerEvent, token);
            eventSource.onopen = () => setConnectionStatus('connected');
            eventSource.onerror = () => setConnectionStatus('disconnected');
        };

        void setupConnection().catch((error) => {
            console.error('[TripDetail] Failed to connect to trip events', error);
            setConnectionStatus('disconnected');
        });

        heartbeatTimer = setInterval(() => {
            if (!eventSource) return;
            if (eventSource.readyState === EventSource.OPEN) setConnectionStatus('connected');
            else if (eventSource.readyState === EventSource.CONNECTING) setConnectionStatus('connecting');
            else setConnectionStatus('disconnected');
        }, 5000);

        return () => {
            eventSource?.close();
            clearInterval(heartbeatTimer);
        };
    }, [isSharedView, onUpdateTrip, onUpdateTripMeta, trip.id, trip.serverTripId, trip.visibility]);

    const handleVisibilityChange = useCallback(async (newVisibility: TripVisibility) => {
        if (!trip.data) return;

        setIsSyncing(true);
        try {
            if (newVisibility === 'public') {
                if (trip.serverTripId) {
                    await tripShareService.updateVisibility(trip.serverTripId, 'public');
                    onUpdateTripMeta?.({ visibility: 'public' });
                } else {
                    const result = await tripShareService.createTripDocument(trip, 'public');
                    onUpdateTripMeta?.({ serverTripId: result.tripId, visibility: 'public', revision: result.revision, lastSyncedAt: Date.now() });
                }
            } else if (trip.serverTripId) {
                await tripShareService.updateVisibility(trip.serverTripId, 'private');
                onUpdateTripMeta?.({ visibility: 'private' });
            } else {
                onUpdateTripMeta?.({ visibility: 'private' });
            }
        } catch (error) {
            console.error('Failed to update visibility:', error);
            showAlert({
                type: 'error',
                title: t('trip.permission_update_error_title'),
                description: t('trip.permission_update_error_desc')
            });
        } finally {
            setIsSyncing(false);
        }
    }, [onUpdateTripMeta, showAlert, t, trip]);

    const handleShareToggle = useCallback(async (shouldShare: boolean) => {
        if (!trip.data) return;

        setIsSyncing(true);
        try {
            if (shouldShare) {
                if (trip.serverTripId) {
                    onUpdateTripMeta?.({ visibility: trip.visibility || 'private' });
                } else {
                    const result = await tripShareService.createTripDocument(trip, 'private');
                    onUpdateTripMeta?.({ serverTripId: result.tripId, visibility: 'private', revision: result.revision, lastSyncedAt: Date.now() });
                }
            } else if (trip.serverTripId) {
                await tripShareService.deleteServerTrip(trip.serverTripId);
                onUpdateTripMeta?.({ serverTripId: undefined, lastSyncedAt: undefined });
            }
        } catch (error) {
            console.error('Failed to toggle share:', error);
            showAlert({
                type: 'error',
                title: shouldShare ? t('trip.share_error_title') : t('trip.unshare_error_title'),
                description: t('trip.share_action_error_desc')
            });
        } finally {
            setIsSyncing(false);
        }
    }, [onUpdateTripMeta, showAlert, t, trip]);

    const persistTripToCloud = useCallback(async (tripToSave: Trip): Promise<TripDocumentSaveResult> => {
        setIsSyncing(true);
        try {
            const visibility = tripToSave.visibility || trip.visibility || 'private';
            if (tripToSave.serverTripId) {
                const result = await tripShareService.updateTripContent(tripToSave.serverTripId, tripToSave, tripToSave.revision);
                return { revision: result.revision, lastSyncedAt: Date.now() };
            } else {
                const result = await tripShareService.createTripDocument(tripToSave, visibility);
                return { serverTripId: result.tripId, revision: result.revision, lastSyncedAt: Date.now() };
            }
        } catch (error) {
            console.error('[TripDetail] Auto-sync failed:', error);
            throw error;
        } finally {
            setIsSyncing(false);
        }
    }, [onUpdateTripMeta, trip.visibility]);

    const handleSaveError = useCallback((error: unknown, failedTrip: Trip) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!failedTrip.serverTripId || (!message.includes('409') && !message.includes('Revision conflict'))) return;

        void tripShareService.getTrip(failedTrip.serverTripId).then(sharedTrip => {
            if (sharedTrip.tripData?.data) onUpdateTrip(failedTrip.id, sharedTrip.tripData.data);
            onUpdateTripMeta?.({
                revision: sharedTrip.revision,
                visibility: sharedTrip.visibility,
                lastSyncedAt: Date.now()
            });
        }).catch(reloadError => {
            console.error('[TripDetail] Failed to reload after sync conflict', reloadError);
        });
    }, [onUpdateTrip, onUpdateTripMeta]);

    useEffect(() => {
        saveQueueRef.current?.dispose();
        saveQueueRef.current = createTripDocumentSaveQueue({
            save: persistTripToCloud,
            onSaved: (result) => {
                const updates: Partial<Trip> = { lastSyncedAt: result.lastSyncedAt || Date.now() };
                if (result.serverTripId) updates.serverTripId = result.serverTripId;
                if (result.revision !== undefined) updates.revision = result.revision;
                onUpdateTripMeta?.(updates);
            },
            onError: handleSaveError
        });

        return () => {
            saveQueueRef.current?.dispose();
            saveQueueRef.current = null;
        };
    }, [handleSaveError, onUpdateTripMeta, persistTripToCloud]);

    const saveTripToCloud = useCallback(async (tripToSave: Trip) => {
        saveQueueRef.current?.enqueue(tripToSave);
    }, []);

    const handleTripUpdate = useCallback((tripId: string, newData: TripData) => {
        onUpdateTrip(tripId, newData);
        if (trip.serverTripId) {
            saveQueueRef.current?.enqueue({ ...trip, data: newData });
        }
    }, [onUpdateTrip, trip]);

    return {
        isShareModalOpen,
        setIsShareModalOpen,
        isSyncing,
        connectionStatus,
        handleVisibilityChange,
        handleShareToggle,
        saveTripToCloud,
        handleTripUpdate
    };
}