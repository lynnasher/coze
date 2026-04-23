'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Library, 
  BarChart3, 
  BookOpen,
  User,
  Flame,
  Target,
  CheckCircle,
  XCircle,
  ChevronRight,
  RefreshCw,
  Folder,
  FolderOpen,
  BookMarked,
  LogOut,
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

type TabType = 'home' | 'library' | 'stats' | 'user';

export default function QuizApp() {
  const router = useRouter();
  
  // 页面 Tab 状态
  const [activeTab, setActiveTab] = useState<TabType>('home');
  
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

  // 登出
  const handleLogout = useCallback(() => {
    localStorage.removeItem('user-storage');
    setCurrentUser(null);
    setActiveTab('home');
  }, []);

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

  // 分类颜色映射
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
      {/* 顶部导航 */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center h-14">
            {/* Logo */}
            <div className="flex items-center gap-2 mr-8">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                <Library className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-semibold text-slate-800">智能刷题</span>
            </div>
            
            {/* 功能导航 */}
            <nav className="flex items-center gap-1 flex-1">
              <button
                onClick={() => setActiveTab('home')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'home'
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                首页
              </button>
              <button
                onClick={() => setActiveTab('library')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'library'
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                题库浏览
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'stats'
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                学习统计
              </button>
              <button
                onClick={() => setActiveTab('user')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'user'
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                用户中心
              </button>
            </nav>
            
            {/* 用户区域 */}
            <div className="flex items-center gap-3">
              {currentUser ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">
                    {currentUser.nickname || currentUser.phone}
                  </span>
                  <button 
                    onClick={handleLogout}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="退出登录"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Button 
                  size="sm" 
                  className="h-8 bg-indigo-500 hover:bg-indigo-600 rounded-lg"
                  onClick={() => setAuthModalOpen(true)}
                >
                  <User className="w-4 h-4 mr-1" />
                  登录
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 首页 */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* 学习概览 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Flame className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-800">{streakDays}</p>
                      <p className="text-xs text-slate-500">连续天数</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-800">{mounted ? homeStats.correctCount : '-'}</p>
                      <p className="text-xs text-slate-500">正确</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-800">{mounted ? homeStats.wrongCount : '-'}</p>
                      <p className="text-xs text-slate-500">错误</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <Target className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-800">{mounted ? homeStats.accuracy : 0}%</p>
                      <p className="text-xs text-slate-500">正确率</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 快捷入口 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveTab('library')}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all"
              >
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <Library className="w-6 h-6 text-indigo-500" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-800">题库浏览</p>
                  <p className="text-xs text-slate-500">{visibleBanks.length} 个题库</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 ml-auto" />
              </button>

              <Link href="/wrongbook" className="block">
                <button className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-amber-200 hover:shadow-sm transition-all">
                  <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                    <BookMarked className="w-6 h-6 text-amber-500" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-slate-800">错题本</p>
                    <p className="text-xs text-slate-500">{mounted ? wrongCount : '-'} 道待复习</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                </button>
              </Link>

              <button
                onClick={() => setActiveTab('stats')}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-200 hover:shadow-sm transition-all"
              >
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-emerald-500" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-800">学习统计</p>
                  <p className="text-xs text-slate-500">查看详情</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 ml-auto" />
              </button>
            </div>

            {/* 题库预览 */}
            {visibleBanks.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-slate-800">推荐题库</h2>
                  <button 
                    onClick={() => setActiveTab('library')}
                    className="text-sm text-indigo-500 hover:text-indigo-600"
                  >
                    查看全部
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {visibleBanks.slice(0, 4).map((bank) => (
                    <BankCard 
                      key={bank.id} 
                      bank={bank} 
                      onStartPractice={handleStartPractice}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 题库浏览 */}
        {activeTab === 'library' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">题库浏览</h2>
              <button 
                onClick={loadData}
                disabled={isLoading}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* 未登录提示 */}
            {!currentUser && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-slate-800">登录后解锁更多题库</h4>
                      <p className="text-xs text-slate-500">登录后可查看全部题库并开始练习</p>
                    </div>
                    <Button 
                      size="sm" 
                      className="bg-blue-500 hover:bg-blue-600 rounded-lg"
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
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-slate-800">暂无激活的题库分类</h4>
                      <p className="text-xs text-slate-500">请联系管理员获取激活码来解锁题库</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 题库列表 */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : visibleBanks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <Library className="w-7 h-7 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-500">暂无题库</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* 未分类题库 */}
                {visibleBanks.filter(b => !b.categoryId).length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FolderOpen className="w-4 h-4 text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-700">未分类</h3>
                      <span className="text-xs text-slate-400 ml-auto">({visibleBanks.filter(b => !b.categoryId).length})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {visibleBanks.filter(b => !b.categoryId).map((bank) => (
                        <BankCard key={bank.id} bank={bank} onStartPractice={handleStartPractice} />
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
                                  <div className="flex items-center gap-2 mb-3">
                                    <Folder className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm font-semibold text-slate-700">{parentCategory.name}</span>
                                  </div>
                                )}
                                <div className="space-y-2">
                                  {children.map(category => {
                                    const categoryBanks = visibleBanks.filter(b => b.categoryId === category.id);
                                    if (categoryBanks.length === 0) return null;
                                    
                                    return (
                                      <div key={category.id} className="bg-white rounded-xl border border-slate-200 p-3">
                                        <div 
                                          className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 -m-2 rounded-lg"
                                          onClick={() => setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)}
                                        >
                                          {selectedCategoryId === category.id ? <FolderOpen className="w-4 h-4 text-slate-500" /> : <Folder className="w-4 h-4 text-slate-400" />}
                                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${getCategoryColor(category.color)}`}>{category.name}</span>
                                          <span className="text-xs text-slate-400 ml-auto">{categoryBanks.length} 题库</span>
                                          <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${selectedCategoryId === category.id ? 'rotate-90' : ''}`} />
                                        </div>
                                      
                                        {selectedCategoryId === category.id && (
                                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {categoryBanks.map(bank => (
                                              <BankCard key={bank.id} bank={bank} onStartPractice={handleStartPractice} />
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
                              <div key={category.id} className="bg-white rounded-xl border border-slate-200 p-4">
                                <div 
                                  className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 -m-2 rounded-lg"
                                  onClick={() => setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)}
                                >
                                  {selectedCategoryId === category.id ? <FolderOpen className="w-4 h-4 text-slate-500" /> : <Folder className="w-4 h-4 text-slate-400" />}
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${getCategoryColor(category.color)}`}>{category.name}</span>
                                  <span className="text-xs text-slate-400 ml-auto">{categoryBanks.length + childCategoryBanks.length} 题库</span>
                                  <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${selectedCategoryId === category.id ? 'rotate-90' : ''}`} />
                                </div>
                              
                                {selectedCategoryId === category.id && (
                                  <div className="mt-3 space-y-3">
                                    {categoryBanks.length > 0 && (
                                      <div>
                                        <div className="flex items-center gap-1.5 mb-2">
                                          <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                          <span className="text-xs text-slate-400">直接题库</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {categoryBanks.map((bank) => (
                                            <BankCard key={bank.id} bank={bank} onStartPractice={handleStartPractice} />
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
                                            <FolderOpen className="w-3 h-3 text-slate-500" />
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${getCategoryColor(child.color)}`}>{child.name}</span>
                                            <span className="text-xs text-slate-400">({childBanks.length})</span>
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {childBanks.map((bank) => (
                                              <BankCard key={bank.id} bank={bank} onStartPractice={handleStartPractice} />
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
          </div>
        )}

        {/* 学习统计 */}
        {activeTab === 'stats' && (
          <StatsViewLazy mounted={mounted} wrongCount={wrongCount} />
        )}

        {/* 用户中心 */}
        {activeTab === 'user' && (
          <div className="space-y-6">
            {currentUser ? (
              <>
                {/* 用户信息卡片 */}
                <Card className="border-0 shadow-sm rounded-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                        <User className="w-8 h-8 text-indigo-500" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-800">
                          {currentUser.nickname || currentUser.phone}
                        </h2>
                        <p className="text-sm text-slate-500">{currentUser.phone}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          已激活 {currentUser.activatedCategories?.length || 0} 个分类
                        </p>
                      </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-slate-100">
                      <Button 
                        variant="outline" 
                        className="w-full text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                        onClick={handleLogout}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        退出登录
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 学习数据 */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">学习数据</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="border-0 shadow-sm">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-emerald-600">{mounted ? homeStats.correctCount : '-'}</p>
                        <p className="text-xs text-slate-500 mt-1">正确</p>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-red-600">{mounted ? homeStats.wrongCount : '-'}</p>
                        <p className="text-xs text-slate-500 mt-1">错误</p>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-indigo-600">{mounted ? homeStats.accuracy : 0}%</p>
                        <p className="text-xs text-slate-500 mt-1">正确率</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* 功能入口 */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">功能入口</h3>
                  <div className="space-y-2">
                    <button 
                      onClick={() => setActiveTab('library')}
                      className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:bg-slate-50"
                    >
                      <Library className="w-5 h-5 text-indigo-500" />
                      <span className="text-sm text-slate-700">题库浏览</span>
                      <ChevronRight className="w-5 h-5 text-slate-300 ml-auto" />
                    </button>
                    <Link href="/wrongbook" className="block">
                      <button className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:bg-slate-50">
                        <BookMarked className="w-5 h-5 text-amber-500" />
                        <span className="text-sm text-slate-700">错题本</span>
                        <span className="text-xs text-slate-400 ml-2">({mounted ? wrongCount : '-'})</span>
                        <ChevronRight className="w-5 h-5 text-slate-300 ml-auto" />
                      </button>
                    </Link>
                    <button 
                      onClick={() => setActiveTab('stats')}
                      className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:bg-slate-50"
                    >
                      <BarChart3 className="w-5 h-5 text-emerald-500" />
                      <span className="text-sm text-slate-700">学习统计</span>
                      <ChevronRight className="w-5 h-5 text-slate-300 ml-auto" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <Card className="border-0 shadow-sm rounded-xl">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-slate-300" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-800 mb-2">未登录</h2>
                  <p className="text-sm text-slate-500 mb-6">登录后解锁更多功能</p>
                  <Button 
                    className="bg-indigo-500 hover:bg-indigo-600"
                    onClick={() => setAuthModalOpen(true)}
                  >
                    <User className="w-4 h-4 mr-2" />
                    登录 / 注册
                  </Button>
                </CardContent>
              </Card>
            )}
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
