'use client';

import { ChevronLeft, ChevronRight, BookOpen, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Question } from '@/lib/types';

interface QuizControlsProps {
  // 当前题目信息
  currentQuestion: Question | null;
  currentIndex: number;
  totalQuestions: number;
  currentChildIndex: number;
  
  // 回调函数
  onPrev: () => void;
  onNext: () => void;
  onViewAnswer: () => void;
  onFinish: () => void;
  
  // 禁用状态
  isFirstQuestion: boolean;
}

export function QuizControls({
  currentQuestion,
  currentIndex,
  totalQuestions,
  currentChildIndex,
  onPrev,
  onNext,
  onViewAnswer,
  onFinish,
  isFirstQuestion,
}: QuizControlsProps) {
  // 判断是否为综合题
  const isComprehensive = currentQuestion?.type === 'comprehensive';
  
  // 判断是否有更多子题目
  const hasMoreChildren = isComprehensive && 
    currentQuestion.children && 
    currentChildIndex < currentQuestion.children.length - 1;
  
  // 判断是否为最后一题
  const isLastQuestion = currentIndex === totalQuestions - 1;
  
  // 判断是否可以点击上一题
  const canGoPrev = !isFirstQuestion || (isComprehensive && currentChildIndex > 0);
  
  // 上一题按钮文本
  const getPrevButtonText = () => {
    if (isComprehensive && currentChildIndex > 0) {
      return '上一题';
    }
    return '上一题';
  };
  
  // 渲染下一题按钮（可能是下一题或交卷）
  const renderNextButton = () => {
    if (isLastQuestion && !hasMoreChildren) {
      // 最后一题且没有更多子题目，显示交卷
      return (
        <Button
          size="sm"
          onClick={onFinish}
          className="h-9 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-xl"
        >
          <FileCheck className="w-4 h-4" />
          <span className="ml-1.5 text-sm">交卷</span>
        </Button>
      );
    } else if (hasMoreChildren) {
      // 还有更多子题目
      return (
        <Button
          size="sm"
          onClick={onNext}
          className="h-9 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-xl"
        >
          <span className="text-sm">下一题</span>
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      );
    } else {
      // 切换到下一大题
      return (
        <Button
          size="sm"
          onClick={onNext}
          className="h-9 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-medium rounded-xl"
        >
          <span className="text-sm">下一题</span>
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      );
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-4 py-3 z-30">
      <div className="max-w-[970px] mx-auto">
        <div className="flex items-center justify-between gap-3">
          {/* 上一题 */}
          <Button
            variant="outline"
            size="sm"
            onClick={onPrev}
            disabled={!canGoPrev}
            className="h-9 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="ml-1 text-sm font-medium">{getPrevButtonText()}</span>
          </Button>

          {/* 答案与解析按钮 */}
          <Button
            variant="outline"
            onClick={onViewAnswer}
            className="h-11 px-6 rounded-xl border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold shadow-sm"
          >
            <BookOpen className="w-4 h-4" />
            <span className="ml-1.5 text-sm">查看答案</span>
          </Button>

          {/* 下一题 / 交卷 */}
          {renderNextButton()}
        </div>
      </div>
    </div>
  );
}
