'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getLoginPath } from '@/lib/admin-config';
import { STORAGE_KEYS } from '@/lib/constants';

export function useAdminAuth() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    const user = localStorage.getItem(STORAGE_KEYS.ADMIN_USER);

    if (!token || !user) {
      router.push(getLoginPath());
      return;
    }

    try {
      const payloadStr = token.split('.')[0];
      const payload = JSON.parse(atob(payloadStr));
      if (payload.exp < Date.now()) {
        localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
        router.push(getLoginPath());
        return;
      }
      setIsAuthenticated(true);
    } catch {
      router.push(getLoginPath());
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
    router.push(getLoginPath());
  };

  return { isAuthenticated, isLoading, handleLogout };
}
