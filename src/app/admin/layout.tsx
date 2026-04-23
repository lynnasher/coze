'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getLoginPath } from '@/lib/admin-config';
import { Shield } from 'lucide-react';

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
  const [currentUser, setCurrentUser] = useState<{ username: string } | null>(null);
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

      const userStr = localStorage.getItem('admin_user');
      if (userStr) {
        setCurrentUser(JSON.parse(userStr));
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
      {/* 简洁的顶部信息栏 */}
      <div className="bg-slate-800 text-white px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span className="text-sm">题库管理后台</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-300">欢迎，{currentUser?.username}</span>
          <button
            onClick={() => {
              localStorage.removeItem('admin_token');
              localStorage.removeItem('admin_user');
              router.push(getLoginPath());
            }}
            className="text-slate-300 hover:text-white transition-colors"
          >
            退出
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
