'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Library, 
  User,
  BookOpen,
  Flame,
  Loader2,
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { Button } from '@/components/ui/button';
import { AuthModal } from '@/components/AuthModal';
import { useUserStore } from '@/lib/store';
import { recordStore } from '@/lib/quiz-store';
import { calculateStreakStats, calculateTrendData, calculateFilteredStats } from '@/lib/stats-utils';
import { User as UserType } from '@/lib/types';
import { StreakCard, TrendChart, FilterTabs, StatsGrid } from '@/components/stats';

type StatsFilter = 'day' | 'week' | 'month' | 'all';

// 直接从 localStorage 读取用户状态
const getStoredUser = (): { user: UserType | null; token: string | null } => {
  try {
    const token = localStorage.getItem('quiz_user_token');
    const userData = localStorage.getItem('quiz_user_data');
    
    if (!token || !userData) {
      return { user: null, token: null };
    }
    
    const parsedUser = JSON.parse(userData);
    const user: UserType = {
      ...parsedUser,
      activatedCategories: parsedUser.activated_categories || [],
    };
    
    return { user, token };
  } catch {
    return { user: null, token: null };
  }
};

export default function HomePage() {
  const searchParams = useSearchParams();
  const { login, logout } = useUserStore();
  
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [statsFilter, setStatsFilter] = useState<StatsFilter>('day');

  // 初始化 - 检查登录状态
  useEffect(() => {
    const stored = getStoredUser();
    setIsLoggedIn(!!stored.user && !!stored.token);
    setCurrentUser(stored.user);
    setMounted(true);
    
    if (stored.user && stored.token) {
      login(stored.user, stored.token);
    }
  }, [login]);

  // 处理 URL 参数
  useEffect(() => {
    if (!mounted) return;
    
    const shouldLogin = searchParams.get('login') === 'true';
    const shouldLogout = searchParams.get('logout') === 'true';
    
    if (shouldLogin && !isLoggedIn) {
      setAuthModalOpen(true);
    }
    
    if (shouldLogout && isLoggedIn) {
      logout();
      window.location.href = '/';
    }
  }, [searchParams, mounted, isLoggedIn, logout]);

  // 登录成功回调
  const handleAuthSuccess = () => {
    const stored = getStoredUser();
    setIsLoggedIn(true);
    setCurrentUser(stored.user);
    if (stored.user && stored.token) {
      login(stored.user, stored.token);
    }
    setAuthModalOpen(false);
  };

  // 计算统计数据
  const allRecords = recordStore.getAll();
  const filteredStats = calculateFilteredStats(allRecords, statsFilter);
  const streak = calculateStreakStats(allRecords);
  const trend = calculateTrendData(allRecords);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // 未登录状态
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <TopNav />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-3xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">智能刷题</h2>
            <p className="text-gray-500 text-sm mb-8">登录后可浏览题库、开始练习、记录错题</p>
            <Button 
              size="lg" 
              className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-8 h-12 text-base"
              onClick={() => setAuthModalOpen(true)}
            >
              立即登录
            </Button>
          </div>
        </main>
        <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} onAuthChange={handleAuthSuccess} />
      </div>
    );
  }

  // 已登录状态
  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />

      <main className="max-w-[970px] mx-auto px-4 py-6">
        {/* 欢迎卡片 */}
        <div className="mb-6">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold mb-1">
                  欢迎回来，{currentUser?.nickname || '同学'}
                </h1>
                <p className="text-indigo-100 text-sm">今天也要坚持学习哦！</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Flame className="w-6 h-6 text-white" />
              </div>
            </div>
            
            <div className="flex gap-3 mt-5">
              <Link href="/library" className="flex-1">
                <Button className="w-full bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl">
                  <Library className="w-4 h-4 mr-2" />
                  浏览题库
                </Button>
              </Link>
              <Link href="/wrongbook" className="flex-1">
                <Button variant="outline" className="w-full bg-transparent border-white text-white hover:bg-white/10 rounded-xl">
                  <BookOpen className="w-4 h-4 mr-2" />
                  错题本
                </Button>
              </Link>
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
      </main>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} onAuthChange={handleAuthSuccess} />
    </div>
  );
}
