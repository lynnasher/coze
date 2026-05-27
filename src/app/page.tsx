'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { 
  Library, 
  BarChart3, 
  ChevronLeft, 
  ChevronRight, 
  Check,
  X,
  Trophy,
  Target,
  BookOpen,
  Star,
  RefreshCw,
  FileText,
  FileCheck,
  Grid3X3,
  ArrowLeft,
  TrendingUp,
  RotateCcw,
  Settings,
  Folder,
  FolderOpen,
  Home,
  User,
  History,
  Flame,
  Calendar,
  Clock
} from 'lucide-react';
import { questionStore, recordStore, bankStore, getWrongQuestionIds, generateId, recentPracticeStore, RecentPractice, cachedFetch, CACHE_TTL, getCacheKey, invalidateCache, cloudSyncService, wrongStreakStore, getCurrentUserId, forceSync, calculateStats, createSafeSync, deletedQuestionStore } from '@/lib/quiz-store';
import { Question, QuestionType, Difficulty, Category } from '@/lib/types';
import { BankCard } from '@/components/BankCard';
import { getCurrentUser as getStoredUser, AuthModal } from '@/components/AuthModal';
import { RichTextWithBreaks } from '@/lib/rich-text';
import { calculateStreakStats, calculateTrendData, calculateFilteredStats, recalculateWrongData as recalculateWrongDataUtil } from '@/lib/stats-utils';
import dynamic from 'next/dynamic';
import { Header, TabNavigation, PracticeTabContent } from '@/components/home';

// 统计页面懒加载（首屏不需要，切换到统计 Tab 时才加载）
const StatsView = dynamic(() => import('@/components/StatsView'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center py-20 text-sm text-slate-400">加载中...</div>,
});

// 题型配置常量
const QUESTION_TYPE_CONFIG = {
  single: { label: '单选题', color: 'bg-indigo-500' },
  multiple: { label: '多选题', color: 'bg-purple-500' },
  'true-false': { label: '判断题', color: 'bg-cyan-500' },
  'fill-blank': { label: '填空题', color: 'bg-teal-500' },
  comprehensive: { label: '综合题', color: 'bg-rose-500' },
} as const;

type QuestionTypeKey = keyof typeof QUESTION_TYPE_CONFIG;

// 从 AuthModal 获取当前用户（直接使用，不再包装）
const getCurrentUser = getStoredUser;

// 淡雅色调
const COLORS = {
  purple: 'from-slate-400 to-slate-500',
  green: 'from-stone-400 to-stone-500',
  blue: 'from-gray-400 to-gray-500',
  orange: 'from-zinc-400 to-zinc-500',
  pink: 'from-neutral-400 to-neutral-500',
  red: 'from-slate-500 to-stone-500',
};

