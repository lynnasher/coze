'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserStatus } from '@/components/AuthModal';
import { useApp } from '@/components/providers/AppProviders';
import { DeviceKickedDialog } from '@/components/DeviceKickedDialog';

export function AppHeader() {
  const pathname = usePathname();
  const { currentUser, kicked, kickMessage, handleKicked, isPracticing } = useApp();

  // 判断当前页面
  const isLibrary = pathname === '/library';
  const isStats = pathname === '/stats';
  const isHome = pathname === '/';
  const isWrongBook = pathname === '/wrongbook';
  
  // 错题页面也隐藏底部导航
  const hideBottomNav = isPracticing || isWrongBook;

  return (
    <>
      <DeviceKickedDialog 
        open={kicked} 
        message={kickMessage}
        onConfirm={handleKicked}
      />
      
      <header className="bg-white/80 backdrop-blur-xl border-b sticky top-0 z-50">
        <div className="max-w-[970px] mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-sm">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">智能刷题</span>
          </Link>
          
          <div className="flex items-center gap-1">
            {currentUser?.role === 'admin' && (
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-gray-500">
                  <Settings className="w-4 h-4" />
                </Button>
              </Link>
            )}
            <UserStatus />
          </div>
        </div>
      </header>

      {/* 页面导航 - 做题或错题本时隐藏 */}
      {!hideBottomNav && (
        <div className="bg-white border-b">
          <div className="max-w-[970px] mx-auto px-4">
            <div className="flex gap-1 py-2">
              {[
                { key: 'practice', label: '首页', href: '/' },
                { key: 'library', label: '题库', href: '/library' },
                { key: 'stats', label: '统计', href: '/stats' },
              ].map((item) => {
                const isActive = 
                  (item.key === 'practice' && isHome) ||
                  (item.key === 'library' && isLibrary) ||
                  (item.key === 'stats' && isStats);
                
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`flex-1 flex items-center justify-center py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-slate-100 text-slate-700'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
