'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { LoadingState } from '../../components/ui';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingState message="Verifying session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // redirect in progress
  }

  return <DashboardShell>{children}</DashboardShell>;
}
