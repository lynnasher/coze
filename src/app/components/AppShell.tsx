'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Library, BarChart3, User } from 'lucide-react';
import { AuthModal, getCurrentUser as getStoredUser } from '@/components/AuthModal';
import { useDeviceValidation } from '@/hooks/use-device-validation';
import { DeviceKickedDialog } from '@/components/DeviceKickedDialog';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    phone: string;
    nickname?: string;
    role: string;
    activatedCategories?: string[];
  } | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 设备验证（单设备登录）
  const { kicked, kickMessage, clearKickState } = useDeviceValidation({
    interval: 30000,
    validateOnFocus: true,
  });

  // 处理被踢下线
  const handleKicked = () => {
    setCurrentUser(null);
    clearKickState();
    window.location.reload();
  };

  // 加载当前用户
  const loadUser = useCallback(() => {
    const user = getStoredUser();
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    setMounted(true);
    loadUser();

    // 监听用户状态变化
    const handleStorage = () => loadUser();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [loadUser]);

  const navItems = [
    { href: '/', label: '首页', icon: Home },
    { href: '/library', label: '题库', icon: Library },
    { href: '/stats', label: '统计', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-[970px] mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="font-bold text-slate-800">智能刷题</span>
          </Link>

          <div className="flex items-center gap-2">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm text-slate-600 hidden sm:inline">
                  {currentUser.nickname || currentUser.phone}
                </span>
                <button
                  onClick={() => {
                    localStorage.removeItem('quiz_user_token');
                    localStorage.removeItem('quiz_user_data');
                    setCurrentUser(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  退出
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">登录</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 页面内容 */}
      <main>{children}</main>

      {/* 底部导航 */}
      {mounted && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-t border-slate-100 safe-area-bottom">
          <div className="max-w-[970px] mx-auto px-4">
            <div className="flex items-center justify-around h-14">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex flex-col items-center gap-0.5 py-1 px-4 rounded-lg transition-all',
                      isActive
                        ? 'text-indigo-600'
                        : 'text-slate-400 hover:text-slate-600'
                    )}
                  >
                    <Icon className={cn('w-5 h-5', isActive && 'text-indigo-600')} />
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      )}

      {/* 登录弹窗 */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onLoginSuccess={() => {
          loadUser();
        }}
      />

      {/* 设备被踢下线提示 */}
      <DeviceKickedDialog
        open={kicked}
        message={kickMessage}
        onConfirm={handleKicked}
      />
    </div>
  );
}
