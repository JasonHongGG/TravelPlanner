import { useState } from 'react';
import { Trip, TripData, FeasibilityResult } from '../types';
import { aiService } from '../services';

interface UseFeasibilityCheckOptions {
  trip: Trip;
  onUpdateTrip: (tripId: string, newData: TripData) => void;
  userEmail?: string;
  language: string;
  onCancelExplorer?: () => void;
}

export const useFeasibilityCheck = ({
  trip,
  onUpdateTrip,
  userEmail,
  language,
  onCancelExplorer
}: UseFeasibilityCheckOptions) => {
  const [isCheckingFeasibility, setIsCheckingFeasibility] = useState(false);
  const [feasibilityResult, setFeasibilityResult] = useState<FeasibilityResult | null>(null);
  const [pendingUpdateAction, setPendingUpdateAction] = useState<(() => Promise<void>) | null>(null);
  const [pendingNewData, setPendingNewData] = useState<TripData | null>(null);

  const performFeasibilityCheck = async (context: string, executeIfSafe: () => Promise<void>) => {
    if (!trip.data) return;

    setIsCheckingFeasibility(true);
    try {
      const result = await aiService.checkFeasibility(trip.data, context, userEmail, language);
      setIsCheckingFeasibility(false);

      if (!result.feasible || result.riskLevel === 'high' || result.riskLevel === 'moderate') {
        setFeasibilityResult(result);
        setPendingUpdateAction(() => executeIfSafe);
      } else {
        await executeIfSafe();
      }
    } catch (e) {
      console.error("Check failed", e);
      setIsCheckingFeasibility(false);
      await executeIfSafe();
    }
  };

  const setChatPendingUpdate = (result: FeasibilityResult, updatedData?: TripData) => {
    setFeasibilityResult(result);
    if (updatedData) {
      setPendingNewData(updatedData);
    }
  };

  const handleFeasibilityConfirm = async () => {
    if (pendingUpdateAction) {
      await pendingUpdateAction();
    }

    if (pendingNewData) {
      onUpdateTrip(trip.id, pendingNewData);
    }

    setFeasibilityResult(null);
    setPendingUpdateAction(null);
    setPendingNewData(null);
  };

  const handleFeasibilityCancel = () => {
    setFeasibilityResult(null);
    setPendingUpdateAction(null);
    setPendingNewData(null);
    onCancelExplorer?.();
  };

  return {
    isCheckingFeasibility,
    setIsCheckingFeasibility,
    feasibilityResult,
    performFeasibilityCheck,
    setChatPendingUpdate,
    handleFeasibilityConfirm,
    handleFeasibilityCancel
  };
};
