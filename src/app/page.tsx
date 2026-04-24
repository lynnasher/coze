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
    
    // 检查 URL 参数，如果需要登录则自动打开登录弹窗
    const shouldLogin = searchParams.get('login') === 'true';
    if (shouldLogin && !isLoggedIn()) {
      setAuthModalOpen(true);
    }
  }, [loadData, searchParams, isLoggedIn]);

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



     

        {/* 未登录提示 */}
        {!isLoggedIn() && (
          <Card className="mt-6 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-900">登录后查看更多题库</h4>
                  <p className="text-xs text-gray-600 mt-0.5">登录后可解锁已激活的分类并开始练习</p>
                </div>
                <Button 
                  size="sm" 
                  className="rounded-xl bg-blue-600 hover:bg-blue-700"
                  onClick={() => setAuthModalOpen(true)}
                >
                  登录
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
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
