'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { BrandedLoadingScreen } from '@/components/branded-loading-screen';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { authState } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authState === 'unauthenticated') {
      router.replace('/login');
    }
  }, [authState, router]);

  if (authState === 'loading') {
    return <BrandedLoadingScreen fullScreen message="Loading your financial dashboard..." />;
  }

  if (authState === 'unauthenticated') {
    return null;
  }

  return <>{children}</>;
}
