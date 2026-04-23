'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getLoginPath } from '@/lib/admin-config';
import {
  BookOpen,
  Users,
  Key,
  Tag,
  List,
  Settings,
  LogOut,
  Shield,
} from 'lucide-react';

// 懒加载后台子页面
const BanksPage = dynamic(() => import('./BanksPage'), {
  loading: () => <AdminLoading />,
  ssr: false,
});

const UsersPage = dynamic(() => import('./UsersPage'), {
  loading: () => <AdminLoading />,
  ssr: false,
});

const CodesPage = dynamic(() => import('./CodesPage'), {
  loading: () => <AdminLoading />,
  ssr: false,
});

const CategoriesPage = dynamic(() => import('./CategoriesPage'), {
  loading: () => <AdminLoading />,
  ssr: false,
});

const SettingsPage = dynamic(() => import('./SettingsPage'), {
  loading: () => <AdminLoading />,
  ssr: false,
});

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
  { href: '/admin', icon: BookOpen, label: '题库管理', component: BanksPage },
  { href: '/admin/users', icon: Users, label: '用户管理', component: UsersPage },
  { href: '/admin/codes', icon: Key, label: '激活码', component: CodesPage },
  { href: '/admin/categories', icon: Tag, label: '分类管理', component: CategoriesPage },
  { href: '/admin/settings', icon: Settings, label: '设置', component: SettingsPage },
];

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ username: string } | null>(null);

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
      if (payload.exp < Date.now()) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        router.push(getLoginPath());
        return;
      }
      setIsAuthenticated(true);
      setCurrentUser(payload);
    } catch {
      router.push(getLoginPath());
    }
  }, [router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push(getLoginPath());
  };

  // 根据路径选择要渲染的组件（不在渲染期间创建组件）
  const renderComponent = () => {
    if (pathname === '/admin' || pathname === '/admin/banks') {
      return <BanksPage />;
    }
    if (pathname === '/admin/users') {
      return <UsersPage />;
    }
    if (pathname === '/admin/codes') {
      return <CodesPage />;
    }
    if (pathname === '/admin/categories') {
      return <CategoriesPage />;
    }
    if (pathname === '/admin/settings' || pathname === '/admin/change-password') {
      return <SettingsPage />;
    }
    return <BanksPage />;
  };

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

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Suspense fallback={<AdminLoading />}>
          {renderComponent()}
        </Suspense>
      </main>
    </div>
  );
}
