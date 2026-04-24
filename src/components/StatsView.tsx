'use client';

import { useState } from 'react';
import { recordStore } from '@/lib/quiz-store';
import { calculateStreakStats, calculateTrendData, calculateFilteredStats } from '@/lib/stats-utils';
import { StreakCard, TrendChart, FilterTabs, StatsGrid, WrongBookCard } from './stats';

interface StatsViewProps {
  mounted: boolean;
  wrongCount: number;
}

export default function StatsView({ mounted, wrongCount }: StatsViewProps) {
  const [statsFilter, setStatsFilter] = useState<'day' | 'week' | 'month' | 'all'>('day');

  if (!mounted) return null;

  const allRecords = recordStore.getAll();
  const filteredStats = calculateFilteredStats(allRecords, statsFilter);
  const streak = calculateStreakStats(allRecords);
  const trend = calculateTrendData(allRecords);

  return (
    <div className="space-y-4">
      {/* 连续学习天数 */}
      <StreakCard streak={streak} />
      
      {/* 近7天学习趋势 */}
      <TrendChart trend={trend} />
      
      {/* 日期筛选 */}
      <FilterTabs value={statsFilter} onChange={setStatsFilter} />
      
      {/* 统计卡片网格 */}
      <StatsGrid stats={filteredStats} />
      
      {/* 错题本导航卡片 */}
      <WrongBookCard wrongCount={wrongCount} />
    </div>
  );
}
