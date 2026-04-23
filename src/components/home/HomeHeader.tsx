/**
 * HomeHeader - 首页头部组件
 */

'use client';

import { Flame, Target, LogIn } from 'lucide-react';
import { AuthModal } from '@/components/AuthModal';
import { useState } from 'react';

interface HomeHeaderProps {
  user: { nickname?: string; phone: string; role: string } | null;
  totalQuestions: number;
  streakDays: number;
}

export function HomeHeader({ user, totalQuestions, streakDays }: HomeHeaderProps) {
  const [showAuth, setShowAuth] = useState(false);

  const displayName = user?.nickname || user?.phone?.slice(-4)?.padStart(4, '*') || '未登录';

  const handleLogout = () => {
    localStorage.removeItem('user-storage');
    window.location.reload();
  };

  return (
    <>
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-[970px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-md">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-800">智能刷题</h1>
                <p className="text-xs text-slate-400">
                  {totalQuestions > 0 ? `${totalQuestions} 道题目` : '开始学习'}
                </p>
              </div>
            </div>

            {/* 右侧 */}
            <div className="flex items-center gap-3">
              {/* 连续学习天数 */}
              {user && streakDays > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-50 rounded-lg">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold text-orange-600">
                    {streakDays} 天
                  </span>
                </div>
              )}

              {/* 用户区域 */}
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-700">{displayName}</p>
                    <p className="text-xs text-slate-400">
                      {user.role === 'admin' ? '管理员' : '普通用户'}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    退出
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuth(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  登录
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 登录弹窗 */}
      <AuthModal 
        open={showAuth} 
        onOpenChange={setShowAuth}
      />
    </>
  );
}
