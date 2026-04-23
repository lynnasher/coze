'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getLoginPath } from '@/lib/admin-config';

// 加载状态
function AdminLoading() {
  return (
    <div className="flex items-center justify-center h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // 验证 token
  const checkAuth = useCallback(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push(getLoginPath());
      return;
    }

    try {
      // Token 格式: base64payload.signature (HMAC-SHA256)
      const payloadStr = token.split('.')[0];
      const payload = JSON.parse(atob(payloadStr));
      
      if (!payload.exp || payload.exp < Date.now() / 1000) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        router.push(getLoginPath());
        return;
      }

      setIsAuthenticated(true);
    } catch {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      router.push(getLoginPath());
    }
  }, [router]);

  useEffect(() => {
    checkAuth();
    setIsChecking(false);
  }, [checkAuth]);

  if (isChecking) {
    return <AdminLoading />;
  }

  if (!isAuthenticated) {
    return <AdminLoading />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
