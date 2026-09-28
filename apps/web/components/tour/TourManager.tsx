'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { ProductTour } from './ProductTour';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useAuth } from '../../hooks/useAuth';

function TourManagerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { status, isLoading, saveTour } = useOnboarding();
  const [isOpen, setIsOpen] = useState(false);

  const forceTour = searchParams.get('tour') === 'true';

  useEffect(() => {
    const handleStartTour = () => setIsOpen(true);
    window.addEventListener('reachinbox:start-tour', handleStartTour);
    return () => {
      window.removeEventListener('reachinbox:start-tour', handleStartTour);
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (forceTour) {
      setIsOpen(true);
      return;
    }

    const userId = user?.id || 'default';
    const localTourDone = typeof window !== 'undefined' && localStorage.getItem(`reachinbox_tour_completed_${userId}`) === 'true';

    // Auto-trigger on dashboard overview ONLY IF tour has not yet been completed or dismissed
    if (pathname === '/dashboard' && status && !status.tourCompleted && !localTourDone) {
      setIsOpen(true);
    }
  }, [status, isLoading, forceTour, pathname, user?.id]);

  const handleClose = async (completed: boolean) => {
    setIsOpen(false);
    const userId = user?.id || 'default';
    if (typeof window !== 'undefined') {
      localStorage.setItem(`reachinbox_tour_completed_${userId}`, 'true');
    }
    if (completed) {
      await saveTour(true);
    }
    if (forceTour) {
      router.replace(pathname);
    }
  };

  return <ProductTour isOpen={isOpen} onClose={handleClose} />;
}

export function TourManager() {
  return (
    <Suspense fallback={null}>
      <TourManagerInner />
    </Suspense>
  );
}
