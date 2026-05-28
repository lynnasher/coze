'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getLoginPath } from '@/lib/admin-config';
import { Shield } from 'lucide-react';
import { deviceService } from '@/lib/services/device-service';
import { DeviceKickedDialog } from '@/components/DeviceKickedDialog';
import { STORAGE_KEYS } from '@/lib/constants';

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
  const [kicked, setKicked] = useState(false);
  const [kickMessage, setKickMessage] = useState('您的账号已在其他设备登录');

  // 验证 token
  const checkAuth = useCallback(() => {
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) {
      router.push(getLoginPath());
      return;
    }

    try {
      // Token 格式: base64payload.signature (HMAC-SHA256)
      const payloadStr = token.split('.')[0];
      const payload = JSON.parse(atob(payloadStr));

      if (!payload.exp || payload.exp < Date.now()) {
        localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_DEVICE_ID);
        router.push(getLoginPath());
        return;
      }

      const userStr = localStorage.getItem(STORAGE_KEYS.ADMIN_USER);
      if (userStr) {
        setCurrentUser(JSON.parse(userStr));
      }
      setIsAuthenticated(true);
    } catch {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
      localStorage.removeItem(STORAGE_KEYS.ADMIN_DEVICE_ID);
      router.push(getLoginPath());
    }
  }, [router]);

  // 设备验证（单设备登录控制）
  const validateDevice = useCallback(async () => {
    const result = await deviceService.validateDevice();
    if (result.kicked) {
      setKickMessage(result.error || '您的账号已在其他设备登录');
      setKicked(true);
    }
  }, []);

  // 定期验证设备
  useEffect(() => {
    if (!isAuthenticated) return;

    // 立即验证一次
    validateDevice();

    // 每30秒验证一次
    const interval = setInterval(validateDevice, 30000);

    // 页面重新获得焦点时也验证
    const handleFocus = () => validateDevice();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthenticated, validateDevice]);

  // 处理被踢下线确认
  const handleKickConfirm = () => {
    deviceService.clearAuthData();
    setKicked(false);
    router.push(getLoginPath());
  };

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
              localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
              localStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
              localStorage.removeItem(STORAGE_KEYS.ADMIN_DEVICE_ID);
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

      {/* 设备被踢下线提示 */}
      <DeviceKickedDialog
        open={kicked}
        onConfirm={handleKickConfirm}
        message={kickMessage}
      />
    </div>
  );
}
