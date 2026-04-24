'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  User, 
  LogOut, 
  Clock,
  BookOpen,
  Target,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUserStore } from '@/lib/store';
import { recordStore } from '@/lib/quiz-store';
import { calculateFilteredStats } from '@/lib/stats-utils';

export default function ProfilePage() {
  const { user: currentUser, isLoggedIn, logout } = useUserStore();
  const [stats, setStats] = useState({
    totalCount: 0,
    correctCount: 0,
    wrongCount: 0,
    accuracy: 0,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const allRecords = recordStore.getAll();
    const filteredStats = calculateFilteredStats(allRecords, 'all');
    setStats(filteredStats);
  }, []);

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isLoggedIn()) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-[970px] mx-auto px-4">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-2">
                <Link href="/">
                  <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl">
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                  </Button>
                </Link>
                <h1 className="text-base font-semibold text-slate-700">个人中心</h1>
              </div>
            </div>
          </div>
        </header>
        
        <div className="max-w-[970px] mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-700 mb-2">未登录</h3>
          <p className="text-sm text-slate-400 mb-6">请先登录查看个人信息</p>
          <Link href="/">
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
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[970px] mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl">
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
                </Button>
              </Link>
              <h1 className="text-base font-semibold text-slate-700">个人中心</h1>
            </div>
            
            <button
              onClick={handleLogout}
              className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              title="退出登录"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* 用户信息卡片 */}
      <div className="max-w-[970px] mx-auto px-4 py-6">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {currentUser?.nickname || currentUser?.phone}
              </h2>
              <p className="text-indigo-100 text-sm mt-1">
                {currentUser?.phone}
              </p>
            </div>
          </div>
        </div>

        {/* 学习统计 */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">学习统计</h3>
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-0 shadow-sm rounded-xl bg-white">
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="text-xl font-bold text-slate-700">{stats.totalCount}</div>
                <div className="text-xs text-slate-400">做题总数</div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm rounded-xl bg-white">
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Target className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-xl font-bold text-slate-700">{stats.accuracy}%</div>
                <div className="text-xs text-slate-400">正确率</div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm rounded-xl bg-white">
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <div className="text-xl font-bold text-slate-700">{stats.wrongCount}</div>
                <div className="text-xs text-slate-400">错题数</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 功能入口 */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">功能</h3>
          <div className="space-y-2">
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
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/library">
              <Card className="border-0 shadow-sm rounded-xl bg-white cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-slate-700">题库浏览</h4>
                      <p className="text-xs text-slate-400">浏览所有题库</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
