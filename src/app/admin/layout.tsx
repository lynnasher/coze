'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getLoginPath } from '@/lib/admin-config';
import {
  BookOpen,
  Users,
  Key,
  Tag,
  Settings,
  LogOut,
  Shield,
} from 'lucide-react';

// 加载状态
function AdminLoading() {
  return (
    <div className="flex items-center justify-center h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
  );
}

// 菜单项配置
const menuItems = [
  { href: '/admin', icon: BookOpen, label: '题库管理' },
  { href: '/admin/users', icon: Users, label: '用户管理' },
  { href: '/admin/codes', icon: Key, label: '激活码' },
  { href: '/admin/categories', icon: Tag, label: '分类管理' },
  { href: '/admin/settings', icon: Settings, label: '设置' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
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

  // 登出
  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push(getLoginPath());
  };

  if (isChecking) {
    return <AdminLoading />;
  }

  if (!isAuthenticated) {
    return <AdminLoading />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">后台管理</h1>
                <p className="text-xs text-gray-500">智能刷题助手</p>
              </div>
            </div>

            {/* 用户信息 */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                欢迎，<span className="font-medium">{currentUser?.username}</span>
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
                退出
              </button>
            </div>
          </div>
        </div>

        {/* 菜单栏 */}
        <div className="border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex gap-1 -mb-px overflow-x-auto">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href === '/admin' && pathname === '/admin');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* 主内容区 - 子页面会自动渲染在这里 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Suspense fallback={<AdminLoading />}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
