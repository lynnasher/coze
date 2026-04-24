'use client';

import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, Check, X, Target } from 'lucide-react';
import { FilteredStats } from '@/lib/stats-utils';

interface StatsGridProps {
  stats: FilteredStats;
}

export function StatsGrid({ stats }: StatsGridProps) {
  const items = [
    {
      icon: BarChart3,
      value: stats.totalCount,
      label: '总练习',
      iconClass: 'bg-slate-100 text-slate-600',
      valueClass: 'text-slate-700',
    },
    {
      icon: Target,
      value: `${stats.accuracy}%`,
      label: '正确率',
      iconClass: 'bg-slate-100 text-slate-600',
      valueClass: 'text-slate-700',
    },
    {
      icon: Check,
      value: stats.correctCount,
      label: '正确',
      iconClass: 'bg-emerald-50 text-emerald-500',
      valueClass: 'text-emerald-600',
    },
    {
      icon: X,
      value: stats.wrongCount,
      label: '错误',
      iconClass: 'bg-rose-50 text-rose-500',
      valueClass: 'text-rose-600',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map((item, index) => (
        <Card key={index} className="border-0 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardContent className="p-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${item.iconClass}`}>
              <item.icon className="w-3.5 h-3.5" />
            </div>
            <p className={`text-lg font-bold ${item.valueClass}`}>{item.value}</p>
            <p className="text-xs text-slate-400">{item.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
