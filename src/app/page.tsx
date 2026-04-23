'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { 
  Library, 
  BarChart3, 
  ChevronRight,
  Check,
  Trophy,
  Target,
  BookOpen,
  Star,
  RefreshCw,
  Folder,
  FolderOpen,
  User,
  Flame,
  History,
} from 'lucide-react';
import { BANK_COLORS } from '@/config';
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
        fetch('/api/admin/banks'),
        fetch('/api/admin/categories'),
      ]);
      const banksData = await banksRes.json();
      const catsData = await catsRes.json();
      setBanks(banksData.banks || []);
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

  // 获取用户激活的分类ID列表
  const getActivatedCategoryIds = useCallback(() => {
    if (!currentUser) return [];
    return currentUser.activatedCategories || [];
  }, [currentUser]);

  // 开始练习
  const handleStartPractice = useCallback((bankId: string) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    router.push(`/practice?bank=${bankId}&mode=sequential`);
  }, [currentUser, router]);

  // 计算连续学习天数
  const streakDays = (() => {
    if (!mounted) return 0;
    const allRecords = recordStore.getAll();
    const streak = calculateStreakStats(allRecords);
    return streak.current;
  })();

  // 登录状态变化
  const handleAuthChange = useCallback(() => {
    loadUserInfo();
  }, [loadUserInfo]);

  // 计算可显示的题库（未登录用户可以看到所有题库，登录用户只能看到激活的分类）
  const getVisibleBanks = useCallback(() => {
    if (!currentUser) {
      // 未登录：显示所有题库
      return banks;
    }
    const activatedIds = currentUser.activatedCategories || [];
    // 登录用户：显示激活分类的题库 + 未分类题库
    return banks.filter(b => !b.categoryId || activatedIds.includes(b.categoryId));
  }, [banks, currentUser]);

  const visibleBanks = getVisibleBanks();

  // 计算可显示的分类
  const getVisibleCategories = useCallback(() => {
    if (!currentUser) {
      // 未登录：显示所有分类
      return categories;
    }
    const activatedIds = currentUser.activatedCategories || [];
    // 登录用户：只显示激活的分类
    return categories.filter(c => activatedIds.includes(c.id));
  }, [categories, currentUser]);

  const visibleCategories = getVisibleCategories();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[970px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-sm">
                <Library className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-800">智能刷题</h1>
                <p className="text-xs text-slate-400">{banks.reduce((sum, b) => sum + (b.questionIds?.length || 0), 0)} 题</p>
              </div>
            </div>
            
            {/* 右侧操作 */}
            <div className="flex items-center gap-2">
              {currentUser ? (
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-700">{currentUser.nickname || currentUser.phone}</p>
                    <p className="text-xs text-slate-400">已激活 {currentUser.activatedCategories?.length || 0} 个分类</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      localStorage.removeItem('user-storage');
                      setCurrentUser(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 h-8"
                  >
                    退出
                  </Button>
                </div>
              ) : (
                <Button 
                  size="sm" 
                  className="rounded-lg bg-indigo-500 hover:bg-indigo-600 h-9"
                  onClick={() => setAuthModalOpen(true)}
                >
                  <User className="w-4 h-4 mr-1" />
                  <span className="text-sm">登录</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tab 切换 */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[970px] mx-auto px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('home')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'home'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <BookOpen className="w-4 h-4 inline mr-1" />
                首页
              </button>
              <button
                onClick={() => setActiveTab('library')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'library'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Library className="w-4 h-4 inline mr-1" />
                题库浏览
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'stats'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <BarChart3 className="w-4 h-4 inline mr-1" />
                统计
              </button>
            </div>
          </Tabs>
        </div>
      </div>

      {/* 主内容区 */}
      <main className="max-w-[970px] mx-auto px-4 py-4">
        {/* 首页 Tab */}
        {activeTab === 'home' && (
          <>
            {/* 欢迎卡片 */}
            {mounted && (
              <Card className={`border-0 shadow-sm rounded-xl overflow-hidden mb-4 ${streakDays > 0 ? 'bg-gradient-to-r from-orange-500 to-amber-500' : 'bg-white'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${streakDays > 0 ? 'bg-white/20' : 'bg-slate-100'}`}>
                        <Flame className={`w-6 h-6 ${streakDays > 0 ? 'text-white' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <div className={`text-2xl font-bold ${streakDays > 0 ? 'text-white' : 'text-slate-700'}`}>
                          {streakDays}
                        </div>
                        <div className={`text-sm ${streakDays > 0 ? 'text-orange-100' : 'text-slate-400'}`}>
                          连续学习天数
                        </div>
                      </div>
                    </div>
                    {streakDays > 0 && (
                      <span className="px-3 py-1 bg-white/20 rounded-full text-white text-xs font-medium">
                        继续保持
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 统计卡片 */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                <p className="text-xl font-bold text-slate-700">{mounted ? wrongCount : '-'}</p>
                <p className="text-xs text-slate-500">错题</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                <p className="text-xl font-bold text-emerald-600">{mounted ? homeStats.correctCount : '-'}</p>
                <p className="text-xs text-slate-500">已掌握</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                <p className="text-xl font-bold text-indigo-600">{mounted ? homeStats.accuracy : 0}%</p>
                <p className="text-xs text-slate-500">正确率</p>
              </div>
            </div>

            {/* 错题本入口 */}
            <Link href="/wrongbook">
              <Card className="border-0 shadow-sm rounded-xl bg-white hover:shadow-md transition-shadow mb-4 cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">错题本</p>
                      <p className="text-xs text-slate-500">{mounted ? wrongCount : '-'} 道待复习</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* 快速入口 */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveTab('library')}
                className="bg-white rounded-xl p-4 border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all text-left"
              >
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-2">
                  <Library className="w-5 h-5 text-indigo-600" />
                </div>
                <p className="text-sm font-semibold text-slate-700">题库浏览</p>
                <p className="text-xs text-slate-400 mt-0.5">{visibleBanks.length} 个题库</p>
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className="bg-white rounded-xl p-4 border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all text-left"
              >
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-2">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-slate-700">学习统计</p>
                <p className="text-xs text-slate-400 mt-0.5">查看学习进度</p>
              </button>
            </div>
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
                      <FolderOpen className="w-4 h-4 text-slate-400" />
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
                                    <Folder className="w-4 h-4 text-slate-400" />
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
                                          {selectedCategoryId === category.id ? (
                                            <FolderOpen className="w-4 h-4 text-slate-500" />
                                          ) : (
                                            <Folder className="w-4 h-4 text-slate-400" />
                                          )}
                                          <span className="text-sm font-medium text-slate-700 flex-1">
                                            {category.name}
                                          </span>
                                          <span className="text-xs text-slate-400">
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
                              <div key={category.id} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm mb-4">
                                <div 
                                  className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50/80 p-2 -m-2 rounded-xl transition-all duration-200"
                                  onClick={() => setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)}
                                >
                                  {selectedCategoryId === category.id ? (
                                    <FolderOpen className="w-4 h-4 text-slate-500" />
                                  ) : (
                                    <Folder className="w-4 h-4 text-slate-400" />
                                  )}
                                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg tracking-wide ${getCategoryColor(category.color)}`}>
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
                                            <FolderOpen className="w-3 h-3 text-gray-500" />
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

            {/* 底部安全间距 */}
            <div className="h-8" />
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
