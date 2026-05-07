'use client';

import { memo } from 'react';
import { BookOpen, Play, Folder, Target, Eye } from 'lucide-react';

interface BankCardProps {
  bank: {
    id: string;
    name: string;
    questionCount?: number;
    createdAt: number;
  };
  onStartPractice: (bankId: string) => void;
  onStartRecite?: (bankId: string) => void;
  accuracy?: number; // 正确率 0-100，undefined 表示还没有练习记录
}

// 主题色配置
const THEME_CONFIG = [
  { bg: 'bg-indigo-500', lightBg: 'bg-indigo-50', text: 'text-indigo-600' },
  { bg: 'bg-emerald-500', lightBg: 'bg-emerald-50', text: 'text-emerald-600' },
  { bg: 'bg-blue-500', lightBg: 'bg-blue-50', text: 'text-blue-600' },
  { bg: 'bg-orange-500', lightBg: 'bg-orange-50', text: 'text-orange-600' },
  { bg: 'bg-pink-500', lightBg: 'bg-pink-50', text: 'text-pink-600' },
  { bg: 'bg-violet-500', lightBg: 'bg-violet-50', text: 'text-violet-600' },
];

export const BankCard = memo(function BankCard({ bank, onStartPractice, onStartRecite, accuracy }: BankCardProps) {
  const questionCount = bank.questionCount ?? 0;
  
  // 根据名称生成稳定的主题色
  const colorIndex = bank.name.charCodeAt(0) % THEME_CONFIG.length;
  const colorConfig = THEME_CONFIG[colorIndex];
  
  // 无题目时禁用
  const isDisabled = questionCount === 0;

  return (
    <div 
      className={`
        group relative bg-white rounded-xl
        border border-gray-100
        transition-all duration-200
        hover:shadow-md hover:border-gray-200
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      onClick={() => !isDisabled && onStartPractice(bank.id)}
    >
      <div className="p-2.5 sm:p-3">
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* 左侧图标 */}
          <div className={`
            flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9
            ${colorConfig.bg}
            rounded-lg
            flex items-center justify-center
            shadow-sm
          `}>
            <Folder className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          
          {/* 中间内容 */}
          <div className="flex-1 min-w-0">
            <h4 className={`
              font-medium text-gray-800
              leading-snug line-clamp-2
              group-hover:text-gray-900
              transition-colors
              ${isDisabled ? 'text-xs' : 'text-xs sm:text-sm'}
            `}>
              {bank.name}
            </h4>
            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <BookOpen className={`w-3 h-3 ${colorConfig.text}`} />
                <span className="text-[10px] sm:text-xs text-gray-500">
                  {questionCount > 0 ? `${questionCount} 题` : '暂无'}
                </span>
              </div>
              {accuracy !== undefined && accuracy >= 0 && questionCount > 0 && (
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <span className="hidden sm:inline text-gray-300">|</span>
                  <Target className="w-3 h-3 text-gray-400" />
                  <span className={`text-[10px] sm:text-xs font-medium ${
                    accuracy >= 80 ? 'text-emerald-600' : 
                    accuracy >= 60 ? 'text-amber-600' : 
                    accuracy > 0 ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    {accuracy}%
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* 右侧按钮组 - 手机纯图标，桌面图标+文字 */}
          {questionCount > 0 && (
            <div className="flex-shrink-0 flex items-center gap-1 sm:gap-1.5">
              <button 
                className={`
                  ${colorConfig.lightBg} ${colorConfig.text}
                  rounded-lg
                  p-1.5 sm:px-2.5 sm:py-1.5
                  text-xs font-medium
                  transition-all duration-200
                  active:scale-95 sm:group-hover:scale-105
                  flex items-center gap-0 sm:gap-1
                `}
                onClick={(e) => {
                  e.stopPropagation();
                  !isDisabled && onStartPractice(bank.id);
                }}
              >
                <Play className="w-3.5 h-3.5 sm:w-3 sm:h-3" fill="currentColor" />
                <span className="hidden sm:inline">练习</span>
              </button>
              {onStartRecite && (
                <button 
                  className={`
                    bg-gray-50 text-gray-600
                    rounded-lg
                    p-1.5 sm:px-2.5 sm:py-1.5
                    text-xs font-medium
                    transition-all duration-200
                    active:scale-95 sm:group-hover:scale-105 sm:hover:bg-gray-100
                    flex items-center gap-0 sm:gap-1
                    border border-gray-200
                  `}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartRecite(bank.id);
                  }}
                >
                  <Eye className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                  <span className="hidden sm:inline">背题</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
