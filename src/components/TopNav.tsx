'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ArrowLeft, 
  BookOpen,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/lib/store';
import { useDeviceValidation } from '@/hooks/use-device-validation';
import { DeviceKickedDialog } from '@/components/DeviceKickedDialog';
import { UserStatus } from '@/components/AuthModal';

interface TopNavProps {
  title?: string;
  showBack?: boolean;
  backHref?: string;
  rightContent?: React.ReactNode;
  /** 是否启用设备验证（单设备登录检测），默认 true */
  enableDeviceValidation?: boolean;
}

export function TopNav({ 
  title, 
  showBack = false, 
  backHref = '/',
  rightContent,
  enableDeviceValidation = true,
}: TopNavProps) {
  const pathname = usePathname();
  const { isLoggedIn, logout } = useUserStore();
  
  // 设备验证（单设备登录）- 仅当启用且用户已登录时
  const { kicked, kickMessage, clearKickState } = useDeviceValidation({
    interval: 30000,
    validateOnFocus: true,
    enabled: enableDeviceValidation && isLoggedIn(),
  });

  // 处理被踢下线
  const handleKicked = () => {
    clearKickState();
    logout();
    window.location.href = '/';
  };

  // 默认首页导航
  if (!showBack && !title) {
    return (
      <>
        {/* 设备被挤下线提示 */}
        <DeviceKickedDialog 
          open={kicked} 
          message={kickMessage}
          onConfirm={handleKicked}
        />
        <header className="bg-white/80 backdrop-blur-xl border-b sticky top-0 z-50">
          <div className="max-w-[970px] mx-auto px-4 h-14 flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-sm">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900">智能刷题</span>
            </Link>
            
            {/* 用户区域 - 使用 UserStatus 组件 */}
            <div className="flex items-center gap-1">
              <UserStatus />
            </div>
          </div>
        </header>
      </>
    );
  }

  // 子页面导航（带返回按钮）
  return (
    <>
      {/* 设备被挤下线提示 */}
      <DeviceKickedDialog 
        open={kicked} 
        message={kickMessage}
        onConfirm={handleKicked}
      />
      <header className="bg-white/80 backdrop-blur-xl border-b sticky top-0 z-50">
        <div className="max-w-[970px] mx-auto px-4 h-14 flex items-center justify-between">
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
          
          {/* 用户区域 */}
          <div className="flex items-center gap-1">
            {rightContent}
            <UserStatus />
          </div>
        </div>
      </header>
    </>
  );
}
