'use client';

import { ChevronLeft, Grid3X3, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PracticeHeaderProps {
  currentIndex: number;
  totalQuestions: number;
  onBack: () => void;
  onShowAnswerSheet: () => void;
  onSubmit: () => void;
}

export function PracticeHeader({
  currentIndex,
  totalQuestions,
  onBack,
  onShowAnswerSheet,
  onSubmit,
}: PracticeHeaderProps) {
  return (
    <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 z-40">
     
      
      <div className="max-w-[970px] mx-auto px-4 h-12 flex items-center justify-between">
        {/* 左侧：返回按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-9 px-2 text-slate-600 hover:bg-slate-100 -ml-2"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="ml-1 text-sm font-medium">返回</span>
        </Button>

       

        {/* 右侧：交卷 + 答题卡按钮 */}
        <div className="flex items-center gap-2 -mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSubmit}
            className="h-9 px-3 text-slate-600 hover:bg-slate-100"
          >
            <Send className="w-4 h-4" />
           
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowAnswerSheet}
            className="h-9 px-2 text-indigo-600 hover:bg-indigo-50"
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
