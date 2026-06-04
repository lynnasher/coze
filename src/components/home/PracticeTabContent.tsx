'use client';

import Link from 'next/link';
import { BookOpen, ChevronRight, Trophy, Flame, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { recordStore } from '@/lib/quiz-store';
import { calculateStreakStats } from '@/lib/stats-utils';

interface HomeStats {
  correctCount: number;
  accuracy: number;
}

interface PracticeTabContentProps {
  mounted: boolean;
  wrongCount: number;
  homeStats: HomeStats;
  currentUser: {
    id: string;
    phone: string;
    nickname?: string;
    role: string;
    activatedCategories?: string[];
  } | null;
}

export function PracticeTabContent({ 
  mounted, 
  wrongCount,
  homeStats 
}: PracticeTabContentProps) {
  return (
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
          const allRecords = recordStore.getAll();
          const streak = calculateStreakStats(allRecords);
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
            <p className="text-xl font-bold text-slate-700">
              {!mounted ? '-' : wrongCount}
            </p>
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
              <p className="text-xs text-slate-500">
                {!mounted ? '-' : `${wrongCount} 道待复习`}
              </p>
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
  );
}
