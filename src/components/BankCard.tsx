'use client';

import { memo } from 'react';
import { BookOpen, Play, Sparkles, Layers } from 'lucide-react';

interface BankCardProps {
  bank: {
    id: string;
    name: string;
    questionCount?: number;
    createdAt: number;
  };
  onStartPractice: (bankId: string) => void;
}

// 渐变色配置
const GRADIENT_CONFIG = [
  { bg: 'from-indigo-500 to-purple-500', shadow: 'shadow-indigo-200', icon: 'bg-white/20' },
  { bg: 'from-emerald-500 to-teal-500', shadow: 'shadow-emerald-200', icon: 'bg-white/20' },
  { bg: 'from-blue-500 to-cyan-500', shadow: 'shadow-blue-200', icon: 'bg-white/20' },
  { bg: 'from-orange-500 to-amber-500', shadow: 'shadow-orange-200', icon: 'bg-white/20' },
  { bg: 'from-pink-500 to-rose-500', shadow: 'shadow-pink-200', icon: 'bg-white/20' },
  { bg: 'from-violet-500 to-indigo-500', shadow: 'shadow-violet-200', icon: 'bg-white/20' },
];

export const BankCard = memo(function BankCard({ bank, onStartPractice }: BankCardProps) {
  const questionCount = bank.questionCount ?? 0;
  
  // 根据名称生成稳定的渐变色
  const colorIndex = bank.name.charCodeAt(0) % GRADIENT_CONFIG.length;
  const colorConfig = GRADIENT_CONFIG[colorIndex];
  
  // 无题目时禁用
  const isDisabled = questionCount === 0;

  return (
    <div 
      className={`
        group relative bg-white rounded-2xl overflow-hidden
        border border-gray-100
        transition-all duration-300 ease-out
        hover:shadow-xl hover:shadow-gray-200/50
        hover:-translate-y-1
        ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
      `}
      onClick={() => !isDisabled && onStartPractice(bank.id)}
    >
      {/* 顶部装饰条 */}
      <div className={`h-1.5 bg-gradient-to-r ${colorConfig.bg} opacity-80`} />
      
      {/* 背景装饰 */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-50 to-transparent rounded-bl-[100px] pointer-events-none" />
      
      {/* 内容区域 */}
      <div className="relative p-4">
        <div className="flex items-start gap-3">
          {/* 左侧图标区域 */}
          <div className={`
            relative flex-shrink-0 w-12 h-12
            bg-gradient-to-br ${colorConfig.bg}
            rounded-xl
            flex items-center justify-center
            shadow-lg ${colorConfig.shadow}
            transition-transform duration-300
            group-hover:scale-110
          `}>
            {/* 图标背景 */}
            <div className={`absolute inset-0 ${colorConfig.icon} backdrop-blur-sm`} />
            {/* 层级图标 */}
            <Layers className="w-5 h-5 text-white relative z-10" />
            
            {/* 装饰圆点 */}
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-white/40 rounded-full" />
          </div>
          
          {/* 中间内容 */}
          <div className="flex-1 min-w-0 pt-1">
            {/* 标题 */}
            <h4 className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2 mb-1.5 group-hover:text-gray-900 transition-colors">
              {bank.name}
            </h4>
            
            {/* 底部信息 */}
            <div className="flex items-center gap-3">
              {/* 题目数量 */}
              <div className="flex items-center text-xs text-gray-500">
                <BookOpen className="w-3.5 h-3.5 mr-1 text-gray-400" />
                <span className="font-medium">
                  {questionCount > 0 ? `${questionCount} 道题` : '暂无题目'}
                </span>
              </div>
            </div>
          </div>
          
          {/* 右侧开始按钮 */}
          {questionCount > 0 && (
            <div className={`
              flex-shrink-0 w-10 h-10
              bg-gradient-to-br ${colorConfig.bg}
              rounded-xl
              flex items-center justify-center
              shadow-lg ${colorConfig.shadow}
              transition-all duration-300
              group-hover:scale-110 group-hover:shadow-xl
              opacity-90 group-hover:opacity-100
            `}>
              <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
            </div>
          )}
        </div>
      </div>
      
      {/* 底部装饰线 */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent" />
      
      {/* 悬停时的闪光效果 */}
      <div className={`
        absolute inset-0 pointer-events-none
        bg-gradient-to-r from-white/0 via-white/20 to-white/0
        -translate-x-full
        group-hover:translate-x-full
        transition-transform duration-700 ease-out
        ${isDisabled ? '' : ''}
      `} />
    </div>
  );
});
