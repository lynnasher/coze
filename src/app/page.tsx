'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import Link from 'next/link';
import { 
  Library, 
  BarChart3, 
  Trophy,
  BookOpen,
  ChevronRight,
  Settings,
  Home,
  User,
  Flame
} from 'lucide-react';
import { recordStore, getWrongQuestionIds, calculateStats } from '@/lib/quiz-store';
import { UserStatus, getCurrentUser as getStoredUser } from '@/components/AuthModal';
import { calculateStreakStats } from '@/lib/stats-utils';
import dynamic from 'next/dynamic';

// 统计页面懒加载（首屏不需要，切换到统计 Tab 时才加载）
const StatsView = dynamic(() => import('@/components/StatsView'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center py-20 text-sm text-slate-400">加载中...</div>,
});

// 从 AuthModal 获取当前用户
const getCurrentUser = (): { id: string; phone: string; nickname?: string; role: string; activatedCategories?: string[] } | null => {
  return getStoredUser();
};

export default function QuizApp() {
  const [activeTab, setActiveTab] = useState('practice');
  
  // 从 URL query 参数读取 tab 设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['practice', 'stats'].includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, []);
  
  // 客户端挂载状态（防止 hydration mismatch）
  const [mounted, setMounted] = useState(false);
  
  // 跟踪组件是否已挂载
  const isMountedRef = { current: true };
  
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    phone: string;
    nickname?: string;
    role: string;
    activatedCategories?: string[];
  } | null>(null);
  
  // 错题数量状态（优先使用云端同步后的本地数据）
  const [wrongCount, setWrongCount] = useState<number>(0);
  
  // 统计数据状态
  const [homeStats, setHomeStats] = useState({
    correctCount: 0,
    wrongCount: 0,
    accuracy: 0,
    totalCount: 0,
  });
  
  // 刷新首页统计数据
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
  // 初始化加载（只在首次渲染时执行）
  useEffect(() => {
    isMountedRef.current = true;
    setWrongCount(getWrongQuestionIds().length);
    // 确保组件在客户端挂载
    setMounted(true);
    
    // 获取当前用户
    const user = getCurrentUser();
    setCurrentUser(user);
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 监听 localStorage 变化，以便在用户登录/登出后刷新状态
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (!isMountedRef.current) return;
      if (e.key === 'quiz_user_data' || e.key === 'quiz_user_token') {
        const user = getCurrentUser();
        setCurrentUser(user);
      }
    };

    const handleUserAuthChange = () => {
      if (!isMountedRef.current) return;
      const user = getCurrentUser();
      setCurrentUser(user);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('user-auth-change', handleUserAuthChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('user-auth-change', handleUserAuthChange);
    };
  }, []);
  
  // 监听 record-change 事件以刷新错题数
  useEffect(() => {
    const handleDataChange = () => {
      if (!isMountedRef.current) return;
      setWrongCount(getWrongQuestionIds().length);
      refreshHomeStats();
    };

    window.addEventListener('record-change', handleDataChange);
    return () => {
      window.removeEventListener('record-change', handleDataChange);
    };
  }, [refreshHomeStats]);


  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部区域 */}
      <header className="bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-[970px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* 产品标识 */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-md">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900">智能刷题</h1>
                <p className="text-[10px] text-gray-400 -mt-0.5">高效备考</p>
              </div>
            </div>
            
            {/* 用户信息 */}
            <div className="flex items-center gap-2">
              {currentUser?.role === 'admin' && (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="rounded-xl gap-1 border-orange-200 text-orange-600 hover:bg-orange-50">
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline">管理</span>
                  </Button>
                </Link>
              )}
              <UserStatus />
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-[970px] mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
        }} className="space-y-6">
        {/* 功能标签导航 - 淡雅风格 */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
          <button
            onClick={() => setActiveTab('practice')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'practice'
                ? 'bg-white text-slate-700 shadow-sm'
                : 'text-slate-500 hover:bg-white/50'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>首页</span>
          </button>
          <Link href="/library" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all text-slate-500 hover:bg-white/50">
            <Library className="w-4 h-4" />
            <span>题库</span>
          </Link>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'stats'
                ? 'bg-white text-slate-700 shadow-sm'
                : 'text-slate-500 hover:bg-white/50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>统计</span>
          </button>
        </div>

          {/* 练习页面 - 单栏布局 */}
          <TabsContent value="practice">
            <div className="space-y-4">
              {/* 宣传图区域 */}
              <div className="rounded-2xl overflow-hidden shadow-sm">
                <img 
                  src="https://coze-coding-project.tos.coze.site/coze_storage_7627388534718103615/image/generate_image_1d4f58e3-afe1-4357-9ac8-92a08a77cc5c.jpeg?sign=1807788692-32b74fe686-0-8b149b77cd7c9a0b904429699ef25a0dd3578dfd4ebce3d49afc914c91250132" 
                  alt="智能刷题助手"
                  className="w-full object-cover"
                  style={{ maxHeight: '160px' }}
                />
              </div>

              {/* 学习数据概览 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <div className="w-6 h-6 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  学习数据
                </h3>
                
                {/* 连续学习天数卡片 - 带周目标进度 */}
                {mounted && (() => {
                  const records = recordStore.getAll();
                  const streak = calculateStreakStats(records);
                  const isActive = streak.current > 0;
                  
                  return (
                    <Card className={`border-0 shadow-sm rounded-xl overflow-hidden mb-3 ${isActive ? 'bg-gradient-to-r from-orange-500 to-amber-500' : 'bg-slate-100'}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-white/20' : 'bg-slate-200'}`}>
                              <Flame className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            </div>
                            <div>
                              <div className={`text-2xl font-bold leading-none ${isActive ? 'text-white' : 'text-slate-700'}`}>
                                {streak.current}
                              </div>
                              <div className={`text-[10px] mt-0.5 ${isActive ? 'text-orange-100' : 'text-slate-400'}`}>
                                连续天数
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-[10px] ${isActive ? 'text-orange-100' : 'text-slate-400'}`}>
                              最长 {streak.longest}天
                            </div>
                            {isActive && (
                              <span className="text-[10px] text-white font-medium">🔥 继续保持</span>
                            )}
                          </div>
                        </div>
                        
                        {/* 周目标进度 */}
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] ${isActive ? 'text-orange-100' : 'text-slate-400'}`}>
                              本周 {streak.weekly}/{streak.goal}天
                            </span>
                            <span className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-slate-500'}`}>
                              {Math.round((streak.weekly / streak.goal) * 100)}%
                            </span>
                          </div>
                          <div className={`h-1.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-slate-200'}`}>
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${isActive ? 'bg-white' : 'bg-slate-400'}`}
                              style={{ width: `${Math.min((streak.weekly / streak.goal) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
                
                {/* 数据统计网格 */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-slate-100 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-slate-700">{mounted ? wrongCount : '-'}</p>
                    <p className="text-xs text-slate-500">错题</p>
                  </div>
                  <div className="bg-slate-100 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-slate-700">{mounted ? homeStats.correctCount : '-'}</p>
                    <p className="text-xs text-slate-500">已掌握</p>
                  </div>
                  <div className="bg-slate-100 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-slate-700">{mounted ? homeStats.accuracy : 0}%</p>
                    <p className="text-xs text-slate-500">正确率</p>
                  </div>
                </div>
                
                {/* 错题本入口 */}
                <Link href="/wrongbook">
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">错题本</p>
                      <p className="text-xs text-slate-500">{mounted ? wrongCount : '-'} 道待复习</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </Link>
              </div>

              {/* 登录解锁提示 - 无按钮 */}
              <div className="bg-slate-50 rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <User className="w-6 h-6 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-800">登录解锁全部功能</h4>
                    <p className="text-xs text-gray-500 mt-0.5">激活码激活 · 错题本 · 学习统计</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>


          {/* 统计页面 - 懒加载 */}
          <TabsContent value="stats">
            <StatsView mounted={mounted} wrongCount={wrongCount} />
          </TabsContent>
        </Tabs>
    </main>
    </div>
  );
}


