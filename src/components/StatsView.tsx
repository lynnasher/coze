'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { 
  BarChart3, 
  Check,
  X,
  BookOpen,
  Target,
  TrendingUp,
  Flame,
  ChevronRight,
} from 'lucide-react';
import { recordStore, wrongStreakStore } from '@/lib/quiz-store';
import { calculateStreakStats, calculateTrendData, calculateFilteredStats } from '@/lib/stats-utils';

export default function StatsView() {
  const [mounted, setMounted] = useState(false);
  const [statsFilter, setStatsFilter] = useState<'day' | 'week' | 'month' | 'all'>('day');
  const [wrongCount, setWrongCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    // 计算错题数量
    const streaks = wrongStreakStore.getAll();
    const count = Object.values(streaks).filter(s => s.count < 3).length;
    setWrongCount(count);
  }, []);

  if (!mounted) return null;

  const allRecords = recordStore.getAll();
  const filteredStats = calculateFilteredStats(allRecords, statsFilter);
  const streak = calculateStreakStats(allRecords);
  const trend = calculateTrendData(allRecords);
  const maxTrend = Math.max(...trend.map(t => t.count), 1);
  const isStreakActive = streak.current > 0;

  return (
    <div className="space-y-4">
      {/* 连续学习天数 - 紧凑激励卡片 */}
      <Card className={`border-0 shadow-sm rounded-xl overflow-hidden ${isStreakActive ? 'bg-gradient-to-r from-orange-500 to-amber-500' : 'bg-slate-100'}`}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isStreakActive ? 'bg-white/20' : 'bg-slate-200'}`}>
                <Flame className={`w-5 h-5 ${isStreakActive ? 'text-white' : 'text-slate-400'}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold leading-none ${isStreakActive ? 'text-white' : 'text-slate-700'}`}>
                  {streak.current}
                </div>
                <div className={`text-xs mt-0.5 ${isStreakActive ? 'text-orange-100' : 'text-slate-400'}`}>
                  连续天数
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-xs ${isStreakActive ? 'text-orange-100' : 'text-slate-400'}`}>
                最长 {streak.longest}天
              </div>
              {isStreakActive && (
                <span className="text-xs text-white font-medium">🔥 继续保持</span>
              )}
            </div>
          </div>
          
          {/* 周目标进度 */}
          <div className="mt-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs ${isStreakActive ? 'text-orange-100' : 'text-slate-400'}`}>
                本周 {streak.weekly}/{streak.goal}天
              </span>
              <span className={`text-xs font-medium ${isStreakActive ? 'text-white' : 'text-slate-500'}`}>
                {Math.round((streak.weekly / streak.goal) * 100)}%
              </span>
            </div>
            <div className={`h-1.5 rounded-full ${isStreakActive ? 'bg-white/20' : 'bg-slate-200'}`}>
              <div 
                className={`h-full rounded-full transition-all duration-500 ${isStreakActive ? 'bg-white' : 'bg-slate-400'}`}
                style={{ width: `${Math.min((streak.weekly / streak.goal) * 100, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* 近7天学习趋势 - 紧凑版 */}
      <Card className="border-0 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-slate-600">近7天趋势</h3>
            <TrendingUp className="w-3 h-3 text-slate-400" />
          </div>
          <div className="flex items-end justify-between gap-1 h-14">
            {trend.map((t, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                <div 
                  className={`w-full rounded-sm transition-all duration-300 ${t.count > 0 ? 'bg-indigo-500' : 'bg-slate-100'}`}
                  style={{ height: `${(t.count / maxTrend) * 40}px`, minHeight: t.count > 0 ? '2px' : '0' }}
                />
                <span className="text-xs text-slate-400">{t.day}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* 日期筛选 - 紧凑版 */}
      <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
        {[
          { key: 'day', label: '今日' },
          { key: 'week', label: '本周' },
          { key: 'month', label: '本月' },
          { key: 'all', label: '全部' },
        ].map(filter => (
          <button
            key={filter.key}
            onClick={() => setStatsFilter(filter.key as 'day' | 'week' | 'month' | 'all')}
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
              statsFilter === filter.key
                ? 'bg-slate-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      
      {/* 统计卡片网格 - 紧凑版 */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardContent className="p-2.5">
            <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center mb-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-slate-600" />
            </div>
            <p className="text-lg font-bold text-slate-700">{filteredStats.totalCount}</p>
            <p className="text-xs text-slate-400">总练习</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardContent className="p-2.5">
            <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center mb-1.5">
              <Target className="w-3.5 h-3.5 text-slate-600" />
            </div>
            <p className="text-lg font-bold text-slate-700">{filteredStats.accuracy}%</p>
            <p className="text-xs text-slate-400">正确率</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardContent className="p-2.5">
            <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center mb-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <p className="text-lg font-bold text-emerald-600">{filteredStats.correctCount}</p>
            <p className="text-xs text-slate-400">正确</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardContent className="p-2.5">
            <div className="w-7 h-7 bg-rose-50 rounded-lg flex items-center justify-center mb-1.5">
              <X className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <p className="text-lg font-bold text-rose-600">{filteredStats.wrongCount}</p>
            <p className="text-xs text-slate-400">错误</p>
          </CardContent>
        </Card>
      </div>
      
      {/* 错题本导航卡片 - 紧凑版 */}
      <Link href="/wrongbook">
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <BookOpen className="w-4 h-4 text-slate-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-700">错题本</p>
                <p className="text-xs text-slate-500">{wrongCount} 道待复习</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
