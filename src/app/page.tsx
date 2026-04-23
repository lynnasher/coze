'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Library, 
  BarChart3, 
  ChevronRight,
  Check,
  Trophy,
  BookOpen,
  User,
  Flame,
  Home,
} from 'lucide-react';
import { recordStore, calculateStats } from '@/lib/quiz-store';
import { Category, QuestionBank } from '@/lib/types';
import { BankCard } from '@/components/BankCard';
import { AuthModal } from '@/components/AuthModal';
import { getCurrentUser as getStoredUser } from '@/components/AuthModal';
import { useDeviceValidation } from '@/hooks/use-device-validation';
import { DeviceKickedDialog } from '@/components/DeviceKickedDialog';
import { calculateStreakStats } from '@/lib/stats-utils';
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

  // 加载题库和分类数据（使用公开接口）
  const loadBanksAndCategories = useCallback(async () => {
    try {
      const [banksRes, catsRes] = await Promise.all([
        fetch('/api/banks'),
        fetch('/api/categories'),
      ]);
      const banksData = await banksRes.json();
      const catsData = await catsRes.json();
      
      // 字段映射：API 返回的是 question_count，转为组件期望的 questionCount
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

  // 计算可显示的题库
  const getVisibleBanks = useCallback(() => {
    if (!currentUser) {
      return banks;
    }
    const activatedIds = currentUser.activatedCategories || [];
    return banks.filter(b => !b.categoryId || activatedIds.includes(b.categoryId));
  }, [banks, currentUser]);

  const visibleBanks = getVisibleBanks();

  // 计算可显示的分类
  const getVisibleCategories = useCallback(() => {
    if (!currentUser) {
      return categories;
    }
    const activatedIds = currentUser.activatedCategories || [];
    return categories.filter(c => activatedIds.includes(c.id));
  }, [categories, currentUser]);

  const visibleCategories = getVisibleCategories();

  // 计算连续学习天数
  const streak = (() => {
    if (!mounted) return { current: 0, longest: 0, weekly: 0, goal: 7 };
    const allRecords = recordStore.getAll();
    return calculateStreakStats(allRecords);
  })();

  // 登录状态变化
  const handleAuthChange = useCallback(() => {
    loadUserInfo();
  }, [loadUserInfo]);

  // 开始练习
  const handleStartPractice = useCallback((bankId: string) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    router.push(`/practice?bank=${bankId}&mode=sequential`);
  }, [currentUser, router]);

  // 获取分类颜色样式
  const getCategoryColor = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-700',
      green: 'bg-green-100 text-green-700',
      red: 'bg-red-100 text-red-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      purple: 'bg-purple-100 text-purple-700',
      pink: 'bg-pink-100 text-pink-700',
      indigo: 'bg-indigo-100 text-indigo-700',
      cyan: 'bg-cyan-100 text-cyan-700',
    };
    return colorMap[color] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部 Tab 导航 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[970px] mx-auto">
          <div className="flex">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'home'
                  ? 'text-slate-800 bg-white'
                  : 'text-slate-400 bg-slate-50 hover:text-slate-600'
              }`}
            >
              <Home className="w-4 h-4" />
              首页
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'library'
                  ? 'text-slate-800 bg-white'
                  : 'text-slate-400 bg-slate-50 hover:text-slate-600'
              }`}
            >
              <Library className="w-4 h-4" />
              题库
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'stats'
                  ? 'text-slate-800 bg-white'
                  : 'text-slate-400 bg-slate-50 hover:text-slate-600'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              统计
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-[970px] mx-auto px-4 py-4">
        {/* 首页 Tab */}
        {activeTab === 'home' && (
          <>
            {/* 顶部横幅 */}
            <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-5 mb-5 text-white relative overflow-hidden shadow-lg">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full"></div>
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full"></div>
              <div className="relative flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center shadow-sm">
                  <span className="text-3xl">📚</span>
                </div>
                <div className="flex-1">
                  <h1 className="text-xl font-bold mb-1">智能刷题助手</h1>
                  <p className="text-white/80 text-sm">高效备考，轻松掌握</p>
                </div>
                <div className="text-4xl">🤔</div>
              </div>
            </div>

            {/* 学习数据模块 */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-semibold text-slate-700">学习数据</h2>
              </div>

              {/* 连续学习卡片 */}
              <Card className={`border-0 rounded-2xl overflow-hidden shadow-sm mb-3 ${streak.current > 0 ? 'bg-gradient-to-r from-orange-500 to-amber-500' : 'bg-slate-100'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${streak.current > 0 ? 'bg-white/20' : 'bg-slate-200'}`}>
                        <Flame className={`w-7 h-7 ${streak.current > 0 ? 'text-white' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <div className={`text-3xl font-bold ${streak.current > 0 ? 'text-white' : 'text-slate-700'}`}>
                          {mounted ? streak.current : '-'}
                        </div>
                        <div className={`text-sm ${streak.current > 0 ? 'text-orange-100' : 'text-slate-400'}`}>
                          连续学习天数
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${streak.current > 0 ? 'text-white' : 'text-slate-500'}`}>
                        最长 {mounted ? streak.longest : 0} 天
                      </div>
                    </div>
                  </div>
                  
                  {/* 本周进度 */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs ${streak.current > 0 ? 'text-orange-100' : 'text-slate-400'}`}>
                        本周 {mounted ? streak.weekly : 0}/{streak.goal} 天
                      </span>
                      <span className={`text-xs font-medium ${streak.current > 0 ? 'text-white' : 'text-slate-500'}`}>
                        {streak.goal > 0 ? Math.round((streak.weekly / streak.goal) * 100) : 0}%
                      </span>
                    </div>
                    <div className={`h-2 rounded-full ${streak.current > 0 ? 'bg-white/20' : 'bg-slate-200'}`}>
                      <div 
                        className={`h-full rounded-full transition-all ${streak.current > 0 ? 'bg-white' : 'bg-slate-400'}`}
                        style={{ width: `${Math.min((streak.weekly / streak.goal) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 统计卡片组 */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-xl p-3 text-center border border-slate-100 shadow-sm">
                  <p className="text-xl font-bold text-slate-700">{mounted ? wrongCount : '-'}</p>
                  <p className="text-xs text-slate-500 mt-1">错题</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center border border-slate-100 shadow-sm">
                  <p className="text-xl font-bold text-emerald-600">{mounted ? homeStats.correctCount : '-'}</p>
                  <p className="text-xs text-slate-500 mt-1">已掌握</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center border border-slate-100 shadow-sm">
                  <p className="text-xl font-bold text-indigo-600">{mounted ? homeStats.accuracy : 0}%</p>
                  <p className="text-xs text-slate-500 mt-1">正确率</p>
                </div>
              </div>
            </div>

            {/* 错题本入口 */}
            <Link href="/wrongbook">
              <Card className="border-0 shadow-sm rounded-xl bg-white hover:shadow-md transition-shadow mb-4 cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">错题本</p>
                      <p className="text-xs text-slate-400">{mounted ? wrongCount : '-'} 道待复习</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* 登录引导 */}
            {!currentUser && (
              <Card className="border-0 shadow-sm rounded-xl bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => setAuthModalOpen(true)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center">
                      <User className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">登录解锁全部功能</p>
                      <p className="text-xs text-slate-400">查看激活题库、记录学习进度</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 已登录用户信息 */}
            {currentUser && (
              <Card className="border-0 shadow-sm rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 text-white">
                    <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{currentUser.nickname || currentUser.phone}</p>
                      <p className="text-xs text-white/80">已激活 {currentUser.activatedCategories?.length || 0} 个分类</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        localStorage.removeItem('user-storage');
                        setCurrentUser(null);
                      }}
                      className="text-white/80 hover:text-white hover:bg-white/20 h-8"
                    >
                      退出
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* 题库浏览 Tab */}
        {activeTab === 'library' && (
          <>
            {/* 页面标题 */}
            <div className="bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 rounded-2xl p-4 shadow-sm mb-5 relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/30 rounded-full"></div>
              <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/30 rounded-full"></div>
              <div className="relative flex items-center gap-3">
                <div className="w-10 h-10 bg-white/60 backdrop-blur rounded-xl flex items-center justify-center shadow-sm">
                  <Library className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h1 className="text-lg font-semibold text-slate-700 tracking-tight">题库浏览</h1>
                  <p className="text-slate-500 text-xs mt-0.5">选择分类开始练习</p>
                </div>
                <div className="px-2.5 py-1 bg-white/50 backdrop-blur rounded-full">
                  <span className="text-slate-600 text-xs font-medium">
                    {visibleBanks.length} 题库
                  </span>
                </div>
              </div>
            </div>

            {/* 未登录提示 */}
            {!currentUser && (
              <Card className="border border-blue-200 bg-blue-50 rounded-xl mb-5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900">登录后解锁更多题库</h4>
                      <p className="text-xs text-gray-600 mt-0.5">登录后可查看全部题库并开始练习</p>
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

            {/* 已登录但无激活分类 */}
            {currentUser && (currentUser.activatedCategories?.length === 0) && (
              <Card className="border border-orange-200 bg-orange-50 rounded-xl mb-5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900">暂无激活的题库分类</h4>
                      <p className="text-xs text-gray-600 mt-0.5">请联系管理员获取激活码来解锁题库</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 题库列表 */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-slate-400">加载中...</span>
                </div>
              </div>
            ) : visibleBanks.length === 0 ? (
              <Card className="border border-gray-100 bg-white rounded-xl">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 mx-auto mb-3 bg-gray-50 rounded-2xl flex items-center justify-center">
                    <Library className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">暂无题库</p>
                  <p className="text-xs text-gray-400 mt-1">请联系管理员导入</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {/* 未分类题库 */}
                {visibleBanks.filter(b => !b.categoryId).length > 0 && (
                  <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                      <div className="w-5 h-5 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Library className="w-3 h-3 text-slate-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-700">未分类</h3>
                      <span className="text-xs text-slate-400 ml-auto">({visibleBanks.filter(b => !b.categoryId).length} 题库)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {visibleBanks.filter(b => !b.categoryId).map((bank) => (
                        <BankCard 
                          key={bank.id} 
                          bank={bank} 
                          onStartPractice={handleStartPractice}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 分类题库 */}
                {visibleCategories.length > 0 && (
                  <>
                    {(() => {
                      const topCategories = visibleCategories.filter(c => !c.parentId);
                      const childCategories = visibleCategories.filter(c => c.parentId);
                      
                      const childCategoriesByParent = new Map<string, typeof childCategories>();
                      childCategories.forEach(cat => {
                        const parentId = cat.parentId!;
                        if (!childCategoriesByParent.has(parentId)) {
                          childCategoriesByParent.set(parentId, []);
                        }
                        childCategoriesByParent.get(parentId)!.push(cat);
                      });
                      
                      return (
                        <>
                          {/* 子分类 */}
                          {Array.from(childCategoriesByParent.entries()).map(([parentId, children]) => {
                            const parentCategory = categories.find(c => c.id === parentId);
                            return (
                              <div key={`parent-${parentId}`} className="mb-4">
                                {parentCategory && (
                                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                                    <div className="w-5 h-5 bg-slate-100 rounded-lg flex items-center justify-center">
                                      <Library className="w-3 h-3 text-slate-400" />
                                    </div>
                                    <span className="text-sm font-semibold text-slate-700">
                                      {parentCategory.name}
                                    </span>
                                  </div>
                                )}
                                <div className="space-y-2">
                                  {children.map(category => {
                                    const categoryBanks = visibleBanks.filter(b => b.categoryId === category.id);
                                    if (categoryBanks.length === 0) return null;
                                    
                                    return (
                                      <div key={category.id} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
                                        <div 
                                          className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-3 -m-2 rounded-xl transition-all duration-200"
                                          onClick={() => setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)}
                                        >
                                          <div className="w-5 h-5 bg-slate-100 rounded-lg flex items-center justify-center">
                                            <Library className={`w-3 h-3 transition-transform ${selectedCategoryId === category.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                                          </div>
                                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${getCategoryColor(category.color)}`}>
                                            {category.name}
                                          </span>
                                          <span className="text-xs text-slate-400 ml-auto">
                                            {categoryBanks.length} 个题库
                                          </span>
                                          <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${selectedCategoryId === category.id ? 'rotate-90' : ''}`} />
                                        </div>
                                      
                                        {selectedCategoryId === category.id && (
                                          <div className="mt-3 space-y-3 pl-2">
                                            {categoryBanks.map(bank => (
                                              <BankCard
                                                key={bank.id}
                                                bank={bank}
                                                onStartPractice={handleStartPractice}
                                              />
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* 顶级分类 */}
                          {topCategories.map(category => {
                            const categoryBanks = visibleBanks.filter(b => b.categoryId === category.id);
                            const activatedChildCategories = childCategoriesByParent.get(category.id) || [];
                            const childCategoryIds = activatedChildCategories.map(c => c.id);
                            const childCategoryBanks = visibleBanks.filter(b => childCategoryIds.includes(b.categoryId || ''));
                            
                            if (categoryBanks.length === 0 && childCategoryBanks.length === 0) return null;
                            
                            return (
                              <div key={category.id} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm mb-4">
                                <div 
                                  className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50/80 p-2 -m-2 rounded-xl transition-all duration-200"
                                  onClick={() => setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)}
                                >
                                  <div className="w-5 h-5 bg-slate-100 rounded-lg flex items-center justify-center">
                                    <Library className={`w-3 h-3 transition-transform ${selectedCategoryId === category.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                                  </div>
                                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${getCategoryColor(category.color)}`}>
                                    {category.name}
                                  </span>
                                  <span className="text-xs text-gray-500 ml-auto pr-1 font-medium">
                                    {categoryBanks.length + childCategoryBanks.length} 个题库
                                  </span>
                                  <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${selectedCategoryId === category.id ? 'rotate-90' : ''}`} />
                                </div>
                              
                                {selectedCategoryId === category.id && (
                                  <div className="mt-3 space-y-3">
                                    {categoryBanks.length > 0 && (
                                      <div>
                                        <div className="flex items-center gap-1.5 mb-2">
                                          <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                          <span className="text-xs text-gray-400 font-medium">直接题库</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {categoryBanks.map((bank) => (
                                            <BankCard 
                                              key={bank.id} 
                                              bank={bank} 
                                              onStartPractice={handleStartPractice}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {activatedChildCategories.map(child => {
                                      const childBanks = visibleBanks.filter(b => b.categoryId === child.id);
                                      if (childBanks.length === 0) return null;
                                      
                                      return (
                                        <div key={child.id}>
                                          <div className="flex items-center gap-2 mb-2">
                                            <div className="w-4 h-4 bg-slate-100 rounded flex items-center justify-center">
                                              <Library className="w-2.5 h-2.5 text-gray-500" />
                                            </div>
                                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${getCategoryColor(child.color)}`}>
                                              {child.name}
                                            </span>
                                            <span className="text-xs text-gray-500 font-medium">({childBanks.length} 题库)</span>
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {childBanks.map((bank) => (
                                              <BankCard 
                                                key={bank.id} 
                                                bank={bank} 
                                                onStartPractice={handleStartPractice}
                                              />
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* 统计 Tab */}
        {activeTab === 'stats' && (
          <StatsViewLazy mounted={mounted} wrongCount={wrongCount} />
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
