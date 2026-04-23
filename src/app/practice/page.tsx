'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  Grid3X3,
  BookOpen,
} from 'lucide-react';
import { useQuiz } from '@/hooks/use-quiz';
import { QuizCard } from '@/components/quiz/QuizCard';
import { AnswerSheet } from '@/components/quiz/AnswerSheet';
import { ResultModal } from '@/components/quiz/ResultModal';
import { recordStore, wrongStreakStore, getWrongQuestionIds, calculateStats } from '@/lib/quiz-store';
import { recalculateWrongData as recalculateWrongDataUtil } from '@/lib/stats-utils';
import { Question } from '@/lib/types';

export default function PracticePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bankId = searchParams.get('bank');
  const mode = searchParams.get('mode') as 'sequential' | 'random' | 'wrong' || 'sequential';
  
  const {
    quizState,
    currentQuestion,
    currentAnswer,
    isLoading,
    hasStarted,
    startQuiz,
    selectAnswer,
    nextQuestion,
    prevQuestion,
    submitAnswer,
    finishQuiz,
    goToQuestion,
    resetQuiz,
  } = useQuiz();
  
  const answers = quizState.answers;

  // 结果弹窗状态
  const [showResultSheet, setShowResultSheet] = useState(false);
  // 答案与解析显示状态
  const [showExplanation, setShowExplanation] = useState(false);
  // 当前综合题的子题目索引
  const [currentChildIndex, setCurrentChildIndex] = useState(0);
  // 题目内容区域的 ref
  const questionContentRef = useRef<HTMLDivElement>(null);
  // 触摸滑动相关 ref
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 50;
  const MAX_SWIPE_TIME = 500;
  const VERTICAL_THRESHOLD = 100;

  // 初始化练习
  useEffect(() => {
    if (bankId && !hasStarted) {
      startQuiz(mode, bankId);
    }
  }, [bankId, mode, hasStarted, startQuiz]);

  // 重新计算错题数据
  const recalculateWrongData = useCallback(() => {
    const allRecords = recordStore.getAll();
    return recalculateWrongDataUtil(
      allRecords,
      (records: typeof allRecords) => recordStore.save(records),
      (streaks: Record<string, number>) => wrongStreakStore.save(streaks),
      () => getWrongQuestionIds().length
    );
  }, []);

  // 刷新首页统计数据
  const refreshHomeStats = useCallback(() => {
    const stats = calculateStats();
    return stats;
  }, []);

  // 计算答题结果统计
  const resultStats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    
    const allQuestions: Question[] = [];
    quizState.questions.forEach(q => {
      if (q.type === 'comprehensive' && q.children && q.children.length > 0) {
        allQuestions.push(q);
        allQuestions.push(...q.children);
      } else if (!q.parentId) {
        allQuestions.push(q);
      }
    });
    
    allQuestions.forEach(q => {
      const answer = quizState.answers[q.id];
      const isUnanswered = 
        answer === undefined || 
        answer === '' || 
        answer === null ||
        (Array.isArray(answer) && answer.length === 0);
      
      if (isUnanswered) {
        unanswered++;
      } else {
        const qAnswer = q.answer;
        if (q.type === 'fill-blank') {
          if (String(answer) === String(qAnswer)) {
            correct++;
          } else {
            wrong++;
          }
        } else if (Array.isArray(qAnswer)) {
          const userAnswer = Array.isArray(answer) ? answer.sort() : [String(answer).toLowerCase()];
          const correctAnswer = qAnswer.map(a => String(a).toLowerCase()).sort();
          const isCorrect = userAnswer.length === correctAnswer.length && 
            userAnswer.every((a, i) => a === correctAnswer[i]);
          if (isCorrect) {
            correct++;
          } else {
            wrong++;
          }
        } else {
          if (String(answer).toLowerCase() === String(qAnswer).toLowerCase()) {
            correct++;
          } else {
            wrong++;
          }
        }
      }
    });
    
    const total = allQuestions.length;
    const accuracy = total > 0 && (correct + wrong) > 0 ? Math.round((correct / (correct + wrong + unanswered)) * 100) : (total > 0 ? Math.round((correct / total) * 100) : 0);
    
    return { correct, wrong, unanswered, total, accuracy };
  }, [quizState.questions, quizState.answers]);

  // 切换题目时重置答案与解析显示状态
  useEffect(() => {
    setShowExplanation(false);
    setCurrentChildIndex(0);
  }, [quizState.currentIndex]);

  // 获取当前要显示的题目
  const displayQuestion = useMemo(() => {
    if (!currentQuestion) return null;
    if (currentQuestion.type === 'comprehensive' && currentQuestion.children && currentQuestion.children.length > 0) {
      const child = currentQuestion.children[currentChildIndex];
      if (child) return child;
    }
    return currentQuestion;
  }, [currentQuestion, currentChildIndex]);

  // 计算当前显示题目的答案
  const displayQuestionAnswer = useMemo(() => {
    if (!displayQuestion) return undefined;
    if (displayQuestion.id !== currentQuestion?.id) {
      return answers[displayQuestion.id];
    }
    return currentAnswer;
  }, [displayQuestion, currentQuestion, currentAnswer, answers]);

  // 计算进度
  const { progressPercent } = useMemo(() => {
    const count = quizState.questions.filter(q => quizState.answers[q.id] !== undefined).length;
    const percent = quizState.questions.length > 0 
      ? Math.round((count / quizState.questions.length) * 100) 
      : 0;
    return { answeredCount: count, progressPercent: percent };
  }, [quizState.questions, quizState.answers]);

  // 滚动到题目内容区域
  const scrollToQuestion = useCallback(() => {
    if (questionContentRef.current) {
      questionContentRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, []);

  // 交卷并显示结果
  const handleFinishAndExit = useCallback(() => {
    if (confirm('确定要交卷吗？')) {
      finishQuiz();
      setShowResultSheet(true);
    }
  }, [finishQuiz]);

  // 处理返回首页
  const handleReturnHome = useCallback(() => {
    resetQuiz();
    router.push('/');
  }, [resetQuiz, router]);

  // 触摸处理
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    touchStartTimeRef.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null || touchStartTimeRef.current === null) {
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;
    const deltaTime = Date.now() - touchStartTimeRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchStartTimeRef.current = null;

    if (deltaTime > MAX_SWIPE_TIME || Math.abs(deltaY) > VERTICAL_THRESHOLD || Math.abs(deltaX) < SWIPE_THRESHOLD) {
      return;
    }

    if (deltaX > 0) {
      if (currentQuestion?.type === 'comprehensive' && currentChildIndex > 0) {
        setCurrentChildIndex(prev => prev - 1);
        setShowExplanation(false);
        setTimeout(scrollToQuestion, 50);
      } else if (quizState.currentIndex > 0) {
        prevQuestion();
        setShowExplanation(false);
        setTimeout(scrollToQuestion, 50);
      }
    } else {
      const isComprehensive = currentQuestion?.type === 'comprehensive';
      const hasMoreChildren = isComprehensive && currentQuestion.children && currentChildIndex < currentQuestion.children.length - 1;
      const isLastQuestion = quizState.currentIndex === quizState.questions.length - 1;

      if (isLastQuestion && !hasMoreChildren) {
        return;
      } else if (hasMoreChildren) {
        setCurrentChildIndex(prev => prev + 1);
        setShowExplanation(false);
        setTimeout(scrollToQuestion, 50);
      } else {
        nextQuestion();
        setShowExplanation(false);
        setTimeout(scrollToQuestion, 50);
      }
    }
  }, [currentQuestion, currentChildIndex, quizState.currentIndex, quizState.questions.length, prevQuestion, nextQuestion, scrollToQuestion]);

  // 上一题
  const handlePrev = useCallback(() => {
    if (currentQuestion?.type === 'comprehensive' && currentChildIndex > 0) {
      setCurrentChildIndex(prev => prev - 1);
      setShowExplanation(false);
      setTimeout(scrollToQuestion, 50);
    } else if (quizState.currentIndex > 0) {
      prevQuestion();
      setShowExplanation(false);
      setTimeout(scrollToQuestion, 50);
    }
  }, [currentQuestion, currentChildIndex, quizState.currentIndex, prevQuestion, scrollToQuestion]);

  // 下一题
  const handleNext = useCallback(() => {
    const isComprehensive = currentQuestion?.type === 'comprehensive';
    const hasMoreChildren = isComprehensive && currentQuestion.children && currentChildIndex < currentQuestion.children.length - 1;
    const isLastQuestion = quizState.currentIndex === quizState.questions.length - 1;

    if (isLastQuestion && !hasMoreChildren) {
      return;
    } else if (hasMoreChildren) {
      setCurrentChildIndex(prev => prev + 1);
      setShowExplanation(false);
      setTimeout(scrollToQuestion, 50);
    } else {
      nextQuestion();
      setShowExplanation(false);
      setTimeout(scrollToQuestion, 50);
    }
  }, [currentQuestion, currentChildIndex, quizState.currentIndex, quizState.questions.length, nextQuestion, scrollToQuestion]);

  // 显示答题卡
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);

  // 如果正在加载
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center animate-pulse shadow-lg">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <p className="text-slate-600 font-medium">加载中...</p>
        </div>
      </div>
    );
  }

  // 如果没有当前题目
  if (!currentQuestion && !showResultSheet) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500">正在加载题目...</p>
          <Button className="mt-4" onClick={() => router.push('/')}>
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 固定顶部栏 */}
      <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 py-3 z-30">
        <div className="max-w-[970px] mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('确定要退出练习吗？')) {
                router.push('/');
              }
            }}
            className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg h-9 px-3"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="text-sm">退出</span>
          </Button>
          
          <span className="text-sm font-medium text-slate-600">
            {quizState.currentIndex + 1} / {quizState.questions.length}
          </span>
          
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleFinishAndExit}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg h-9 w-9 p-0"
              title="交卷"
            >
              <FileCheck className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAnswerSheet(true)}
              className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg h-9 w-9 p-0"
              title="答题卡"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 占位高度 */}
      <div className="h-14" />

      {/* 进度条 */}
      <div className="bg-white border-b border-slate-100 px-4 py-2">
        <div className="max-w-[970px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-500 min-w-[3rem] text-right">
              {progressPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* 题目内容区域 */}
      <QuizCard
        question={currentQuestion}
        displayQuestion={displayQuestion}
        currentIndex={quizState.currentIndex}
        currentChildIndex={currentChildIndex}
        showExplanation={showExplanation}
        answer={displayQuestionAnswer}
        onAnswerSelect={selectAnswer}
        onViewAnswer={() => {
          submitAnswer();
          setShowExplanation(true);
        }}
        questionContentRef={questionContentRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {/* 底部固定操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-4 py-3 z-30">
        <div className="max-w-[970px] mx-auto">
          <div className="flex items-center justify-between gap-3">
            {/* 上一题 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={
                currentQuestion?.type === 'comprehensive' 
                  ? currentChildIndex === 0 && quizState.currentIndex === 0
                  : quizState.currentIndex === 0
              }
              className="h-9 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="ml-1 text-sm font-medium">上一题</span>
            </Button>

            {/* 答案与解析按钮 */}
            <Button
              variant="outline"
              onClick={() => {
                submitAnswer();
                setShowExplanation(true);
                setTimeout(scrollToQuestion, 100);
              }}
              className="h-11 px-6 rounded-xl border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold shadow-sm"
            >
              <BookOpen className="w-4 h-4" />
              <span className="ml-1.5 text-sm">查看答案</span>
            </Button>

            {/* 下一题 / 交卷 */}
            {(() => {
              const isComprehensive = currentQuestion?.type === 'comprehensive';
              const hasMoreChildren = isComprehensive && currentQuestion.children && currentChildIndex < currentQuestion.children.length - 1;
              const isLastQuestion = quizState.currentIndex === quizState.questions.length - 1;
              
              if (isLastQuestion && !hasMoreChildren) {
                return (
                  <Button
                    size="sm"
                    onClick={handleFinishAndExit}
                    className="h-9 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-xl"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span className="ml-1.5 text-sm">交卷</span>
                  </Button>
                );
              } else if (hasMoreChildren) {
                return (
                  <Button
                    size="sm"
                    onClick={() => {
                      setCurrentChildIndex(prev => prev + 1);
                      setShowExplanation(false);
                      setTimeout(scrollToQuestion, 50);
                    }}
                    className="h-9 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-xl"
                  >
                    <span className="text-sm">下一题</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                );
              } else {
                return (
                  <Button
                    size="sm"
                    onClick={handleNext}
                    className="h-9 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-medium rounded-xl"
                  >
                    <span className="text-sm">下一题</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                );
              }
            })()}
          </div>
        </div>
      </div>

      {/* 答题卡弹窗 */}
      <AnswerSheet
        open={showAnswerSheet}
        onOpenChange={setShowAnswerSheet}
        questions={quizState.questions}
        answers={quizState.answers}
        currentIndex={quizState.currentIndex}
        onGoToQuestion={(idx) => {
          goToQuestion(idx);
        }}
        getRecordByQuestionId={(id) => recordStore.getByQuestionId(id)}
        onSubmit={handleFinishAndExit}
      />

      {/* 交卷结果弹窗 */}
      <ResultModal
        open={showResultSheet}
        onOpenChange={setShowResultSheet}
        stats={resultStats}
        questions={quizState.questions}
        answers={quizState.answers}
        onClose={handleReturnHome}
      />
    </div>
  );
}