export default function QuizApp() {
  const router = useRouter();
  
  // 跳转到做题页面
  const navigateToQuiz = useCallback((bankId: string) => {
    const params = new URLSearchParams();
    params.set('bankId', bankId);
    params.set('mode', 'sequential');
    router.push(`/quiz?${params.toString()}`);
  }, [router]);
  
  // 跳转到背题页面
  const navigateToRecite = useCallback((bankId: string) => {
    router.push(`/recite/${bankId}`);
  }, [router]);
  

  const [activeTab, setActiveTab] = useState('practice');
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // 从 URL query 参数读取 tab 设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['practice', 'library', 'stats'].includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, []);
  
  // 题库管理状态
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(7200);
  
  // 练习模式状态

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  // 客户端挂载状态（防止 hydration mismatch）
  const [mounted, setMounted] = useState(false);
  
  // 跟踪组件是否已挂载
  const isMountedRef = useRef(true);
  
  // 跟踪是否是登录后的首次同步（避免首次同步时推送旧数据）
  const hasSyncedRef = useRef(false);
  
  // 最近练习记录状态
  const [recentPractices, setRecentPractices] = useState<RecentPractice[]>([]);
  
  // 统计页面日期筛选状态

  const [categories, setCategories] = useState<Category[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    phone: string;
    nickname?: string;
    role: string;
    activatedCategories?: string[];
  } | null>(null);
  
  // 登录弹窗状态
  const [authModalOpen, setAuthModalOpen] = useState(false);
  
  
  const [dbBanks, setDbBanks] = useState<Array<{
    id: string;
    name: string;
    description?: string;
    question_count?: number;
    category_id?: string;
    created_at?: string;
  }>>([]);
  
  // 错题数量状态（优先使用云端同步后的本地数据）
  const [wrongCount, setWrongCount] = useState<number>(0);
  
  // 统计数据状态（直接从 recordStore 计算，避免 useQuiz hook 的缓存问题）
  const [homeStats, setHomeStats] = useState({
    correctCount: 0,
    wrongCount: 0,
    accuracy: 0,
    totalCount: 0,
  });
  
  // 重新计算错题数据（委托给公共模块）
  const recalculateWrongData = useCallback(() => {
    return recalculateWrongDataUtil(
      recordStore.getAll(),
      (records) => recordStore.save(records),
      (streaks) => wrongStreakStore.save(streaks),
      () => getWrongQuestionIds().length
    );
  }, []);
  
  // 刷新首页统计数据（直接从 recordStore 计算，避免 useQuiz hook 的缓存问题）
  const refreshHomeStats = useCallback(() => {
    const stats = calculateStats();
    setHomeStats({
      correctCount: stats.correctCount,
      wrongCount: stats.wrongCount,
      accuracy: stats.accuracy,
      totalCount: stats.correctCount + stats.wrongCount,
    });
  }, []);
  
  // 页面加载时刷新统计数据
  useEffect(() => {
    refreshHomeStats();
  }, [refreshHomeStats]);

  // 从云端同步：使用公共安全同步函数
  const syncWrongCountFromCloud = useCallback(async (skipPush: boolean = false) => {
    const user = getStoredUser();
    if (!user) {
      setWrongCount(0);
      return;
    }
    
    // 检查 token 是否存在（可能被设备验证清除）
    const token = localStorage.getItem('quiz_user_token');
    if (!token) {
      // Token 已被清除，说明设备被踢下线或已登出
      setCurrentUser(null);
      setWrongCount(0);
      return;
    }
    
    try {
      const cloudData = await cloudSyncService.pullData(user.id);
      if (cloudData) {
        // 过滤掉已删除的题目相关数据
        const validRecords = cloudData.records.filter(r => !deletedQuestionStore.isDeleted(r.questionId));
        const validStreaks: Record<string, number> = {};
        Object.entries(cloudData.streaks).forEach(([questionId, streak]) => {
          if (!deletedQuestionStore.isDeleted(questionId)) {
            validStreaks[questionId] = streak;
          }
        });
        
        // 合并本地和云端数据（而不是直接覆盖）
        const localRecords = recordStore.getAll();
        const localStreaks = wrongStreakStore.getAll();
        
        // 合并练习记录（去重，以 ID 为准）
        const recordMap = new Map<string, typeof localRecords[0]>();
        validRecords.forEach(r => recordMap.set(r.id, r));
        localRecords.forEach(r => recordMap.set(r.id, r));
        const mergedRecords = Array.from(recordMap.values());
        
        // 合并 streaks（本地优先）
        const mergedStreaks = {
          ...validStreaks,
          ...localStreaks,
        };
        
        recordStore.save(mergedRecords);
        wrongStreakStore.save(mergedStreaks);
      }

      if (!skipPush) {
        await cloudSyncService.saveRecordsAndStreaks(
          user.id,
          recordStore.getAll(),
          wrongStreakStore.getAll()
        );
      }
    } catch (error) {
      console.error('云端同步失败，使用本地数据:', error);
    }
    
    // 重新计算错题数据并更新显示
    const count = recalculateWrongData();
    setWrongCount(count);
    
    // 刷新首页统计数据
    refreshHomeStats();
  }, [recalculateWrongData, refreshHomeStats]);
  
  // 只使用数据库的题库
  const { banks, bankAccuracies } = useMemo(() => {
    // 计算每个题库的正确率（仅在 dbBanks 变化时重新计算）
    // 使用 Map 替代 filter 循环，提高性能
    const questionBankMap = new Map<string, string>(); // questionId -> bankId
    questionStore.getAll().forEach(q => {
      if (q.bankId) {
        questionBankMap.set(q.id, q.bankId);
      }
    });

    // 使用 Map 构建题目最佳记录
    const questionBestRecord = new Map<string, { timestamp: number; isCorrect: boolean }>();
    recordStore.getAll().forEach(r => {
      const existing = questionBestRecord.get(r.questionId);
      if (!existing || r.timestamp > existing.timestamp) {
        questionBestRecord.set(r.questionId, { timestamp: r.timestamp, isCorrect: r.isCorrect });
      }
    });

    // 预计算每个题库的题目统计数据
    const bankStats = new Map<string, { done: number; correct: number }>();
    questionBestRecord.forEach((record, questionId) => {
      const bankId = questionBankMap.get(questionId);
      if (bankId) {
        const stats = bankStats.get(bankId) || { done: 0, correct: 0 };
        stats.done++;
        if (record.isCorrect) stats.correct++;
        bankStats.set(bankId, stats);
      }
    });

    const accuracies: Record<string, number | undefined> = {};

    const mappedBanks = dbBanks.map(b => {
      // 直接从预计算的 stats 获取正确率
      const stats = bankStats.get(b.id);
      accuracies[b.id] = stats && stats.done > 0
        ? Math.round((stats.correct / stats.done) * 100)
        : undefined;

      return {
        id: b.id,
        name: b.name,
        description: b.description || '',
        questionIds: [],
        questionCount: b.question_count || 0,
        categoryId: b.category_id,
        createdAt: b.created_at ? new Date(b.created_at).getTime() : Date.now(),
      };
    });

    return { banks: mappedBanks, bankAccuracies: accuracies };
  // 只在 dbBanks 或 homeStats 变化时重新计算
  // homeStats 包含答题记录变化的信号
  }, [dbBanks, homeStats.totalCount]);

  // 刷新用户激活的分类（检查过期时间）
  const refreshActivatedCategories = useCallback(async (userId: string): Promise<string[]> => {
    try {
      const token = localStorage.getItem('quiz_user_token');
      const response = await fetch('/api/auth/user/activations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const activatedCategories = data.activatedCategories || [];
        setCurrentUser(prev => prev ? { ...prev, activatedCategories } : null);
        const storedUser = localStorage.getItem('quiz_user_data');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            userData.activatedCategories = activatedCategories;
            localStorage.setItem('quiz_user_data', JSON.stringify(userData));
          } catch {
            // 忽略解析错误
          }
        }
        return activatedCategories;
      }
    } catch {
      // 忽略错误
    }
    return [];
  }, []);

  // 统一的初始数据加载函数（使用缓存减少重复请求）
  const loadAllData = useCallback(async () => {
    // 加载本地数据（从 localStorage 立即获取，不阻塞）
    setQuestions(questionStore.getAll());
    setRecentPractices(recentPracticeStore.getRecent(3));

    // 获取当前用户
    const user = getCurrentUser();
    setCurrentUser(user);

    // 并行加载分类和题库（减少串行等待时间）
    const [categoriesResult, banksResult] = await Promise.all([
      // 使用缓存加载分类
      cachedFetch<{ categories: Category[] }>(
        '/api/categories',
        getCacheKey('categories'),
        CACHE_TTL.CATEGORIES
      ),
      // 使用缓存加载题库
      cachedFetch<{ banks: Array<{
        id: string;
        name: string;
        description?: string;
        question_count?: number;
        category_id?: string;
        created_at?: string;
        isActivated?: boolean;
      }> }>(
        '/api/banks',
        getCacheKey('banks'),
        CACHE_TTL.BANKS,
        false // 题库列表公开，不需要认证
      ),
    ]);

    if (categoriesResult.data?.categories) {
      setCategories(categoriesResult.data.categories);
    }

    if (banksResult.data?.banks) {
      setDbBanks(banksResult.data.banks);
    }

    // 如果用户已登录，刷新激活的分类（不阻塞首屏渲染）
    if (user) {
      refreshActivatedCategories(user.id).catch(() => {});
    }
  }, [refreshActivatedCategories]);

  // 初始化加载（只在首次渲染时执行）
  useEffect(() => {
    isMountedRef.current = true;
    loadAllData();
    // 确保组件在客户端挂载
    setMounted(true);
    
    return () => {
      isMountedRef.current = false;
    };
  }, [loadAllData]);

  // 监听 localStorage 变化，以便在用户登录/登出后刷新状态
  useEffect(() => {
    // 处理 storage 事件（跨标签页通信）
    const handleStorageChange = (e: StorageEvent) => {
      // 检查组件是否已挂载
      if (!isMountedRef.current) return;
      if (e.key === 'quiz_user_data' || e.key === 'quiz_user_token') {
        const user = getCurrentUser();
        setCurrentUser(user);
        if (user) {
          refreshActivatedCategories(user.id);
        }
      }
    };

    // 处理用户登录/退出事件（同一标签页内）
    const handleUserAuthChange = () => {
      if (!isMountedRef.current) return;
      const user = getCurrentUser();
      const hadUser = currentUser !== null;
      setCurrentUser(user);
      if (user) {
        // 重新加载所有数据以更新题库显示
        loadAllData();
      } else if (hadUser) {
        // 用户从登录状态退出，刷新页面以清除所有状态
        window.location.reload();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('user-auth-change', handleUserAuthChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('user-auth-change', handleUserAuthChange);
    };
  }, [refreshActivatedCategories, loadAllData]);

  // 当用户登录时从云端同步数据并获取错题数量
  useEffect(() => {
    if (currentUser) {
      // 延迟云端同步，不阻塞首屏渲染
      const syncWithDelay = () => {
        // 首次同步：先推送本地数据到云端（保留未登录时的做题记录），再拉取云端数据合并
        if (!hasSyncedRef.current) {
          hasSyncedRef.current = true;
          // 先推送本地数据到云端（如果有），避免数据丢失
          const localRecords = recordStore.getAll();
          const localStreaks = wrongStreakStore.getAll();
          if (localRecords.length > 0 || Object.keys(localStreaks).length > 0) {
            // 有本地数据，先推送再拉取（合并）
            syncWrongCountFromCloud(false);
          } else {
            // 没有本地数据，直接拉取云端数据
            syncWrongCountFromCloud(true);
          }
        } else {
          syncWrongCountFromCloud(false);
        }
      };

      // 使用 requestIdleCallback 或 setTimeout 延迟执行
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(syncWithDelay, { timeout: 2000 });
      } else {
        setTimeout(syncWithDelay, 500);
      }
    } else {
      // 未登录状态：立即从本地计算错题数（本地计算很快）
      const count = recalculateWrongData();
      setWrongCount(count);
      hasSyncedRef.current = false;
    }
  }, [currentUser, syncWrongCountFromCloud, recalculateWrongData]);

  // 获取用户激活的分类ID列表
  // 规则：未登录用户不能做任何题库，登录用户只能做已激活分类的题库
  const getActivatedCategoryIds = useCallback(() => {
    if (!currentUser) {
      // 未登录用户：不能做任何题库
      return [];
    }
    // 已登录用户：只能做已激活分类的题库
    const activated = currentUser.activatedCategories || [];
    // 已登录用户
    // 如果没有激活任何分类，返回空数组
    return activated;
  }, [currentUser]);

  // 过滤出可用的分类（用于显示）
  const getAvailableCategories = useCallback(() => {
    const activatedIds = getActivatedCategoryIds();
    // 计算可用分类
    const result = categories.filter(c => !c.parentId && activatedIds.includes(c.id));
    return result;
  }, [categories, getActivatedCategoryIds]);


  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部区域 */}
      <Header 
        currentUser={currentUser} 
        onNavigate={(tab) => {
          setActiveTab(tab);
          setSelectedCategoryId(null);
        }} 
      />

      {/* 主内容 */}
      <main className="max-w-[970px] mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          // 切换标签页时重置展开状态
          setSelectedCategoryId(null);
        }} className="space-y-6">
        <TabNavigation 
          activeTab={activeTab} 
          onTabChange={(tab) => {
            setActiveTab(tab);
            setSelectedCategoryId(null);
          }} 
        />

          {/* 练习页面 - 单栏布局 */}
          <TabsContent value="practice">
            <PracticeTabContent 
              mounted={mounted}
              wrongCount={wrongCount}
              homeStats={homeStats}
              currentUser={currentUser}
            />
          </TabsContent>

          {/* 题库浏览页面 */}
          <TabsContent value="library">
            {/* 页面标题区块 */}
            <div className="mb-5 relative overflow-hidden">
              {/* 背景卡片 - 淡雅色调 */}
              <div className="bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 rounded-2xl p-4 shadow-sm">
                {/* 装饰圆形 */}
                <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/30 rounded-full"></div>
                <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/30 rounded-full"></div>
                
                {/* 内容 */}
                <div className="relative flex items-center gap-3">
                  {/* 图标区域 */}
                  <div className="w-10 h-10 bg-white/60 backdrop-blur rounded-xl flex items-center justify-center shadow-sm">
                    <Library className="w-5 h-5 text-slate-600" />
                  </div>
                  
                  {/* 文字区域 */}
                  <div className="flex-1">
                    <h1 className="text-lg font-semibold text-slate-700 tracking-tight">题库浏览</h1>
                    <p className="text-slate-500 text-xs mt-0.5">选择分类开始练习</p>
                  </div>
                  
                  {/* 装饰徽章 */}
                  {currentUser && (
                    <div className="px-2.5 py-1 bg-white/50 backdrop-blur rounded-full">
                      <span className="text-slate-600 text-xs font-medium">
                        {currentUser.activatedCategories?.length || 0} 个分类
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* 未登录提示 */}
            {!currentUser && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-200 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900">登录后查看已激活的题库</h4>
                    <p className="text-xs text-gray-600 mt-0.5">请先登录以查看和练习题库</p>
                  </div>
                  <Button 
                    size="sm" 
                    className="rounded-xl bg-blue-600 hover:bg-blue-700"
                    onClick={() => setAuthModalOpen(true)}
                  >
                    登录
                  </Button>
                </div>
              </div>
            )}
            
            {/* 已登录但无激活分类提示 */}
            {currentUser && (currentUser.activatedCategories?.length === 0) && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-200 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900">暂无激活的题库分类</h4>
                    <p className="text-xs text-gray-600 mt-0.5">请联系管理员获取激活码来解锁题库</p>
                  </div>
                </div>
              </div>
            )}

            {/* 题库列表 - 按分类分组 - 清新卡片风格 */}
            <div className="space-y-3">
              {banks.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
                  <div className="w-14 h-14 mx-auto mb-3 bg-gray-50 rounded-2xl flex items-center justify-center">
                    <Library className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">暂无题库</p>
                  <p className="text-xs text-gray-400 mt-1">请联系管理员导入</p>
                </div>
              ) : (
                <>
                  {/* 未分类题库 */}
                  {banks.filter(b => !b.categoryId).length > 0 && (
                    <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                        <FolderOpen className="w-4 h-4 text-slate-400" />
                        <h3 className="text-sm font-semibold text-slate-700">未分类</h3>
                        <span className="text-xs text-slate-400 ml-auto">({banks.filter(b => !b.categoryId).length} 题库)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {banks.filter(b => !b.categoryId).map((bank) => (
                          <BankCard 
                            key={bank.id} 
                            bank={bank}
                            accuracy={bankAccuracies[bank.id]}
                            onStartPractice={(bankId) => {
                              // 检查是否需要登录
                              if (!currentUser) {
                                setAuthModalOpen(true);
                                return;
                              }
                              navigateToQuiz(bankId);
                            }}
                            onStartRecite={(bankId) => {
                              if (!currentUser) {
                                setAuthModalOpen(true);
                                return;
                              }
                              navigateToRecite(bankId);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* 按分类显示题库 - 直接显示激活的分类 */}
                  {(() => {
                    // 非登录用户不显示任何题库
                    if (!currentUser) return null;
                    
                    // 获取用户激活的分类ID列表
                    const activatedCategoryIds = currentUser.activatedCategories || [];
                    
                    // 获取用户激活的所有分类
                    const activatedCategories = categories.filter(c => 
                      activatedCategoryIds.includes(c.id)
                    );
                    
                    if (activatedCategories.length === 0) return null;
                    
                    // 分离顶级分类和子分类
                    const topCategories = activatedCategories.filter(c => !c.parentId);
                    const childCategories = activatedCategories.filter(c => c.parentId);
                    
                    // 将子分类按父分类分组
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
                        {/* 先显示激活的子分类（带父分类标题） */}
                        {Array.from(childCategoriesByParent.entries()).map(([parentId, children]) => {
                          const parentCategory = categories.find(c => c.id === parentId);
                          return (
                            <div key={`parent-${parentId}`} className="mb-4">
                              {/* 父分类标题 */}
                              {parentCategory && (
                                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                                  <Folder className="w-4 h-4 text-slate-400" />
                                  <span className="text-sm font-semibold text-slate-700">
                                    {parentCategory.name}
                                  </span>
                                </div>
                              )}
                              {/* 子分类卡片列表 */}
                              <div className="space-y-2">
                                {children.map(category => {
                                  // 获取该分类的题库
                                  const categoryBanks = banks.filter(b => b.categoryId === category.id);
                                  if (categoryBanks.length === 0) return null;
                                  
                                  return (
                                    <div key={category.id} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
                                      {/* 子分类 - 可点击展开 */}
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
                                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-slate-100 text-[11px] text-slate-400 tabular-nums px-1">
                                          {categoryBanks.length}
                                        </span>
                                        <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${selectedCategoryId === category.id ? 'rotate-90' : ''}`} />
                                      </div>
                                    
                                      {/* 展开时显示题库 */}
                                      {selectedCategoryId === category.id && (
                                        <div className="mt-3 space-y-3 pl-2">
                                          {categoryBanks.map(bank => (
                                            <BankCard
                                              key={bank.id}
                                              bank={bank}
                                              accuracy={bankAccuracies[bank.id]}
                                              onStartPractice={(bankId) => {
                                                if (!currentUser) {
                                                  setAuthModalOpen(true);
                                                  return;
                                                }
                                                navigateToQuiz(bankId);
                                              }}
                                              onStartRecite={(bankId) => {
                                                if (!currentUser) {
                                                  setAuthModalOpen(true);
                                                  return;
                                                }
                                                navigateToRecite(bankId);
                                              }}
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
                        
                        {/* 显示激活的顶级分类 */}
                        {topCategories.map(category => {
                          // 获取该分类的直接题库
                          const categoryBanks = banks.filter(b => b.categoryId === category.id);
                          
                          // 获取激活的子分类
                          const activatedChildCategories = childCategoriesByParent.get(category.id) || [];
                          const childCategoryIds = activatedChildCategories.map(c => c.id);
                          const childCategoryBanks = banks.filter(b => childCategoryIds.includes(b.categoryId || ''));
                          
                          // 如果该分类和子分类都没有题库，则不显示
                          if (categoryBanks.length === 0 && childCategoryBanks.length === 0) return null;
                          
                          return (
                            <div key={category.id} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm mb-4">
                              {/* 顶级分类 - 可点击展开 */}
                              <div 
                                className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50/80 p-2 -m-2 rounded-xl transition-all duration-200"
                                onClick={() => setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)}
                              >
                                {selectedCategoryId === category.id ? (
                                  <FolderOpen className="w-4 h-4 text-slate-500" />
                                ) : (
                                  <Folder className="w-4 h-4 text-slate-400" />
                                )}
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg tracking-wide ${
                                  category.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                                  category.color === 'green' ? 'bg-green-100 text-green-700' :
                                  category.color === 'red' ? 'bg-red-100 text-red-700' :
                                  category.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                                  category.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                                  category.color === 'pink' ? 'bg-pink-100 text-pink-700' :
                                  category.color === 'indigo' ? 'bg-indigo-100 text-indigo-700' :
                                  'bg-cyan-100 text-cyan-700'
                                }`}>
                                  {category.name}
                                </span>
                                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-indigo-100 text-[11px] text-indigo-500 ml-auto font-medium tabular-nums px-1">
                                  {categoryBanks.length + childCategoryBanks.length}
                                </span>
                                <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${selectedCategoryId === category.id ? 'rotate-90' : ''}`} />
                              </div>
                            
                              {/* 展开时显示题库 */}
                              {selectedCategoryId === category.id && (
                                <div className="mt-3 space-y-3">
                                  {/* 该分类的直接题库 */}
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
                                            accuracy={bankAccuracies[bank.id]}
                                            onStartPractice={(bankId) => {
                                              if (!currentUser) {
                                                setAuthModalOpen(true);
                                                return;
                                              }
                                              navigateToQuiz(bankId);
                                            }}
                                            onStartRecite={(bankId) => {
                                              if (!currentUser) {
                                                setAuthModalOpen(true);
                                                return;
                                              }
                                              navigateToRecite(bankId);
                                            }}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* 该顶级分类下的激活子分类 */}
                                  {activatedChildCategories.map(child => {
                                    const childBanks = banks.filter(b => b.categoryId === child.id);
                                    if (childBanks.length === 0) return null;
                                    
                                    return (
                                      <div key={child.id}>
                                        <div className="flex items-center gap-2 mb-2">
                                          <FolderOpen className="w-3 h-3 text-gray-500" />
                                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${
                                            child.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                                            child.color === 'green' ? 'bg-green-100 text-green-700' :
                                            child.color === 'red' ? 'bg-red-100 text-red-700' :
                                            child.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                                            child.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                                            child.color === 'pink' ? 'bg-pink-100 text-pink-700' :
                                            child.color === 'indigo' ? 'bg-indigo-100 text-indigo-700' :
                                            'bg-cyan-100 text-cyan-700'
                                          }`}>
                                            {child.name}
                                          </span>
                                          <span className="text-xs text-gray-500 font-medium">({childBanks.length} 题库)</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {childBanks.map((bank) => (
                                            <BankCard 
                                              key={bank.id} 
                                              bank={bank}
                                              accuracy={bankAccuracies[bank.id]}
                                              onStartPractice={(bankId) => {
                                                if (!currentUser) {
                                                  setAuthModalOpen(true);
                                                  return;
                                                }
                                                  navigateToQuiz(bankId);
                                              }}
                                              onStartRecite={(bankId) => {
                                                if (!currentUser) {
                                                  setAuthModalOpen(true);
                                                  return;
                                                }
                                                navigateToRecite(bankId);
                                              }}
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
            
            {/* 底部安全间距 */}
            <div className="h-8"></div>
          </TabsContent>

          {/* 统计页面 - 懒加载 */}
          <TabsContent value="stats">
            <StatsView mounted={mounted} wrongCount={wrongCount} />
          </TabsContent>
        </Tabs>
      </main>
      
      {/* 登录弹窗 */}
    <AuthModal
      open={authModalOpen}
      onOpenChange={setAuthModalOpen}
      onAuthChange={() => {
        // 刷新用户状态
        const user = getStoredUser();
        if (user) {
          setCurrentUser({
            id: user.id,
            phone: user.phone,
            nickname: user.nickname,
            role: user.role,
            activatedCategories: user.activated_categories || [],
          });
        }
      }}
    />
    </div>
  );
}
