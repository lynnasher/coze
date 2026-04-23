'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft,
  BarChart3, 
  Check,
  X,
  BookOpen,
  Target,
  TrendingUp,
  Flame,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { recordStore } from '@/lib/quiz-store';
import { calculateStreakStats, calculateTrendData, calculateFilteredStats } from '@/lib/stats-utils';

export default function StatsPage() {
  const [mounted, setMounted] = useState(false);
  const [statsFilter, setStatsFilter] = useState<'day' | 'week' | 'month' | 'all'>('day');
  const [wrongCount, setWrongCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    // 计算错题数
    const records = recordStore.getAll();
    const wrongIds = new Set(records.filter(r => !r.isCorrect).map(r => r.questionId));
    setWrongCount(wrongIds.size);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-200 rounded-2xl flex items-center justify-center animate-pulse">
            <BarChart3 className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-500">加载中...</p>
        </div>
      </div>
    );
  }

  const allRecords = recordStore.getAll();
  const filteredStats = calculateFilteredStats(allRecords, statsFilter);
  const streak = calculateStreakStats(allRecords);
  const trend = calculateTrendData(allRecords);
  const maxTrend = Math.max(...trend.map(t => t.count), 1);
  const isStreakActive = streak.current > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航 */}
      <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 py-3 z-30">
        <div className="max-w-[970px] mx-auto flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700 rounded-lg h-9 px-3">
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span className="text-sm">返回</span>
            </Button>
          </Link>
          <h1 className="text-base font-semibold text-slate-700">学习统计</h1>
          <div className="w-16" />
        </div>
      </div>

      {/* 占位高度 */}
      <div className="h-14" />

      <div className="max-w-[970px] mx-auto px-4 py-4 space-y-4">
        {/* 连续学习天数 */}
        <Card className={`border-0 shadow-sm rounded-xl overflow-hidden ${isStreakActive ? 'bg-gradient-to-r from-orange-500 to-amber-500' : 'bg-slate-100'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isStreakActive ? 'bg-white/20' : 'bg-slate-200'}`}>
                  <Flame className={`w-6 h-6 ${isStreakActive ? 'text-white' : 'text-slate-400'}`} />
                </div>
                <div>
                  <div className={`text-3xl font-bold ${isStreakActive ? 'text-white' : 'text-slate-700'}`}>
                    {streak.current}
                  </div>
                  <div className={`text-sm ${isStreakActive ? 'text-orange-100' : 'text-slate-400'}`}>
                    连续学习天数
                  </div>
                </div>
              </div>
              {isStreakActive && (
                <span className="px-3 py-1 bg-white/20 rounded-full text-white text-xs font-medium">
                  继续保持
                </span>
              )}
            </div>
            
            {/* 周目标进度 */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs ${isStreakActive ? 'text-orange-100' : 'text-slate-400'}`}>
                  本周 {streak.weekly}/{streak.goal}天
                </span>
                <span className={`text-xs font-medium ${isStreakActive ? 'text-white' : 'text-slate-500'}`}>
                  {Math.round((streak.weekly / streak.goal) * 100)}%
                </span>
              </div>
              <div className={`h-2 rounded-full ${isStreakActive ? 'bg-white/20' : 'bg-slate-200'}`}>
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${isStreakActive ? 'bg-white' : 'bg-slate-400'}`}
                  style={{ width: `${Math.min((streak.weekly / streak.goal) * 100, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 今日/本周/本月/全部 筛选 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['day', 'week', 'month', 'all'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatsFilter(filter)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                statsFilter === filter
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {filter === 'day' ? '今日' : filter === 'week' ? '本周' : filter === 'month' ? '本月' : '全部'}
            </button>
          ))}
        </div>

        {/* 数据统计卡片 */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-0 shadow-sm rounded-xl bg-gradient-to-br from-emerald-500 to-green-500">
            <CardContent className="p-4 text-center text-white">
              <div className="w-10 h-10 mx-auto mb-2 bg-white/20 rounded-xl flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold">{filteredStats.correctCount}</div>
              <div className="text-xs text-green-100">正确</div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm rounded-xl bg-gradient-to-br from-red-500 to-rose-500">
            <CardContent className="p-4 text-center text-white">
              <div className="w-10 h-10 mx-auto mb-2 bg-white/20 rounded-xl flex items-center justify-center">
                <X className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold">{filteredStats.wrongCount}</div>
              <div className="text-xs text-red-100">错误</div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500">
            <CardContent className="p-4 text-center text-white">
              <div className="w-10 h-10 mx-auto mb-2 bg-white/20 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold">{filteredStats.accuracy}%</div>
              <div className="text-xs text-indigo-100">正确率</div>
            </CardContent>
          </Card>
        </div>

        {/* 错题本入口 */}
        <Link href="/wrongbook">
          <Card className="border-0 shadow-sm rounded-xl bg-white hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-700">错题本</h3>
                  <p className="text-sm text-slate-400">{wrongCount} 道待复习</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 近7天趋势 */}
        <Card className="border-0 shadow-sm rounded-xl bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-700">近7天练习趋势</h3>
            </div>
            
            <div className="flex items-end justify-between h-24 gap-1">
              {trend.map((day, index) => {
                const height = maxTrend > 0 ? (day.count / maxTrend) * 100 : 0;
                const isToday = index === trend.length - 1;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className={`w-full rounded-t-lg transition-all ${
                        isToday 
                          ? 'bg-indigo-500' 
                          : 'bg-slate-200 hover:bg-slate-300'
                      }`}
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                    <span className={`text-xs ${isToday ? 'text-indigo-600 font-medium' : 'text-slate-400'}`}>
                      {day.count}
                    </span>
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-between mt-2 text-xs text-slate-400">
              {trend.length >= 7 && (
                <>
                  <span>{trend[0]?.day}日</span>
                  <span>{trend[trend.length - 1]?.day}日</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 总览统计 */}
        <Card className="border-0 shadow-sm rounded-xl bg-white">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">学习总览</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">历史最高连续</span>
                </div>
                <span className="text-sm text-slate-900 font-medium">{streak.longest} 天</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">累计练习</span>
                </div>
                <span className="text-sm text-slate-900 font-medium">{allRecords.length} 题</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
