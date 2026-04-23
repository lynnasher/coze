'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuiz } from '@/hooks/use-quiz';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { 
  ChevronRight, 
  Check,
  X,
  Trophy,
  BookOpen,
  RefreshCw,
  User,
  Flame,
} from 'lucide-react';
import { recordStore, getWrongQuestionIds, generateId, recentPracticeStore, RecentPractice, cloudSyncService, wrongStreakStore, forceSync, forceSyncBeacon, calculateStats } from '@/lib/quiz-store';
import { Question } from '@/lib/types';
import { AuthModal, getCurrentUser as getStoredUser } from '@/components/AuthModal';
import { RichTextWithBreaks } from '@/lib/rich-text';
import { useApp } from '@/components/providers/AppProviders';
import { calculateStreakStats, recalculateWrongData as recalculateWrongDataUtil } from '@/lib/stats-utils';
import { QuizCard } from '@/components/quiz/QuizCard';
import { AnswerSheet } from '@/components/quiz/AnswerSheet';
import { ResultModal } from '@/components/quiz/ResultModal';
import { PracticeHeader } from '@/components/quiz/PracticeHeader';
import { QuizControls } from '@/components/quiz/QuizControls';
import { HomeView } from '@/components/home/HomeView';

export default function HomePage() {
  const {
    quizState,
    currentQuestion,
    currentAnswer,
    isAnswerCorrect,
    isLoading,
    hasStarted,
    startQuiz,
    selectAnswer,
    nextQuestion,
    prevQuestion,
    submitAnswer,
    finishQuiz,
    goToQuestion,
    restartQuiz,
    resetQuiz,
    stats,
  } = useQuiz();

  const { 
    currentUser, 
    setCurrentUser,
    authModalOpen, 
    setAuthModalOpen,
    wrongCount,
    setWrongCount,
    refreshUser,
    syncFromCloud,
    mounted,
  } = useApp();

  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [recentPractices, setRecentPractices] = useState<RecentPractice[]>([]);

  // 首页统计数据
  const [homeStats, setHomeStats] = useState({
    correctCount: 0,
    wrongCount: 0,
    accuracy: 0,
    totalCount: 0,
  });

  // 重新计算错题数据
  const recalculateWrongData = useCallback(() => {
    const wrongCountResult = recalculateWrongDataUtil(
      recordStore.getAll(),
      (records) => recordStore.save(records),
      (streaks) => wrongStreakStore.save(streaks),
      () => getWrongQuestionIds().length
    );
    setWrongCount(wrongCountResult);
    return wrongCountResult;
  }, [setWrongCount]);

  // 刷新首页统计数据
  const refreshHomeStats = useCallback(() => {
    const stats = calculateStats();
    setHomeStats({
      correctCount: stats.correctCount,
      wrongCount: stats.wrongCount,
      accuracy: stats.accuracy,
      totalCount: stats.correctCount + stats.wrongCount,
    });
  }, []);

  // 初始化
  useEffect(() => {
    refreshHomeStats();
    
    const handleBeforeUnload = () => {
      if (cloudSyncService.hasPendingSync()) {
        forceSyncBeacon();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (cloudSyncService.hasPendingSync()) {
        forceSync();
      }
    };
  }, [refreshHomeStats]);

  // 检查URL参数是否要求开始练习
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const practiceBankId = params.get('practice');
      if (practiceBankId && !hasStarted) {
        startQuiz('sequential', practiceBankId);
      }
    }
  }, [hasStarted, startQuiz]);

  // 处理从题库页面返回后刷新
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshHomeStats();
        recalculateWrongData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshHomeStats, recalculateWrongData]);

  // 练习页面
  if (hasStarted) {
    return (
      <PracticeView
        onExit={() => {
          resetQuiz();
          refreshHomeStats();
          recalculateWrongData();
        }}
        quizState={quizState}
        currentQuestion={currentQuestion}
        currentAnswer={currentAnswer}
        isAnswerCorrect={isAnswerCorrect}
        isLoading={isLoading}
        selectAnswer={selectAnswer}
        nextQuestion={nextQuestion}
        prevQuestion={prevQuestion}
        submitAnswer={submitAnswer}
        finishQuiz={finishQuiz}
        goToQuestion={goToQuestion}
        restartQuiz={restartQuiz}
        resetQuiz={resetQuiz}
        answers={quizState.answers}
      />
    );
  }

  // 首页
  return (
    <main className="max-w-[970px] mx-auto px-4 py-6">
      <div className="space-y-4">
        {/* 宣传图 */}
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
          
          {/* 连续学习天数 */}
          {mounted && (() => {
            const records = recordStore.getAll();
            const streak = calculateStreakStats(records);
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
              <p className="text-xl font-bold text-slate-700">{mounted ? wrongCount : '-'}</p>
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
                <p className="text-xs text-slate-500">{mounted ? wrongCount : '-'} 道待复习</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </div>
          </Link>
        </div>

        {/* 登录解锁提示 */}
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

      {/* 登录弹窗 */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onAuthChange={() => {
          const user = getStoredUser();
          if (user) {
            setCurrentUser({
              id: user.id,
              phone: user.phone,
              nickname: user.nickname,
              role: user.role,
              activatedCategories: user.activated_categories || [],
            });
          }
        }}
      />
    </main>
  );
}

// 练习页面组件
interface PracticeViewProps {
  onExit: () => void;
  quizState: ReturnType<typeof useQuiz>['quizState'];
  currentQuestion: ReturnType<typeof useQuiz>['currentQuestion'];
  currentAnswer: ReturnType<typeof useQuiz>['currentAnswer'];
  isAnswerCorrect: ReturnType<typeof useQuiz>['isAnswerCorrect'];
  isLoading: ReturnType<typeof useQuiz>['isLoading'];
  selectAnswer: ReturnType<typeof useQuiz>['selectAnswer'];
  nextQuestion: ReturnType<typeof useQuiz>['nextQuestion'];
  prevQuestion: ReturnType<typeof useQuiz>['prevQuestion'];
  submitAnswer: ReturnType<typeof useQuiz>['submitAnswer'];
  finishQuiz: ReturnType<typeof useQuiz>['finishQuiz'];
  goToQuestion: ReturnType<typeof useQuiz>['goToQuestion'];
  restartQuiz: ReturnType<typeof useQuiz>['restartQuiz'];
  resetQuiz: ReturnType<typeof useQuiz>['resetQuiz'];
  answers: Record<string, string | string[]>;
}

function PracticeView({ 
  onExit, 
  quizState, 
  currentQuestion, 
  currentAnswer,
  isAnswerCorrect,
  isLoading,
  selectAnswer,
  nextQuestion,
  prevQuestion,
  submitAnswer,
  finishQuiz,
  goToQuestion,
  restartQuiz,
  resetQuiz,
  answers,
}: PracticeViewProps) {
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [showResultSheet, setShowResultSheet] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [currentChildIndex, setCurrentChildIndex] = useState(0);
  const questionContentRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 50;
  const MAX_SWIPE_TIME = 500;
  const VERTICAL_THRESHOLD = 100;

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
          if (JSON.stringify(userAnswer) === JSON.stringify(correctAnswer)) {
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
    
    return { correct, wrong, unanswered, total: allQuestions.length };
  }, [quizState.questions, quizState.answers]);

  // 切换题目时滚动到顶部
  useEffect(() => {
    if (questionContentRef.current) {
      questionContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setShowExplanation(false);
  }, [quizState.currentIndex]);

  // 触摸滑动处理
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartTimeRef.current = Date.now();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (
      touchStartXRef.current === null ||
      touchStartYRef.current === null ||
      touchStartTimeRef.current === null
    ) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchStartXRef.current - touchEndX;
    const deltaY = touchStartYRef.current - touchEndY;
    const deltaTime = Date.now() - touchStartTimeRef.current;

    if (deltaTime > MAX_SWIPE_TIME) return;
    if (Math.abs(deltaY) > VERTICAL_THRESHOLD) return;

    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX > 0) {
        // 向左滑动 - 下一题
        if (quizState.currentIndex < quizState.questions.length - 1) {
          nextQuestion();
        }
      } else {
        // 向右滑动 - 上一题
        if (quizState.currentIndex > 0) {
          prevQuestion();
        }
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchStartTimeRef.current = null;
  };

  // 综合题当前显示的子题目
  const displayQuestion = useMemo(() => {
    if (!currentQuestion) return null;
    if (currentQuestion.type === 'comprehensive' && currentQuestion.children && currentQuestion.children.length > 0) {
      return currentQuestion.children[currentChildIndex] || currentQuestion.children[0];
    }
    return currentQuestion;
  }, [currentQuestion, currentChildIndex]);

  if (!currentQuestion || !displayQuestion) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  const progressPercent = Math.round(((quizState.currentIndex + 1) / quizState.questions.length) * 100);
  const isComprehensive = currentQuestion.type === 'comprehensive' && currentQuestion.children && currentQuestion.children.length > 0;
  const totalChildren = isComprehensive ? currentQuestion.children!.length : 0;

  return (
    <div 
      className="min-h-screen bg-slate-50 pb-24"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 顶部导航 */}
      <PracticeHeader
        currentIndex={quizState.currentIndex}
        totalQuestions={quizState.questions.length}
        progressPercent={progressPercent}
        onBack={() => {
          resetQuiz();
          onExit();
        }}
        onShowAnswerSheet={() => setShowAnswerSheet(true)}
      />

      {/* 综合题子题目切换 */}
      {isComprehensive && totalChildren > 1 && (
        <div className="bg-white border-b border-slate-100 px-4 py-2">
          <div className="max-w-[970px] mx-auto flex items-center gap-2 overflow-x-auto">
            {currentQuestion.children!.map((child, idx) => (
              <button
                key={child.id}
                onClick={() => setCurrentChildIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  currentChildIndex === idx
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                子题 {idx + 1}/{totalChildren}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 题目内容区域 */}
      <div ref={questionContentRef} className="max-w-[970px] mx-auto px-4 py-4">
        <QuizCard
          question={currentQuestion}
          displayQuestion={displayQuestion}
          currentIndex={quizState.currentIndex}
          currentChildIndex={currentChildIndex}
          showExplanation={showExplanation}
          answer={currentAnswer}
          onAnswerSelect={selectAnswer}
          onViewAnswer={() => setShowExplanation(true)}
        />
      </div>

      {/* 底部控制栏 */}
      <QuizControls
        currentQuestion={currentQuestion}
        currentIndex={quizState.currentIndex}
        totalQuestions={quizState.questions.length}
        currentChildIndex={currentChildIndex}
        onPrev={prevQuestion}
        onNext={nextQuestion}
        onViewAnswer={() => setShowExplanation(true)}
        onFinish={() => {
          setShowResultSheet(true);
          finishQuiz();
        }}
        isFirstQuestion={quizState.currentIndex === 0}
      />

      {/* 答题卡弹窗 */}
      <AnswerSheet
        open={showAnswerSheet}
        onOpenChange={setShowAnswerSheet}
        questions={quizState.questions}
        answers={answers}
        currentIndex={quizState.currentIndex}
        onGoToQuestion={goToQuestion}
        getRecordByQuestionId={(id) => recordStore.getByQuestionId(id)}
        onSubmit={() => {
          setShowAnswerSheet(false);
          setShowResultSheet(true);
          finishQuiz();
        }}
      />

      {/* 结果弹窗 */}
      <ResultModal
        open={showResultSheet}
        onOpenChange={setShowResultSheet}
        stats={{
          total: resultStats.total,
          correct: resultStats.correct,
          wrong: resultStats.wrong,
          unanswered: resultStats.unanswered,
          accuracy: resultStats.total > 0 ? Math.round((resultStats.correct / resultStats.total) * 100) : 0,
        }}
        questions={quizState.questions}
        answers={answers}
        onClose={() => {
          setShowResultSheet(false);
          resetQuiz();
          onExit();
        }}
      />
    </div>
  );
}
