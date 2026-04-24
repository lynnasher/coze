'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuiz } from '@/hooks/use-quiz';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check,
  X,
  BookOpen,
  FileText,
  FileCheck,
  Grid3X3,
  ArrowLeft,
} from 'lucide-react';
import { recordStore, wrongStreakStore, getCurrentUserId, cloudSyncService } from '@/lib/quiz-store';
import { Question } from '@/lib/types';
import { RichTextWithBreaks } from '@/lib/rich-text';
import { useDeviceValidation } from '@/hooks/use-device-validation';
import { DeviceKickedDialog } from '@/components/DeviceKickedDialog';
import Link from 'next/link';

// 题型配置常量
const QUESTION_TYPE_CONFIG = {
  single: { label: '单选题', color: 'bg-indigo-500' },
  multiple: { label: '多选题', color: 'bg-purple-500' },
  'true-false': { label: '判断题', color: 'bg-cyan-500' },
  'fill-blank': { label: '填空题', color: 'bg-teal-500' },
  comprehensive: { label: '综合题', color: 'bg-rose-500' },
} as const;

type QuestionTypeKey = keyof typeof QUESTION_TYPE_CONFIG;

// 内部组件 - 使用 useSearchParams
function QuizPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 从 URL 参数获取初始状态
  const bankId = searchParams.get('bankId') || undefined;
  const mode = (searchParams.get('mode') as 'random' | 'sequential' | 'wrong') || 'sequential';
  
  // 做题相关状态
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [showResultSheet, setShowResultSheet] = useState(false);
  const [currentChildIndex, setCurrentChildIndex] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [resultStats, setResultStats] = useState({ accuracy: 0, total: 0, correct: 0, wrong: 0, unanswered: 0 });
  
  const questionRef = useRef<HTMLDivElement>(null);
  
  // 使用 useQuiz hook
  const {
    quizState,
    isLoading,
    startQuiz,
    selectAnswer,
    submitAnswer,
    prevQuestion,
    nextQuestion,
    goToQuestion,
    resetQuiz,
    restartQuiz,
  } = useQuiz();
  
  // 初始化时开始练习
  useEffect(() => {
    if (bankId && !isLoading) {
      startQuiz(mode as 'random' | 'sequential' | 'wrong', bankId);
    }
  }, [bankId, mode, isLoading, startQuiz]);
  
  // 设备验证
  const { kicked: isKicked } = useDeviceValidation();
  
  // 计算当前显示的题目（可能是综合题的子题）
  const currentQuestion = quizState.questions[quizState.currentIndex];
  const displayQuestion = currentQuestion?.type === 'comprehensive' && currentQuestion.children?.length
    ? currentQuestion.children[currentChildIndex]
    : currentQuestion;
  
  // 当前题目的答案
  const displayQuestionAnswer = displayQuestion ? quizState.answers[displayQuestion.id] : undefined;
  
  // 计算已答题数
  const answeredCount = Object.keys(quizState.answers).filter(key => {
    const answer = quizState.answers[key];
    return answer !== undefined && answer !== '' && !(Array.isArray(answer) && answer.length === 0);
  }).length;
  
  // 计算未答题数
  const unansweredCount = quizState.questions.length - answeredCount;
  
  // 通用答案判断函数
  const isAnswerCorrect = useCallback((question: Question, answer: unknown): boolean => {
    if (!answer) return false;
    if (Array.isArray(question.answer)) {
      if (Array.isArray(answer)) {
        return answer.length === question.answer.length && 
               answer.every(a => question.answer.includes(a));
      }
      return false;
    }
    return String(answer).toLowerCase() === String(question.answer).toLowerCase();
  }, []);
  
  // 判断当前题目是否正确
  const isCurrentCorrect = displayQuestion ? isAnswerCorrect(displayQuestion, displayQuestionAnswer) : false;
  
  // 滚动到题目区域
  const scrollToQuestion = useCallback(() => {
    questionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  
  // 提交答案
  const handleSubmitAnswer = useCallback(() => {
    if (displayQuestion) {
      submitAnswer();
      setShowExplanation(true);
      setTimeout(scrollToQuestion, 100);
    }
  }, [displayQuestion, submitAnswer, scrollToQuestion]);
  
  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略当焦点在输入框时
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }
      
      // Enter - 提交答案
      if (e.key === 'Enter' && !showExplanation && displayQuestion) {
        e.preventDefault();
        handleSubmitAnswer();
      }
      
      // ArrowLeft - 上一题
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentQuestion?.type === 'comprehensive' && currentChildIndex > 0) {
          setCurrentChildIndex(prev => prev - 1);
          setShowExplanation(false);
          scrollToQuestion();
        } else if (quizState.currentIndex > 0) {
          prevQuestion();
          setShowExplanation(false);
          scrollToQuestion();
        }
      }
      
      // ArrowRight - 下一题
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentQuestion?.type === 'comprehensive' && currentQuestion.children && currentChildIndex < currentQuestion.children.length - 1) {
          setCurrentChildIndex(prev => prev + 1);
          setShowExplanation(false);
          scrollToQuestion();
        } else if (quizState.currentIndex < quizState.questions.length - 1) {
          nextQuestion();
          setShowExplanation(false);
          scrollToQuestion();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displayQuestion, showExplanation, currentQuestion, currentChildIndex, quizState.currentIndex, quizState.questions.length, handleSubmitAnswer, prevQuestion, nextQuestion, scrollToQuestion]);
  
  // 交卷
  const handleFinishAndExit = useCallback(async () => {
    // 计算结果
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    
    const allQuestions = quizState.questions.flatMap(q => {
      if (q.type === 'comprehensive' && q.children?.length) {
        return q.children;
      }
      return [q];
    });
    
    for (const q of allQuestions) {
      const answer = quizState.answers[q.id];
      if (answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
        unanswered++;
        continue;
      }
      
      // 检查是否正确
      let isCorrect = false;
      if (Array.isArray(q.answer)) {
        const userAnswer = Array.isArray(answer) ? answer.sort() : [String(answer).toLowerCase()];
        const correctAnswer = q.answer.map(a => String(a).toLowerCase()).sort();
        isCorrect = userAnswer.length === correctAnswer.length && userAnswer.every((a, i) => a === correctAnswer[i]);
      } else {
        isCorrect = String(answer).toLowerCase() === String(q.answer).toLowerCase();
      }
      
      if (isCorrect) correct++;
      else wrong++;
    }
    
    const total = allQuestions.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    
    setResultStats({ accuracy, total, correct, wrong, unanswered });
    setShowResultSheet(true);
    
    // 保存练习记录
    const userId = getCurrentUserId();
    if (userId) {
      await cloudSyncService.saveRecordsAndStreaks(
        userId,
        recordStore.getAll(),
        wrongStreakStore.getAll()
      );
    }
  }, [quizState]);
  
  // 返回首页
  const handleReturnHome = useCallback(() => {
    resetQuiz();
    router.push('/');
  }, [resetQuiz, router]);
  
  // 子组件：答题卡
  // eslint-disable-next-line react-hooks/static-components
  const AnswerSheetContent = () => (
    <div className="space-y-4">
      {['single', 'multiple', 'true-false', 'fill-blank', 'comprehensive'].map(type => {
        const typeQuestions = quizState.questions
          .map((q, idx) => ({ q, idx }))
          .filter(item => item.q.type === type);
        if (typeQuestions.length === 0) return null;
        const config = QUESTION_TYPE_CONFIG[type as QuestionTypeKey];
        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${config.color}`}></span>
              <span className="text-sm font-medium text-slate-700">{config.label}</span>
              <span className="text-xs text-slate-400">({typeQuestions.length}题)</span>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {typeQuestions.map(({ q, idx }) => {
                const answered = !!quizState.answers[q.id];
                const record = recordStore.getByQuestionId(q.id);
                const isWrong = answered && record.length > 0 && !record[record.length - 1].isCorrect;
                const isCurrent = idx === quizState.currentIndex;
                
                // 综合题显示父题和子题
                if (q.type === 'comprehensive' && q.children && q.children.length > 0) {
                  return (
                    <div key={q.id} className="flex flex-wrap gap-2">
                      <button
                        onClick={() => { goToQuestion(idx); setShowAnswerSheet(false); }}
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center ${
                          isCurrent
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                            : answered
                              ? isWrong
                                ? 'bg-red-100 text-red-700 border-2 border-red-300'
                                : 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                              : 'bg-slate-100 text-slate-600 border-2 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {idx + 1}
                      </button>
                      {q.children.map((child, childIdx) => (
                        <button
                          key={child.id}
                          onClick={() => { goToQuestion(idx); setShowAnswerSheet(false); }}
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-medium transition-all flex items-center justify-center ${
                            !!quizState.answers[child.id]
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {idx + 1}({childIdx + 1})
                        </button>
                      ))}
                    </div>
                  );
                }
                
                return (
                  <button
                    key={q.id}
                    onClick={() => { goToQuestion(idx); setShowAnswerSheet(false); }}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center ${
                      isCurrent
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                        : answered
                          ? isWrong
                            ? 'bg-red-100 text-red-700 border-2 border-red-300'
                            : 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                          : 'bg-slate-100 text-slate-600 border-2 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="grid grid-cols-2 sm:flex sm:items-center sm:gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100 gap-x-4 gap-y-1">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-gradient-to-r from-indigo-500 to-purple-500"></div>
          <span>当前</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300"></div>
          <span>正确</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
          <span>错误</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-slate-100 border border-slate-200"></div>
          <span>未答</span>
        </div>
      </div>
    </div>
  );
  
  // 子组件：交卷结果
  // eslint-disable-next-line react-hooks/static-components
  const ResultSheetContent = () => {
    const getQuestionStatus = (question: Question): { isCorrect: boolean; isWrong: boolean; isUnanswered: boolean } => {
      const answer = quizState.answers[question.id];
      const isUnanswered = answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0);
      
      let isCorrect = false;
      let isWrong = false;
      
      if (!isUnanswered) {
        const qAnswer = question.answer;
        if (question.type === 'fill-blank') {
          isCorrect = String(answer) === String(qAnswer);
        } else if (Array.isArray(qAnswer)) {
          const userAnswer = Array.isArray(answer) ? answer.sort() : [String(answer).toLowerCase()];
          const correctAnswer = qAnswer.map(a => String(a).toLowerCase()).sort();
          isCorrect = userAnswer.length === correctAnswer.length && userAnswer.every((a, i) => a === correctAnswer[i]);
        } else {
          isCorrect = String(answer).toLowerCase() === String(qAnswer).toLowerCase();
        }
        isWrong = !isCorrect;
      }
      
      return { isCorrect, isWrong, isUnanswered };
    };
    
    return (
      <>
        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl p-3 text-white text-center">
            <p className="text-2xl font-bold">{resultStats.accuracy}%</p>
            <p className="text-xs opacity-80">正确率</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl p-3 text-white text-center">
            <p className="text-2xl font-bold">{resultStats.total}</p>
            <p className="text-xs opacity-80">总题数</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl p-3 text-white text-center">
            <p className="text-2xl font-bold">{resultStats.correct}</p>
            <p className="text-xs opacity-80">做对</p>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-rose-500 rounded-xl p-3 text-white text-center">
            <p className="text-2xl font-bold">{resultStats.wrong + resultStats.unanswered}</p>
            <p className="text-xs opacity-80">错误</p>
          </div>
        </div>
        
        {/* 详细说明 */}
        <div className="text-center text-sm text-slate-500 mb-4">
          <p>做对 {resultStats.correct} 题，做错 {resultStats.wrong} 题，未答 {resultStats.unanswered} 题</p>
        </div>
        
        {/* 答题卡 */}
        <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
          {['single', 'multiple', 'true-false', 'fill-blank', 'comprehensive'].map(type => {
            const typeQuestions = quizState.questions
              .map((q, idx) => ({ q, idx }))
              .filter(item => item.q.type === type);
            if (typeQuestions.length === 0) return null;
            const config = QUESTION_TYPE_CONFIG[type as QuestionTypeKey];
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${config.color}`}></span>
                  <span className="text-sm font-medium text-slate-700">{config.label}</span>
                  <span className="text-xs text-slate-400">({typeQuestions.length}题)</span>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {typeQuestions.map(({ q, idx }) => {
                    const parentStatus = getQuestionStatus(q);
                    
                    // 综合题显示
                    if (q.type === 'comprehensive' && q.children && q.children.length > 0) {
                      return (
                        <div key={q.id} className="flex flex-wrap gap-1.5 sm:gap-2">
                          <button
                            onClick={() => {
                              setShowResultSheet(false);
                              goToQuestion(idx);
                              setShowExplanation(true);
                            }}
                            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                              parentStatus.isCorrect
                                ? 'bg-emerald-500 text-white'
                                : parentStatus.isWrong
                                  ? 'bg-red-500 text-white'
                                  : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {idx + 1}
                          </button>
                          {q.children.map((child, childIdx) => {
                            const childStatus = getQuestionStatus(child);
                            return (
                              <button
                                key={child.id}
                                onClick={() => {
                                  setShowResultSheet(false);
                                  goToQuestion(idx);
                                  setShowExplanation(true);
                                }}
                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-medium transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                                  childStatus.isCorrect
                                    ? 'bg-emerald-400 text-white'
                                    : childStatus.isWrong
                                      ? 'bg-red-400 text-white'
                                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                                }`}
                              >
                                {idx + 1}({childIdx + 1})
                              </button>
                            );
                          })}
                        </div>
                      );
                    }
                    
                    return (
                      <button
                        key={q.id}
                        onClick={() => {
                          setShowResultSheet(false);
                          goToQuestion(idx);
                          setShowExplanation(true);
                        }}
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                          parentStatus.isCorrect
                            ? 'bg-emerald-500 text-white'
                            : parentStatus.isWrong
                              ? 'bg-red-500 text-white'
                              : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* 图例 */}
        <div className="flex items-center justify-center gap-6 text-xs text-slate-500 pt-3 border-t border-slate-100 mt-4">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-emerald-500"></div>
            <span>做对</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-red-500"></div>
            <span>做错</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-slate-200"></div>
            <span>未答</span>
          </div>
        </div>
        
        {/* 底部操作区域 */}
        <div className="sticky bottom-0 bg-white pt-4 border-t border-slate-100 mt-4">
          {/* 查看错题按钮 */}
          {resultStats.wrong > 0 && (
            <Link href="/wrongbook" className="block mb-3" onClick={() => handleReturnHome()}>
              <Button className="w-full h-12 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 rounded-xl text-base font-medium shadow-lg shadow-red-500/20">
                查看错题 ({resultStats.wrong}题)
              </Button>
            </Link>
          )}
          {/* 返回首页按钮 */}
          <Button
            variant="outline"
            className="w-full h-11 rounded-xl border-slate-200 text-slate-600"
            onClick={() => { setShowResultSheet(false); handleReturnHome(); }}
          >
            返回首页
          </Button>
        </div>
      </>
    );
  };
  
  // 显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 rounded-full flex items-center justify-center animate-pulse">
            <BookOpen className="w-8 h-8 text-indigo-500" />
          </div>
          <p className="text-slate-500">正在加载题目...</p>
        </div>
      </div>
    );
  }
  
  // 题库为空时显示提示
  if (quizState.questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-200 rounded-full flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-500 mb-4">暂无题目</p>
          <Button onClick={() => router.push('/')} variant="outline" className="rounded-xl">
            返回首页
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* 设备被踢下线提示 */}
      <DeviceKickedDialog open={isKicked} onConfirm={() => router.push('/')} />
      
      {/* 顶部导航 */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-[970px] mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReturnHome}
            className="gap-1.5 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>退出</span>
          </Button>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAnswerSheet(true)}
              className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                >
                  <FileCheck className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl w-[calc(100%-2rem)] max-w-sm mx-auto">
                <AlertDialogHeader className="space-y-3">
                  <AlertDialogTitle className="text-lg">确认交卷</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2.5 text-sm">
                    <span className="block">确定要提交所有答案吗？提交后将无法修改答案。</span>
                    {unansweredCount > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
                        <div className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0"></div>
                        <span className="text-amber-700 font-medium">
                          还有 {unansweredCount} 题未作答
                        </span>
                      </div>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 sm:gap-0">
                  <AlertDialogCancel className="flex-1 sm:flex-none">取消</AlertDialogCancel>
                  <AlertDialogAction onClick={handleFinishAndExit} className="flex-1 sm:flex-none">
                    确认交卷
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
      
      {/* 进度条 */}
      <div className="bg-white border-b border-slate-100 px-4 py-2">
        <div className="max-w-[970px] mx-auto">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>进度</span>
            <span>{answeredCount}/{quizState.questions.length}</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / quizState.questions.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* 题目区域 */}
      <div ref={questionRef} className="max-w-[970px] mx-auto px-3 sm:px-4 py-4 pb-28">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* 题目头部 */}
          <div className="sm:px-4 px-3 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold text-white ${QUESTION_TYPE_CONFIG[displayQuestion?.type as QuestionTypeKey]?.color || 'bg-slate-400'}`}>
                {displayQuestion?.type === 'single' ? '单选题' :
                 displayQuestion?.type === 'multiple' ? '多选题' :
                 displayQuestion?.type === 'true-false' ? '判断题' :
                 displayQuestion?.type === 'comprehensive' ? '综合题' : '填空题'}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {currentQuestion?.type === 'comprehensive' && currentQuestion.children && currentQuestion.children.length > 0 ? (
                  <>子题 {currentChildIndex + 1}/{currentQuestion.children.length}</>
                ) : (
                  <>第 {quizState.currentIndex + 1} 题</>
                )}
              </span>
            </div>
          </div>
          
          {/* 案例背景 */}
          {currentQuestion?.caseBackground && (
            <div className="sm:mx-4 mx-3 mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-indigo-700 leading-relaxed flex-1 font-medium">
                  <RichTextWithBreaks content={currentQuestion.caseBackground} textClassName="whitespace-pre-wrap" />
                </div>
              </div>
            </div>
          )}
          
          {/* 题目内容 */}
          <div className="sm:px-4 px-3 py-3">
            <div className="text-base font-medium text-slate-800 leading-relaxed">
              <RichTextWithBreaks content={displayQuestion?.content || ''} textClassName="whitespace-pre-wrap" />
            </div>
          </div>
          
          {/* 分隔线 */}
          <div className="sm:mx-4 mx-3 h-px bg-slate-100" />
          
          {/* 选项区域 */}
          <div className="sm:px-4 px-3 pb-4">
            {/* 填空题 */}
            {displayQuestion?.type === 'fill-blank' && (
              <div className="space-y-2">
                <Textarea
                  placeholder="输入你的答案..."
                  value={(displayQuestionAnswer as string) || ''}
                  onChange={(e) => {
                    if (displayQuestion) {
                      selectAnswer(displayQuestion.id, e.target.value);
                    }
                  }}
                  disabled={showExplanation}
                  className="min-h-[80px] rounded-xl border-2 border-slate-200 focus:border-blue-300 bg-white text-sm"
                />
              </div>
            )}
            
            {/* 其他题型 */}
            {displayQuestion?.type !== 'fill-blank' && (
              <div className="space-y-2">
                {displayQuestion?.options?.map((option, index) => {
                  const isMulti = displayQuestion.type === 'multiple';
                  const isSelected = isMulti
                    ? Array.isArray(displayQuestionAnswer) && displayQuestionAnswer.includes(option.id)
                    : displayQuestionAnswer === option.id;
                  const isCorrectAnswer = Array.isArray(displayQuestion.answer)
                    ? displayQuestion.answer.includes(option.id)
                    : displayQuestion.answer === option.id;
                  
                  let optionStyle = 'bg-slate-50/50';
                  if (isSelected && showExplanation) {
                    optionStyle = isCorrectAnswer ? 'bg-emerald-50' : 'bg-red-50';
                  } else if (isSelected) {
                    optionStyle = 'bg-indigo-50';
                  } else if (showExplanation && isCorrectAnswer) {
                    optionStyle = 'bg-emerald-50';
                  }
                  
                  const handleOptionClick = () => {
                    if (showExplanation || !displayQuestion) return;
                    if (isMulti) {
                      const current = Array.isArray(displayQuestionAnswer) ? displayQuestionAnswer : [];
                      if (current.includes(option.id)) {
                        selectAnswer(displayQuestion.id, current.filter(id => id !== option.id));
                      } else {
                        selectAnswer(displayQuestion.id, [...current, option.id]);
                      }
                    } else {
                      selectAnswer(displayQuestion.id, option.id);
                    }
                  };
                  
                  return (
                    <div
                      key={option.id}
                      role="button"
                      tabIndex={showExplanation ? -1 : 0}
                      aria-pressed={isSelected}
                      aria-disabled={showExplanation}
                      aria-label={`选项${String.fromCharCode(65 + index)}: ${option.text}${isSelected ? '，已选择' : ''}${showExplanation && isCorrectAnswer ? '，正确答案' : ''}${showExplanation && isSelected && !isCorrectAnswer ? '，错误答案' : ''}`}
                      className={`flex items-center p-3 rounded-lg transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${showExplanation ? 'cursor-default' : 'cursor-pointer'} ${optionStyle}`}
                      onClick={handleOptionClick}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !showExplanation) {
                          e.preventDefault();
                          handleOptionClick();
                        }
                      }}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 font-bold text-xs transition-colors flex-shrink-0 ${
                        isSelected && showExplanation
                          ? isCorrectAnswer
                            ? 'bg-emerald-500 text-white'
                            : 'bg-red-500 text-white'
                          : isSelected
                            ? 'bg-indigo-500 text-white'
                            : 'bg-slate-200 text-slate-600'
                      }`}>
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          String.fromCharCode(65 + index)
                        )}
                      </div>
                      <div className="flex-1 text-sm font-medium text-slate-700">
                        <RichTextWithBreaks content={option.text} textClassName="whitespace-pre-wrap" />
                      </div>
                      {showExplanation && isCorrectAnswer && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center ml-2">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {showExplanation && isSelected && !isCorrectAnswer && (
                        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center ml-2">
                          <X className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* 答案与解析 */}
          {showExplanation && (
            <div className="sm:px-4 px-3 pb-4 space-y-3">
              <div className={`rounded-xl p-3.5 ${isCurrentCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isCurrentCorrect ? 'bg-emerald-500' : 'bg-red-500'}`}>
                      {isCurrentCorrect ? <Check className="w-5 h-5 text-white" /> : <X className="w-5 h-5 text-white" />}
                    </div>
                    <span className={`text-sm font-bold ${isCurrentCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                      {isCurrentCorrect ? '太棒了！' : '再接再厉！'}
                    </span>
                  </div>
                  <div className="bg-white rounded-lg px-2.5 py-1">
                    <span className="text-xs text-slate-500">答案</span>
                    <span className="text-sm font-bold text-emerald-600 ml-1.5">
                      {Array.isArray(displayQuestion?.answer) 
                        ? displayQuestion.answer.map(a => a.toUpperCase()).join(', ')
                        : displayQuestion?.answer?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              
              {displayQuestion?.explanation && (
                <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-200">
                  <div className="flex items-center gap-2 text-amber-700 mb-2">
                    <BookOpen className="w-4 h-4" />
                    <span className="font-semibold text-sm">解析</span>
                  </div>
                  <div className="text-amber-900 text-sm leading-relaxed">
                    <RichTextWithBreaks content={displayQuestion.explanation} textClassName="whitespace-pre-wrap" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* 底部固定操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-4 py-3 z-30">
        <div className="max-w-[970px] mx-auto">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (currentQuestion?.type === 'comprehensive' && currentChildIndex > 0) {
                  setCurrentChildIndex(prev => prev - 1);
                  setShowExplanation(false);
                  setTimeout(scrollToQuestion, 50);
                } else if (quizState.currentIndex > 0) {
                  prevQuestion();
                  setShowExplanation(false);
                  setTimeout(scrollToQuestion, 50);
                }
              }}
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
            
            <Button
              variant="outline"
              onClick={handleSubmitAnswer}
              className="h-11 px-6 rounded-xl border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold shadow-sm"
            >
              <BookOpen className="w-4 h-4" />
              <span className="ml-1.5 text-sm">查看答案</span>
            </Button>
            
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
                    onClick={() => {
                      nextQuestion();
                      setShowExplanation(false);
                      setTimeout(scrollToQuestion, 50);
                    }}
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
      <Dialog open={showAnswerSheet} onOpenChange={setShowAnswerSheet}>
        <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[80vh] overflow-y-auto rounded-2xl p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Grid3X3 className="w-4 h-4 text-white" />
              </div>
              <span>答题卡</span>
            </DialogTitle>
          </DialogHeader>
          {/* eslint-disable-next-line react-hooks/static-components */}
          <AnswerSheetContent />
        </DialogContent>
      </Dialog>
      
      {/* 交卷结果弹窗 */}
      <Dialog open={showResultSheet} onOpenChange={(open) => {
        setShowResultSheet(open);
        if (!open) {
          handleReturnHome();
        }
      }}>
        <DialogContent className="max-w-[90vw] sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-5">
          <DialogHeader className="pb-3 text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
              <FileCheck className="w-8 h-8 text-white" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-800">答题完成</DialogTitle>
          </DialogHeader>
          {/* eslint-disable-next-line react-hooks/static-components */}
          <ResultSheetContent />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 包装组件 - 使用 Suspense 处理 useSearchParams
export default function QuizPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500">加载中...</p>
        </div>
      </div>
    }>
      <QuizPageContent />
    </Suspense>
  );
}
