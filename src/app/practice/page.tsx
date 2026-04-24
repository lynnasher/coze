'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Grid3X3, 
  ChevronLeft, 
  ChevronRight,
  Timer,
  Check,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuizStore } from '@/lib/store/quiz-store';
import { recordStore, questionStore, getWrongQuestionIds, wrongStreakStore, queueRecordForSync, queueStreakForSync, getCurrentUserId } from '@/lib/quiz-store';
import { Question, PracticeMode, PracticeRecord } from '@/lib/types';
import { QuizCard } from '@/components/quiz/QuizCard';
import { AnswerSheet } from '@/components/quiz/AnswerSheet';
import { ResultModal } from '@/components/quiz/ResultModal';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// 题型颜色映射
const TYPE_COLORS: Record<string, string> = {
  single: 'bg-indigo-500',
  multiple: 'bg-purple-500',
  'true-false': 'bg-cyan-500',
  comprehensive: 'bg-rose-500',
  'fill-blank': 'bg-teal-500',
};

export default function PracticePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bankId = searchParams.get('bankId');
  const mode = (searchParams.get('mode') as PracticeMode) || 'sequential';
  const isWrongBook = searchParams.get('wrongbook') === 'true';
  const wrongQuestionIds = searchParams.get('questions')?.split(',').filter(Boolean) || [];

  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [showResultSheet, setShowResultSheet] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 触摸滑动相关状态
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const {
    currentIndex,
    answers,
    showResult,
    timeSpent,
    hasStarted,
    isComplete,
    currentChildIndex,
    showExplanation,
    selectAnswer,
    nextQuestion,
    prevQuestion,
    goToQuestion,
    submitAnswer,
    startQuiz,
    finishQuiz,
    resetQuiz,
    incrementTime,
    setShowExplanation,
    setCurrentChildIndex,
  } = useQuizStore();

  // 当前题目
  const currentQuestion = questions[currentIndex] || null;
  const isComprehensive = currentQuestion?.type === 'comprehensive';
  const hasChildren = isComprehensive && currentQuestion.children && currentQuestion.children.length > 0;
  
  // 实际显示的题目（综合题子题或当前题目）
  const displayQuestion = (isComprehensive && hasChildren && currentChildIndex >= 0) 
    ? currentQuestion.children![currentChildIndex]
    : currentQuestion;

  // 当前答案
  const displayQuestionAnswer = displayQuestion ? answers[displayQuestion.id] : undefined;

  // 加载题目
  const loadQuestions = useCallback(async () => {
    // 错题模式：从本地加载错题
    if (isWrongBook) {
      try {
        setIsLoading(true);
        
        // 获取错题ID列表（优先使用URL参数，否则获取所有错题）
        const wrongIds = wrongQuestionIds.length > 0 
          ? wrongQuestionIds 
          : getWrongQuestionIds();
        
        if (wrongIds.length === 0) {
          router.push('/wrongbook');
          return;
        }
        
        // 从本地存储获取题目
        const allQuestions = questionStore.getAll();
        const loadedQuestions = wrongIds
          .map(id => allQuestions.find(q => q.id === id))
          .filter((q): q is Question => q !== undefined);
        
        if (loadedQuestions.length === 0) {
          // 尝试从云端获取题目
          const token = localStorage.getItem('quiz_user_token');
          if (token) {
            const response = await fetch('/api/questions/batch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ ids: wrongIds.slice(0, 50) }), // 最多50题
            });
            
            if (response.ok) {
              const data = await response.json();
              const cloudQuestions = data.questions || [];
              setQuestions(cloudQuestions);
              startQuiz(cloudQuestions, 'wrongbook');
              setIsLoading(false);
              return;
            }
          }
          
          router.push('/wrongbook');
          return;
        }
        
        setQuestions(loadedQuestions);
        startQuiz(loadedQuestions, 'wrongbook');
      } catch (error) {
        console.error('加载错题失败:', error);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    // 题库模式：从API加载
    if (!bankId) {
      router.push('/library');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/banks/${bankId}/questions`);
      if (!response.ok) {
        throw new Error('加载题目失败');
      }
      
      const data = await response.json();
      const loadedQuestions = data.questions || [];
      
      // 按模式处理题目
      let processedQuestions = [...loadedQuestions];
      if (mode === 'random') {
        processedQuestions = shuffleArray(processedQuestions);
      }
      
      setQuestions(processedQuestions);
      startQuiz(processedQuestions, mode);
    } catch (error) {
      console.error('加载题目失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [bankId, mode, isWrongBook, wrongQuestionIds, router, startQuiz]);

  useEffect(() => {
    setMounted(true);
    loadQuestions();
    
    return () => {
      resetQuiz();
    };
  }, [loadQuestions, resetQuiz]);

  // 计时器
  useEffect(() => {
    if (!hasStarted || isComplete) return;
    
    const timer = setInterval(() => {
      incrementTime();
    }, 1000);
    
    return () => clearInterval(timer);
  }, [hasStarted, isComplete, incrementTime]);

  // 处理答案选择
  const handleSelectAnswer = (questionId: string, answer: string | string[]) => {
    selectAnswer(questionId, answer);
    
    // 检查答案正确性
    const question = questions.find(q => q.id === questionId);
    if (question) {
      const correctAnswer = question.answer;
      let isCorrect = false;
      
      if (question.type === 'fill-blank') {
        isCorrect = String(answer) === String(correctAnswer);
      } else if (Array.isArray(correctAnswer)) {
        const userAnswer = Array.isArray(answer) ? answer.sort() : [String(answer).toLowerCase()];
        const sortedCorrect = correctAnswer.map(a => String(a).toLowerCase()).sort();
        isCorrect = userAnswer.length === sortedCorrect.length && 
          userAnswer.every((a, i) => a === sortedCorrect[i]);
      } else {
        isCorrect = String(answer).toLowerCase() === String(correctAnswer).toLowerCase();
      }

      // 保存练习记录
      const record: PracticeRecord = {
        id: `rec_${Date.now()}`,
        questionId,
        isCorrect,
        selectedAnswer: answer,
        timestamp: Date.now(),
      };
      recordStore.add(record);
    }
  };

  // 提交答案（显示解析）
  const handleSubmitAnswer = () => {
    submitAnswer();
    setShowExplanation(true);
    
    // 错题模式：处理连续答对次数
    if (isWrongBook && currentQuestion) {
      const currentAnswer = useQuizStore.getState().answers[currentQuestion.id];
      const isCorrect = checkAnswer(currentQuestion, currentAnswer);
      const userId = getCurrentUserId();
      
      if (isCorrect) {
        // 答对：增加连续答对次数
        wrongStreakStore.increment(currentQuestion.id);
        const newStreak = wrongStreakStore.get(currentQuestion.id);
        
        // 同步到云端
        if (userId) {
          queueStreakForSync(currentQuestion.id, newStreak);
        }
        
        // 连续答对3次：从错题本移除
        if (newStreak >= 3) {
          // 移除该题的所有错误记录
          const allRecords = recordStore.getAll();
          recordStore.save(allRecords.filter(r => !(r.questionId === currentQuestion.id && !r.isCorrect)));
          wrongStreakStore.remove(currentQuestion.id);
          
          if (userId) {
            queueStreakForSync(currentQuestion.id, 0);
          }
          console.log('[错题模式] 题目已掌握，从错题本移除:', currentQuestion.id);
        }
      } else {
        // 答错：重置连续答对次数
        wrongStreakStore.reset(currentQuestion.id);
        if (userId) {
          queueStreakForSync(currentQuestion.id, 0);
        }
      }
    }
  };
  
  // 检查答案是否正确
  const checkAnswer = (question: Question, answer: string | string[] | undefined): boolean => {
    if (!answer) return false;
    if (Array.isArray(question.answer)) {
      const userAnswers = Array.isArray(answer) ? answer : [answer];
      return userAnswers.length === question.answer.length && userAnswers.every(a => question.answer.includes(a));
    }
    return answer === question.answer;
  };

  // 下一题
  const handleNextQuestion = () => {
    setShowExplanation(false);
    
    // 如果是综合题且有子题，先切换到子题
    if (isComprehensive && hasChildren) {
      if (currentChildIndex < currentQuestion.children!.length - 1) {
        setCurrentChildIndex(currentChildIndex + 1);
        return;
      }
    }
    
    nextQuestion();
    setCurrentChildIndex(0);
  };

  // 上一题
  const handlePrevQuestion = () => {
    setShowExplanation(false);
    
    // 如果是综合题且有子题，先切换到子题
    if (isComprehensive && hasChildren && currentChildIndex > 0) {
      setCurrentChildIndex(currentChildIndex - 1);
      return;
    }
    
    prevQuestion();
    // 如果切换到上一题的综合题，设置到最后一个子题
    const prevQ = questions[currentIndex - 1];
    if (prevQ?.type === 'comprehensive' && prevQ.children?.length) {
      setCurrentChildIndex(prevQ.children.length - 1);
    } else {
      setCurrentChildIndex(0);
    }
  };

  // 跳转到指定题目
  const handleGoToQuestion = (index: number) => {
    setShowExplanation(false);
    goToQuestion(index);
    setCurrentChildIndex(0);
    setShowAnswerSheet(false);
  };

  // 交卷
  const handleFinishAndExit = () => {
    finishQuiz();
    setShowResultSheet(true);
  };

  // 返回首页
  const handleReturnHome = () => {
    resetQuiz();
    router.push('/');
  };

  // 触摸滑动处理
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNextQuestion();
      } else {
        handlePrevQuestion();
      }
    }
  };

  // 计算统计数据
  const getResultStats = () => {
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;

    questions.forEach((q) => {
      const answer = answers[q.id];
      const isUnanswered = 
        answer === undefined || 
        answer === '' || 
        (Array.isArray(answer) && answer.length === 0);

      if (isUnanswered) {
        unanswered++;
      } else {
        const correctAnswer = q.answer;
        let isCorrect = false;

        if (q.type === 'fill-blank') {
          isCorrect = String(answer) === String(correctAnswer);
        } else if (Array.isArray(correctAnswer)) {
          const userAnswer = Array.isArray(answer) ? answer.sort() : [String(answer).toLowerCase()];
          const sortedCorrect = correctAnswer.map(a => String(a).toLowerCase()).sort();
          isCorrect = userAnswer.length === sortedCorrect.length && 
            userAnswer.every((a, i) => a === sortedCorrect[i]);
        } else {
          isCorrect = String(answer).toLowerCase() === String(correctAnswer).toLowerCase();
        }

        if (isCorrect) correct++;
        else wrong++;
      }
    });

    const totalAnswered = correct + wrong;
    const accuracy = totalAnswered > 0 ? Math.round((correct / totalAnswered) * 100) : 0;

    return { total: questions.length, correct, wrong, unanswered, accuracy };
  };

  if (isLoading || !mounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <p className="text-slate-500 mb-4">暂无题目</p>
        <Button onClick={() => router.push('/library')}>返回题库</Button>
      </div>
    );
  }

  const resultStats = getResultStats();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航 */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-50">
        <div className="max-w-[970px] mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* 左侧：返回和题号 */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => router.push('/library')}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title="返回"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-slate-600">
                {currentIndex + 1}/{questions.length}
              </span>
            </div>

            {/* 中间：计时器 */}
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <Timer className="w-4 h-4" />
              <span className="font-mono">
                {Math.floor(timeSpent / 60)}:{String(timeSpent % 60).padStart(2, '0')}
              </span>
            </div>

            {/* 右侧：交卷和答题卡 */}
            <div className="flex items-center gap-2">
              <button 
                onClick={handleFinishAndExit}
                className="p-2 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="交卷"
              >
                <CheckCircle className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setShowAnswerSheet(true)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title="答题卡"
              >
                <Grid3X3 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 进度条 */}
      <div className="fixed top-14 left-0 right-0 h-1 bg-slate-100 z-40">
        <div 
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* 主内容区 */}
      <main className="pt-16">
        {currentQuestion && (
          <QuizCard
            question={currentQuestion}
            displayQuestion={displayQuestion}
            currentIndex={currentIndex}
            currentChildIndex={currentChildIndex}
            showExplanation={showExplanation}
            answer={displayQuestionAnswer}
            onAnswerSelect={handleSelectAnswer}
            onViewAnswer={handleSubmitAnswer}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          />
        )}
      </main>

      {/* 底部导航 */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
        <div className="max-w-[970px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* 上一题 */}
            <button 
              onClick={handlePrevQuestion}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              上一题
            </button>

            {/* 查看答案 */}
            <button 
              onClick={handleSubmitAnswer}
              disabled={showExplanation || !displayQuestionAnswer}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-medium transition-colors",
                showExplanation 
                  ? "bg-slate-100 text-slate-400 cursor-default"
                  : "bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600"
              )}
            >
              {showExplanation ? '已查看' : '查看答案'}
            </button>

            {/* 下一题 / 交卷 */}
            {currentIndex >= questions.length - 1 && (!isComprehensive || !hasChildren || currentChildIndex >= (currentQuestion?.children?.length || 0) - 1) ? (
              <button 
                onClick={handleFinishAndExit}
                className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 transition-colors"
              >
                <Check className="w-4 h-4" />
                交卷
              </button>
            ) : (
              <button 
                onClick={handleNextQuestion}
                className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                下一题
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* 答题卡弹窗 */}
      <AnswerSheet
        open={showAnswerSheet}
        onOpenChange={setShowAnswerSheet}
        questions={questions}
        answers={answers}
        currentIndex={currentIndex}
        onGoToQuestion={handleGoToQuestion}
        getRecordByQuestionId={(id) => recordStore.getByQuestionId(id)}
        onSubmit={handleFinishAndExit}
      />

      {/* 交卷结果弹窗 */}
      <ResultModal
        open={showResultSheet}
        onOpenChange={setShowResultSheet}
        stats={resultStats}
        questions={questions}
        answers={answers}
        onClose={handleReturnHome}
      />
    </div>
  );
}

// 辅助函数：打乱数组
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
