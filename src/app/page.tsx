'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Library, 
  User,
  BookOpen,
  TrendingUp,
  Flame,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AuthModal } from '@/components/AuthModal';
import { DeviceKickedDialog } from '@/components/DeviceKickedDialog';
import { useUserStore } from '@/lib/store';
import { recordStore } from '@/lib/quiz-store';
import { calculateStreakStats, calculateTrendData, calculateFilteredStats } from '@/lib/stats-utils';
import { QuestionBank, Category, User as UserType } from '@/lib/types';
import { StreakCard, TrendChart, FilterTabs, StatsGrid, WrongBookCard } from '@/components/stats';

type StatsFilter = 'day' | 'week' | 'month' | 'all';

export default function HomePage() {
  const { user: currentUser, isLoggedIn, login, logout, hasHydrated } = useUserStore();
  const searchParams = useSearchParams();
  
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [deviceKickedOpen, setDeviceKickedOpen] = useState(false);
  const [statsFilter, setStatsFilter] = useState<StatsFilter>('day');
  const [mounted, setMounted] = useState(false);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [banksRes, categoriesRes] = await Promise.all([
        fetch('/api/banks'),
        fetch('/api/categories'),
      ]);

      if (banksRes.ok) {
        const banksData = await banksRes.json();
        setBanks(banksData.banks || []);
      }

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.categories || []);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    loadData();
  }, [loadData]);

  // 监听登录状态变化，自动刷新页面
  useEffect(() => {
    const handleAuthChange = () => {
      // 登录状态改变时刷新页面
      window.location.reload();
    };

    window.addEventListener('user-auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('user-auth-change', handleAuthChange);
    };
  }, []);
  
  // 检查 URL 参数，处理登录/退出
  useEffect(() => {
    // 等待 store 恢复完成
    if (!hasHydrated) return;
    
    const shouldLogin = searchParams.get('login') === 'true';
    const shouldLogout = searchParams.get('logout') === 'true';
    
    if (shouldLogin && !isLoggedIn()) {
      setAuthModalOpen(true);
    }
    
    if (shouldLogout && isLoggedIn()) {
      // 异步执行退出（调用后端 API 清除 device_id）
      const doLogout = async () => {
        await logout();
        window.location.href = '/';
      };
      doLogout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, hasHydrated]);

  // 页面加载时同步 localStorage 用户数据到 Zustand
  useEffect(() => {
    if (!currentUser) {
      const token = localStorage.getItem('quiz_user_token');
      const userData = localStorage.getItem('quiz_user_data');
      
      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData);
          // 转换 snake_case 到 camelCase
          const user = {
            ...parsedUser,
            activatedCategories: parsedUser.activated_categories || [],
          };
          login(user, token);
        } catch (e) {
          console.error('同步用户数据失败:', e);
        }
      }
    }
  }, [currentUser, login]);

  // 计算统计数据
  const allRecords = recordStore.getAll();
  const filteredStats = calculateFilteredStats(allRecords, statsFilter);
  const streak = calculateStreakStats(allRecords);
  const trend = calculateTrendData(allRecords);

  // 获取用户激活的分类
  const activatedCategoryIds = currentUser?.activatedCategories || [];
  const activatedBanks = banks.filter(b => 
    !b.categoryId || activatedCategoryIds.includes(b.categoryId)
  );

  // 获取最近练习的题库
  const recentBanks = banks.slice(0, 3);

  if (isLoading || !mounted || !hasHydrated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // 未登录状态 - 显示简洁的登录页面
  if (!isLoggedIn()) {
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
        <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航 */}
      <TopNav />

      {/* 主内容 */}
      <main className="max-w-[970px] mx-auto px-4 py-6">
        {/* 欢迎卡片 */}
        <div className="mb-6">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold mb-1">
                  {isLoggedIn() 
                    ? `欢迎回来，${currentUser?.nickname || '同学'}` 
                    : '欢迎使用智能刷题'}
                </h1>
                <p className="text-indigo-100 text-sm">
                  {isLoggedIn() 
                    ? '今天也要坚持学习哦！' 
                    : '登录后可以解锁更多功能'}
                </p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Flame className="w-6 h-6 text-white" />
              </div>
            </div>
            
            {/* 快捷操作 */}
            <div className="flex gap-3 mt-5">
              <Link href="/library" className="flex-1">
                <Button 
                  className="w-full bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl"
                >
                  <Library className="w-4 h-4 mr-2" />
                  浏览题库
                </Button>
              </Link>
              <Link href="/wrongbook" className="flex-1">
                <Button 
                  variant="outline"
                  className="w-full bg-transparent border-white text-white hover:bg-white/10 rounded-xl"
                >
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

      {/* 登录弹窗 */}
      <AuthModal 
        open={authModalOpen} 
        onOpenChange={setAuthModalOpen}
        onAuthChange={() => setAuthModalOpen(false)}
      />

      {/* 设备被踢下线提示 */}
      <DeviceKickedDialog 
        open={deviceKickedOpen}
        onConfirm={() => {
          logout();
          setDeviceKickedOpen(false);
        }}
      />
    </div>
  );
}
