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
      <div className="p-3">
        <div className="flex items-center gap-2.5">
          {/* 左侧图标 - 小而精致 */}
          <div className={`
            flex-shrink-0 w-9 h-9
            ${colorConfig.bg}
            rounded-lg
            flex items-center justify-center
            shadow-sm
          `}>
            <Folder className="w-4 h-4 text-white" />
          </div>
          
          {/* 中间内容 - 标题优先 */}
          <div className="flex-1 min-w-0">
            <h4 className={`
              font-medium text-gray-800
              leading-snug line-clamp-2
              group-hover:text-gray-900
              transition-colors
              ${isDisabled ? 'text-xs' : 'text-sm'}
            `}>
              {bank.name}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-1.5">
                <BookOpen className={`w-3 h-3 ${colorConfig.text}`} />
                <span className="text-xs text-gray-500">
                  {questionCount > 0 ? `${questionCount} 道题` : '暂无题目'}
                </span>
              </div>
              {accuracy !== undefined && accuracy >= 0 && questionCount > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-300">|</span>
                  <Target className="w-3 h-3 text-gray-400" />
                  <span className={`text-xs font-medium ${
                    accuracy >= 80 ? 'text-emerald-600' : 
                    accuracy >= 60 ? 'text-amber-600' : 
                    accuracy > 0 ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    {accuracy}% 正确
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* 右侧按钮组 */}
          {questionCount > 0 && (
            <div className="flex-shrink-0 flex items-center gap-1.5">
              <button 
                className={`
                  ${colorConfig.lightBg} ${colorConfig.text}
                  rounded-lg
                  px-2.5 py-1.5
                  text-xs font-medium
                  transition-all duration-200
                  group-hover:scale-105
                  flex items-center gap-1
                `}
                onClick={(e) => {
                  e.stopPropagation();
                  !isDisabled && onStartPractice(bank.id);
                }}
              >
                <Play className="w-3 h-3" fill="currentColor" />
                <span>练习</span>
              </button>
              {onStartRecite && (
                <button 
                  className={`
                    bg-gray-50 text-gray-600
                    rounded-lg
                    px-2.5 py-1.5
                    text-xs font-medium
                    transition-all duration-200
                    group-hover:scale-105 hover:bg-gray-100
                    flex items-center gap-1
                    border border-gray-200
                  `}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartRecite(bank.id);
                  }}
                >
                  <Eye className="w-3 h-3" />
                  <span>背题</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
