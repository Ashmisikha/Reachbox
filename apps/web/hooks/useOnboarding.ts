'use client';
import { useState, useEffect, useCallback } from 'react';
import { onboardingApiService, OnboardingStatus } from '../services/onboarding.service';

export function useOnboarding() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await onboardingApiService.getStatus();
      setStatus(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveSetup = async (data: {
    setupCompleted?: boolean;
    workspaceName?: string;
    userName?: string;
    minDelayMs?: number;
    hourlyLimit?: number;
  }) => {
    const updated = await onboardingApiService.saveSetup(data);
    if (updated) setStatus(updated);
    return updated;
  };

  const saveTour = async (tourCompleted: boolean) => {
    const updated = await onboardingApiService.saveTour(tourCompleted);
    if (updated) setStatus(updated);
    return updated;
  };

  const replayTour = async () => {
    const updated = await onboardingApiService.replayTour();
    if (updated) setStatus(updated);
    return updated;
  };

  const resetSetup = async () => {
    const updated = await onboardingApiService.resetSetup();
    if (updated) setStatus(updated);
    return updated;
  };

  return {
    status,
    isLoading,
    refresh,
    saveSetup,
    saveTour,
    replayTour,
    resetSetup,
  };
}
