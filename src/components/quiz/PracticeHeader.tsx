'use client';

import { ChevronLeft, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PracticeHeaderProps {
  currentIndex: number;
  totalQuestions: number;
  onBack: () => void;
  onShowAnswerSheet: () => void;
}

export function PracticeHeader({
  currentIndex,
  totalQuestions,
  onBack,
  onShowAnswerSheet,
}: PracticeHeaderProps) {
  return (
    <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 z-40">
      <div className="max-w-[970px] mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* 返回按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-9 px-2 text-slate-600 hover:bg-slate-100 -ml-2"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="ml-1 text-sm font-medium">返回</span>
          </Button>

          {/* 中间：题目进度 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">
              {currentIndex + 1}
            </span>
            <span className="text-sm text-slate-400">/</span>
            <span className="text-sm text-slate-500">
              {totalQuestions}
            </span>
          </div>

          {/* 右侧：答题卡按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowAnswerSheet}
            className="h-9 px-2 text-indigo-600 hover:bg-indigo-50 -mr-2"
          >
            <Grid3X3 className="w-4 h-4" />
            <span className="ml-1.5 text-sm font-medium">答题卡</span>
          </Button>
        </div>

      </div>
    </div>
  );
}
