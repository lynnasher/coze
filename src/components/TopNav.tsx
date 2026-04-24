'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ArrowLeft, 
  GraduationCap, 
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/lib/store';

interface TopNavProps {
  title?: string;
  showBack?: boolean;
  backHref?: string;
  rightContent?: React.ReactNode;
}

export function TopNav({ 
  title, 
  showBack = false, 
  backHref = '/',
  rightContent,
}: TopNavProps) {
  const pathname = usePathname();
  const { isLoggedIn } = useUserStore();

  // 默认首页导航
  if (!showBack && !title) {
    return (
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[970px] mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-slate-700">智能刷题</span>
            </Link>
            
            {/* 用户区域 */}
            <div className="flex items-center gap-2">
              {isLoggedIn() ? (
                // 已登录：显示个人中心入口（紫色背景）
                <Link href="/profile">
                  <button
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-600 transition-colors"
                    title="个人中心"
                  >
                    <User className="w-5 h-5" />
                  </button>
                </Link>
              ) : (
                // 未登录：显示登录入口（深色背景），点击带回登录参数
                <Link href="/?login=true">
                  <button
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                    title="登录"
                  >
                    <User className="w-5 h-5" />
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>
    );
  }

  // 子页面导航（带返回按钮）
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-[970px] mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            {showBack && (
              <Link href={backHref}>
                <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl">
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
                </Button>
              </Link>
            )}
            {title && (
              <h1 className="text-base font-semibold text-slate-700">{title}</h1>
            )}
          </div>
          
          {rightContent && (
            <div className="flex items-center gap-2">
              {rightContent}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
