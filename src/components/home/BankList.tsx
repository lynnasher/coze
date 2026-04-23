/**
 * BankList - 题库列表组件
 */

'use client';

import { QuestionBank } from '@/lib/types';
import { Library, RefreshCw, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BankListProps {
  banks: QuestionBank[];
  isLoading: boolean;
  searchQuery: string;
  onRefresh: () => void;
  onSearchChange: (query: string) => void;
}

// 题库颜色映射
const BANK_COLORS = [
  'from-slate-400 to-slate-500',
  'from-stone-400 to-stone-500',
  'from-gray-400 to-gray-500',
  'from-zinc-400 to-zinc-500',
  'from-neutral-400 to-neutral-500',
];

export function BankList({
  banks,
  isLoading,
  searchQuery,
  onRefresh,
  onSearchChange,
}: BankListProps) {
  const router = useRouter();

  const getBankColor = (index: number) => {
    return BANK_COLORS[index % BANK_COLORS.length];
  };

  const handleStartPractice = (bankId: string) => {
    router.push(`/?bank=${bankId}&mode=sequential`);
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-[970px] mx-auto px-4 py-4">
        {/* 搜索栏 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜索题库..."
              className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
            />
            <Library className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="h-10 px-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 题库列表 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-slate-400">加载中...</span>
            </div>
          </div>
        ) : banks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <Library className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-base font-medium text-slate-700 mb-1">
              {searchQuery ? '未找到相关题库' : '暂无题库'}
            </h3>
            <p className="text-sm text-slate-400">
              {searchQuery ? '尝试其他关键词搜索' : '请联系管理员添加题库'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {banks.map((bank, index) => (
              <div
                key={bank.id}
                onClick={() => handleStartPractice(bank.id)}
                className="bg-white rounded-xl p-4 border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  {/* 左侧图标 */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getBankColor(index)} flex items-center justify-center flex-shrink-0`}>
                    <Library className="w-6 h-6 text-white" />
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-800 truncate pr-2">
                        {bank.name}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </div>
                    {bank.description && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                        {bank.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span>{bank.questionIds?.length || 0} 题</span>
                      <span>•</span>
                      <span>{bank.createdAt ? new Date(bank.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
