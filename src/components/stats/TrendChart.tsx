'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { TrendData } from '@/lib/stats-utils';

interface TrendChartProps {
  trend: TrendData[];
}

export function TrendChart({ trend }: TrendChartProps) {
  const maxTrend = Math.max(...trend.map(t => t.count), 1);

  return (
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
  );
}
