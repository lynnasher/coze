/**
 * useQuizNavigation - 题目导航 Hook
 * 处理题目切换、滑动等逻辑
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { Question } from '@/lib/types';

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
}

interface UseQuizNavigationOptions {
  questions: Question[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
}

interface UseQuizNavigationReturn {
  // 状态
  currentIndex: number;
  currentQuestion: Question | null;
  isFirst: boolean;
  isLast: boolean;
  
  // 导航方法
  goToQuestion: (index: number) => void;
  nextQuestion: () => boolean;
  prevQuestion: () => boolean;
  goToQuestionById: (questionId: string) => void;
  
  // 触摸手势
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
  
  // 触摸状态
  touchState: TouchState | null;
  isSwiping: boolean;
  
  // 进度
  progress: { current: number; total: number; percent: number };
}

export function useQuizNavigation(
  options: UseQuizNavigationOptions
): UseQuizNavigationReturn {
  const { 
    questions, 
    initialIndex = 0, 
    onIndexChange 
  } = options;
  
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchState, setTouchState] = useState<TouchState | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  
  const questionContentRef = useRef<HTMLDivElement>(null);
  
  // 当前题目
  const currentQuestion = questions[currentIndex] || null;
  
  // 是否是第一个/最后一个
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;
  
  // 进度
  const progress = {
    current: currentIndex + 1,
    total: questions.length,
    percent: questions.length > 0 
      ? Math.round(((currentIndex + 1) / questions.length) * 100) 
      : 0,
  };
  
  // 跳转到指定题目
  const goToQuestion = useCallback((index: number) => {
    if (index < 0 || index >= questions.length) return;
    
    setCurrentIndex(index);
    onIndexChange?.(index);
    
    // 滚动到题目区域
    setTimeout(() => {
      questionContentRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }, 100);
  }, [questions.length, onIndexChange]);
  
  // 下一题
  const nextQuestion = useCallback((): boolean => {
    if (isLast) return false;
    goToQuestion(currentIndex + 1);
    return true;
  }, [currentIndex, isLast, goToQuestion]);
  
  // 上一题
  const prevQuestion = useCallback((): boolean => {
    if (isFirst) return false;
    goToQuestion(currentIndex - 1);
    return true;
  }, [currentIndex, isFirst, goToQuestion]);
  
  // 根据题目ID跳转
  const goToQuestionById = useCallback((questionId: string) => {
    const index = questions.findIndex(q => q.id === questionId);
    if (index !== -1) {
      goToQuestion(index);
    }
  }, [questions, goToQuestion]);
  
  // 触摸开始
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchState({
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      startTime: Date.now(),
    });
    setIsSwiping(false);
  }, []);
  
  // 触摸结束
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchState) return;
    
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchState.startX;
    const deltaY = endY - touchState.startY;
    const deltaTime = Date.now() - touchState.startTime;
    
    // 判断是否为有效滑动（水平滑动超过50px，垂直偏移小于水平偏移的一半，且滑动时间小于500ms）
    const isValidSwipe = 
      Math.abs(deltaX) > 50 && 
      Math.abs(deltaY) < Math.abs(deltaX) / 2 && 
      deltaTime < 500;
    
    if (isValidSwipe) {
      setIsSwiping(true);
      
      // 左滑：下一题
      if (deltaX < 0 && !isLast) {
        goToQuestion(currentIndex + 1);
      }
      // 右滑：上一题
      else if (deltaX > 0 && !isFirst) {
        goToQuestion(currentIndex - 1);
      }
    }
    
    setTouchState(null);
    
    // 重置滑动状态
    setTimeout(() => setIsSwiping(false), 100);
  }, [touchState, currentIndex, isFirst, isLast, goToQuestion]);
  
  return {
    currentIndex,
    currentQuestion,
    isFirst,
    isLast,
    goToQuestion,
    nextQuestion,
    prevQuestion,
    goToQuestionById,
    handleTouchStart,
    handleTouchEnd,
    touchState,
    isSwiping,
    progress,
  };
}
