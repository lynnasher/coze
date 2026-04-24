'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  LogOut, 
  User, 
  Library,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TopNav } from '@/components/TopNav';
import { useUserStore } from '@/lib/store';
import { recordStore } from '@/lib/quiz-store';
import { calculateStreakStats, calculateTrendData, calculateFilteredStats } from '@/lib/stats-utils';
import { StreakCard, TrendChart, FilterTabs, StatsGrid } from '@/components/stats';

type StatsFilter = 'day' | 'week' | 'month' | 'all';

export default function ProfilePage() {
  const { user: currentUser, isLoggedIn, logout, hasHydrated } = useUserStore();
  const [statsFilter, setStatsFilter] = useState<StatsFilter>('day');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 计算统计数据
  const allRecords = recordStore.getAll();
  const filteredStats = calculateFilteredStats(allRecords, statsFilter);
  const streak = calculateStreakStats(allRecords);
  const trend = calculateTrendData(allRecords);

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  // 等待挂载和 store 恢复
  if (!mounted || !hasHydrated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // 未登录状态显示
  if (!isLoggedIn()) {
    return (
      <div className="min-h-screen bg-slate-50">
        <TopNav title="个人中心" showBack backHref="/" />
        
        <div className="max-w-[970px] mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-700 mb-2">未登录</h3>
          <p className="text-sm text-slate-400 mb-6">请先登录查看个人信息</p>
          <Link href="/?login=true">
            <Button className="bg-indigo-500 hover:bg-indigo-600 rounded-xl">
              去登录
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航 */}
      <TopNav 
        title="个人中心" 
        showBack 
        backHref="/"
        rightContent={
          <button
            onClick={handleLogout}
            className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            title="退出登录"
          >
            <LogOut className="w-5 h-5" />
          </button>
        }
      />

      {/* 主内容 */}
      <main className="max-w-[970px] mx-auto px-4 py-6">
        {/* 用户信息卡片 */}
        <div className="mb-6">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">
                  {currentUser?.nickname || currentUser?.phone}
                </h2>
                <p className="text-indigo-100 text-sm mt-1">
                  {currentUser?.phone}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 连续学习天数 */}
        <StreakCard streak={streak} />

        {/* 近7天学习趋势 */}
        <div className="mt-4">
          <TrendChart trend={trend} />
        </div>

        {/* 日期筛选 */}
        <div className="mt-4">
          <FilterTabs value={statsFilter} onChange={setStatsFilter} />
        </div>

        {/* 统计卡片网格 */}
        <div className="mt-4">
          <StatsGrid stats={filteredStats} />
        </div>

        {/* 功能入口 */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">功能</h3>
          <div className="space-y-2">
            <Link href="/library">
              <Card className="border-0 shadow-sm rounded-xl bg-white cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                      <Library className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-slate-700">题库浏览</h4>
                      <p className="text-xs text-slate-400">浏览所有题库</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/wrongbook">
              <Card className="border-0 shadow-sm rounded-xl bg-white cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-slate-700">错题本</h4>
                      <p className="text-xs text-slate-400">查看错题并复习</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
