'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Library, 
  BarChart3, 
  BookOpen,
  User,
  Flame,
  Target,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  Brain,
  TrendingUp,
  BookMarked,
} from 'lucide-react';
import { recordStore, calculateStats } from '@/lib/quiz-store';
import { Category, QuestionBank } from '@/lib/types';
import { BankCard } from '@/components/BankCard';
import { AuthModal } from '@/components/AuthModal';
import { getCurrentUser as getStoredUser } from '@/components/AuthModal';
import { useDeviceValidation } from '@/hooks/use-device-validation';
import { DeviceKickedDialog } from '@/components/DeviceKickedDialog';
import { calculateStreakStats } from '@/lib/stats-utils';
import StatsView from '@/components/StatsView';
import dynamic from 'next/dynamic';

const StatsViewLazy = dynamic(() => import('@/components/StatsView'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center py-20 text-sm text-slate-400">加载中...</div>,
});

interface User {
  id: string;
  phone: string;
  nickname?: string;
  role: string;
  activatedCategories?: string[];
}

export default function QuizApp() {
  const router = useRouter();
  
  // 页面 Tab 状态
  const [activeTab, setActiveTab] = useState('home');
  
  // 题库数据状态
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 用户状态
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  
  // 统计数据状态
  const [wrongCount, setWrongCount] = useState(0);
  const [homeStats, setHomeStats] = useState({
    correctCount: 0,
    wrongCount: 0,
    accuracy: 0,
    totalCount: 0,
  });
  
  // 客户端挂载状态
  const [mounted, setMounted] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  // 设备验证
  const { kicked, kickMessage, clearKickState } = useDeviceValidation({
    interval: 30000,
    validateOnFocus: true,
  });

  // 处理被踢下线
  const handleKicked = useCallback(() => {
    setCurrentUser(null);
    clearKickState();
    window.location.reload();
  }, [clearKickState]);

  // 加载用户信息
  const loadUserInfo = useCallback(() => {
    const user = getStoredUser();
    if (user) {
      setCurrentUser({
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        role: user.role,
        activatedCategories: user.activated_categories || [],
      });
    } else {
      setCurrentUser(null);
    }
  }, []);

  // 刷新统计数据
  const refreshHomeStats = useCallback(() => {
    const stats = calculateStats();
    setHomeStats({
      correctCount: stats.correctCount,
      wrongCount: stats.wrongCount,
      accuracy: stats.accuracy,
      totalCount: stats.correctCount + stats.wrongCount,
    });
  }, []);

  // 加载题库和分类数据
  const loadBanksAndCategories = useCallback(async () => {
    try {
      const [banksRes, catsRes] = await Promise.all([
        fetch('/api/banks'),
        fetch('/api/categories'),
      ]);
      const banksData = await banksRes.json();
      const catsData = await catsRes.json();
      
      const mappedBanks = (banksData.banks || []).map((bank: any) => ({
        ...bank,
        questionCount: bank.question_count || 0,
        categoryId: bank.category_id,
        createdAt: bank.created_at ? new Date(bank.created_at).getTime() : Date.now(),
      }));
      
      setBanks(mappedBanks);
      setCategories(catsData.categories || []);
    } catch (err) {
      console.error('加载数据失败:', err);
    }
  }, []);

  // 加载数据
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadBanksAndCategories(),
        refreshHomeStats(),
      ]);
      const records = recordStore.getAll();
      const wrongIds = new Set(records.filter(r => !r.isCorrect).map(r => r.questionId));
      setWrongCount(wrongIds.size);
    } finally {
      setIsLoading(false);
    }
  }, [loadBanksAndCategories, refreshHomeStats]);

  // 初始化加载
  useEffect(() => {
    setMounted(true);
    loadUserInfo();
    loadData();
  }, [loadUserInfo, loadData]);

  // 开始练习
  const handleStartPractice = useCallback((bankId: string) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    router.push(`/practice?bank=${bankId}&mode=sequential`);
  }, [currentUser, router]);

  // 计算连续学习天数
  const streakDays = useMemo(() => {
    if (!mounted) return 0;
    const allRecords = recordStore.getAll();
    const streak = calculateStreakStats(allRecords);
    return streak.current;
  }, [mounted]);

  // 登录状态变化
  const handleAuthChange = useCallback(() => {
    loadUserInfo();
  }, [loadUserInfo]);

  // 计算可显示的题库
  const getVisibleBanks = useCallback(() => {
    if (!currentUser) return banks;
    const activatedIds = currentUser.activatedCategories || [];
    return banks.filter(b => !b.categoryId || activatedIds.includes(b.categoryId));
  }, [banks, currentUser]);

  const visibleBanks = getVisibleBanks();

  // 计算可显示的分类
  const getVisibleCategories = useCallback(() => {
    if (!currentUser) return categories;
    const activatedIds = currentUser.activatedCategories || [];
    return categories.filter(c => activatedIds.includes(c.id));
  }, [categories, currentUser]);

  const visibleCategories = getVisibleCategories();

  // 获取用户首字母
  const getUserInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50">
      {/* 顶部导航 - 毛玻璃效果 */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 border-b border-white/20">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">智能刷题</h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-wide">SMART QUIZ</p>
              </div>
            </div>
            
            {/* 右侧操作 */}
            <div className="flex items-center gap-3">
              {currentUser ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500">
                      <AvatarFallback className="text-white text-xs font-semibold">
                        {getUserInitials(currentUser.nickname || currentUser.phone)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:block">
                      <p className="text-sm font-medium text-slate-700">{currentUser.nickname || currentUser.phone}</p>
                      <p className="text-[10px] text-slate-400">{currentUser.activatedCategories?.length || 0} 个已激活分类</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      localStorage.removeItem('user-storage');
                      setCurrentUser(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    退出
                  </Button>
                </div>
              ) : (
                <Button 
                  size="sm" 
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-lg shadow-indigo-500/25 h-9 px-5"
                  onClick={() => setAuthModalOpen(true)}
                >
                  <User className="w-4 h-4 mr-1.5" />
                  <span className="text-sm font-medium">登录</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* 首页 Tab */}
        {activeTab === 'home' && (
          <div className="space-y-8">
            {/* Hero 区域 */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 sm:p-10">
              {/* 背景装饰 */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6bTAtMTBjLTMuMzE0IDAtNi0yLjY4Ni02LTZzMi42ODYtNiA2LTYgNiAyLjY4NiA2IDYtMi42ODYgNi02IDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
              
              <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-full text-white/90 text-xs font-medium mb-4">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI 智能学习助手
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                    开启你的学习之旅
                  </h2>
                  <p className="text-white/80 text-sm sm:text-base max-w-md">
                    智能刷题助手，为你提供高效的练习体验，科学追踪学习进度
                  </p>
                </div>
                
                {/* 学习数据卡片 */}
                <div className="flex gap-3">
                  <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 text-center min-w-[100px]">
                    <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-white/20 rounded-xl">
                      <Flame className="w-5 h-5 text-orange-300" />
                    </div>
                    <p className="text-2xl font-bold text-white">{streakDays}</p>
                    <p className="text-xs text-white/70">连续天数</p>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 text-center min-w-[100px]">
                    <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-white/20 rounded-xl">
                      <Target className="w-5 h-5 text-emerald-300" />
                    </div>
                    <p className="text-2xl font-bold text-white">{mounted ? homeStats.accuracy : 0}%</p>
                    <p className="text-xs text-white/70">正确率</p>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 text-center min-w-[100px]">
                    <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-white/20 rounded-xl">
                      <BookOpen className="w-5 h-5 text-blue-300" />
                    </div>
                    <p className="text-2xl font-bold text-white">{mounted ? homeStats.totalCount : 0}</p>
                    <p className="text-xs text-white/70">已练习</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 快速入口 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveTab('library')}
                className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/25 group-hover:scale-110 transition-transform duration-300">
                    <Library className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800 mb-1">题库浏览</h3>
                  <p className="text-sm text-slate-500">{visibleBanks.length} 个题库可选</p>
                  <div className="mt-4 flex items-center text-indigo-500 text-sm font-medium">
                    开始学习
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/wrongbook')}
                className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-100 hover:shadow-lg hover:border-amber-100 transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-amber-500/25 group-hover:scale-110 transition-transform duration-300">
                    <BookMarked className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800 mb-1">错题本</h3>
                  <p className="text-sm text-slate-500">{mounted ? wrongCount : '-'} 道待复习</p>
                  <div className="mt-4 flex items-center text-amber-500 text-sm font-medium">
                    立即复习
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('stats')}
                className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-100 hover:shadow-lg hover:border-emerald-100 transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/25 group-hover:scale-110 transition-transform duration-300">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800 mb-1">学习统计</h3>
                  <p className="text-sm text-slate-500">查看学习进度</p>
                  <div className="mt-4 flex items-center text-emerald-500 text-sm font-medium">
                    查看详情
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>
            </div>

            {/* Tab 切换按钮 */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setActiveTab('library')}
                className="px-5 py-2.5 rounded-full text-sm font-medium bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 transition-all"
              >
                题库浏览
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className="px-5 py-2.5 rounded-full text-sm font-medium bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 transition-all"
              >
                学习统计
              </button>
            </div>
          </div>
        )}

        {/* 题库浏览 Tab */}
        {activeTab === 'library' && (
          <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">题库浏览</h2>
                <p className="text-sm text-slate-500 mt-1">选择分类开始练习</p>
              </div>
              <button
                onClick={() => setActiveTab('home')}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                返回首页
              </button>
            </div>

            {/* 未登录提示 */}
            {!currentUser && (
              <Card className="border border-blue-200/50 bg-blue-50/50 backdrop-blur-sm rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-slate-800">登录后解锁更多题库</h4>
                      <p className="text-xs text-slate-500 mt-0.5">登录后可查看全部题库并开始练习</p>
                    </div>
                    <Button 
                      size="sm" 
                      className="rounded-xl bg-blue-500 hover:bg-blue-600"
                      onClick={() => setAuthModalOpen(true)}
                    >
                      登录
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 已登录但无激活分类 */}
            {currentUser && (currentUser.activatedCategories?.length === 0) && (
              <Card className="border border-orange-200/50 bg-orange-50/50 backdrop-blur-sm rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-slate-800">暂无激活的题库分类</h4>
                      <p className="text-xs text-slate-500 mt-0.5">请联系管理员获取激活码来解锁题库</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 题库列表 */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-slate-400">加载中...</span>
                </div>
              </div>
            ) : visibleBanks.length === 0 ? (
              <Card className="border border-slate-200/50 bg-white/50 backdrop-blur-sm rounded-2xl">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <Library className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">暂无题库</p>
                  <p className="text-xs text-slate-400 mt-1">请联系管理员导入</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleBanks.slice(0, 6).map((bank) => (
                  <BankCard 
                    key={bank.id} 
                    bank={bank} 
                    onStartPractice={handleStartPractice}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 统计 Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">学习统计</h2>
                <p className="text-sm text-slate-500 mt-1">追踪你的学习进度</p>
              </div>
              <button
                onClick={() => setActiveTab('home')}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                返回首页
              </button>
            </div>
            <StatsViewLazy mounted={mounted} wrongCount={wrongCount} />
          </div>
        )}
      </main>

      {/* 登录弹窗 */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onAuthChange={handleAuthChange}
      />

      {/* 设备被踢下线提示 */}
      <DeviceKickedDialog
        open={kicked}
        message={kickMessage}
        onConfirm={handleKicked}
      />
    </div>
  );
}
