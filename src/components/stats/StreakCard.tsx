'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Flame } from 'lucide-react';
import { StreakStats } from '@/lib/stats-utils';

interface StreakCardProps {
  streak: StreakStats;
}

export function StreakCard({ streak }: StreakCardProps) {
  const isStreakActive = streak.current > 0;

  return (
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
  );
}
