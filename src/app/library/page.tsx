'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  BookOpen,
  ArrowLeft,
  Settings,
  User,
  Library,
  RefreshCw,
  Grid3X3,
  FileCheck,
  FileText,
  Loader2,
  Folder,
  FolderOpen,
  Trophy,
} from 'lucide-react';
import { questionStore, recordStore, wrongStreakStore, getWrongQuestionIds } from '@/lib/quiz-store';
import { Question, QuestionType, QuestionBank } from '@/lib/types';
import { BankCard } from '@/components/BankCard';
import { AuthModal, UserStatus, getCurrentUser as getStoredUser } from '@/components/AuthModal';
import { RichTextWithBreaks } from '@/lib/rich-text';
import { useQuiz } from '@/hooks/use-quiz';
import { useDeviceValidation } from '@/hooks/use-device-validation';
import { DeviceKickedDialog } from '@/components/DeviceKickedDialog';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ==================== 类型定义 ====================

interface QuestionStats {
  total: number;
  todayNew: number;
  mastered: number;
  practiceCount: number;
  accuracy: number;
}

// ==================== 组件Props定义 ====================

interface PracticeViewProps {
  onExit: () => void;
}

interface TabItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge?: string | number;
  as?: 'button' | 'link';
  href?: string;
}

// ==================== 主要组件 ====================

export default function LibraryPage() {
  // ==================== 状态定义 ====================
  
  // 用户状态
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    phone: string;
    nickname?: string;
    role?: string;
    activatedCategories?: string[];
    deviceId?: string;
  } | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  
  // 做题状态
  const [isPracticing, setIsPracticing] = useState(false);
  const [practiceMode, setPracticeMode] = useState<'sequential' | 'random' | 'wrong'>('sequential');
  const [practiceBankId, setPracticeBankId] = useState<string | null>(null);
  
  // 题库数据
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [categories, setCategories] = useState<{id: string; name: string; color: string; parentId?: string}[]>([]);
  
  // 分类选择
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  // 做题相关状态
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [showResultSheet, setShowResultSheet] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  
  // 触摸滑动
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const questionContentRef = useRef<HTMLDivElement>(null);
  
  // 设备验证
  const { kicked, kickMessage, clearKickState } = useDeviceValidation({
    interval: 30000,
    validateOnFocus: true,
  });
  
  // 加载状态
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  
  // 统计数据
  const [questionStats, setQuestionStats] = useState<QuestionStats>({
    total: 0,
    todayNew: 0,
    mastered: 0,
    practiceCount: 0,
    accuracy: 0,
  });
  
  // ==================== 数据加载 ====================
  
  // 加载题库数据
  const loadBanks = useCallback(async () => {
    setIsLoadingBanks(true);
    try {
      const response = await fetch('/api/banks');
      const data = await response.json();
      if (data.banks) {
        setBanks(data.banks);
      }
    } catch (error) {
      console.error('加载题库失败:', error);
    } finally {
      setIsLoadingBanks(false);
    }
  }, []);

  // 加载分类数据
  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  }, []);

  // 加载用户数据
  const loadUserData = useCallback(async () => {
    const user = getStoredUser();
    if (user) {
      setCurrentUser(user);
      
      // 获取用户激活的分类
      try {
        const token = localStorage.getItem('quiz_user_token');
        if (token) {
          const response = await fetch('/api/auth/user/activations', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setCurrentUser(prev => prev ? {
              ...prev,
              activatedCategories: data.activatedCategories || []
            } : null);
          }
        }
      } catch (error) {
        console.error('获取激活分类失败:', error);
      }
    }
  }, []);

  // 计算统计数据
  const calculateStats = useCallback(() => {
    const records = recordStore.getAll();
    const wrongIds = getWrongQuestionIds();
    
    // 总错题数
    const totalWrong = wrongIds.length;
    
    // 今日新增错题
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    const todayNew = records.filter(r => !r.isCorrect && r.timestamp >= todayTimestamp).length;
    
    // 已掌握的错题（连续答对3次）
    let mastered = 0;
    wrongIds.forEach(id => {
      const streak = wrongStreakStore.get(id) || 0;
      if (streak >= 3) mastered++;
    });
    
    // 总练习次数和正确率
    const totalPractice = records.length;
    const correctCount = records.filter(r => r.isCorrect).length;
    const accuracy = totalPractice > 0 ? Math.round((correctCount / totalPractice) * 100) : 0;
    
    setQuestionStats({
      total: totalWrong,
      todayNew,
      mastered,
      practiceCount: totalPractice,
      accuracy,
    });
  }, []);

  // 初始化加载
  useEffect(() => {
    loadBanks();
    loadCategories();
    loadUserData();
    calculateStats();
  }, [loadBanks, loadCategories, loadUserData, calculateStats]);

  // 用户登录状态变化时重新加载数据
  useEffect(() => {
    if (currentUser) {
      loadBanks();
      loadCategories();
      calculateStats();
    }
  }, [currentUser, loadBanks, loadCategories, calculateStats]);

  // ==================== 事件处理 ====================
  
  // 开始做题
  const startQuiz = useCallback(async (mode: 'sequential' | 'random' | 'wrong', bankId?: string) => {
    let questions: Question[] = [];
    let targetBankId = bankId || practiceBankId;
    
    if (mode === 'wrong') {
      // 错题模式
      const wrongIds = getWrongQuestionIds();
      const allQuestions = questionStore.getAll();
      questions = wrongIds.map(id => allQuestions.find(q => q.id === id)).filter(Boolean) as Question[];
    } else if (targetBankId) {
      // 指定题库
      try {
        const response = await fetch(`/api/admin/banks/${targetBankId}/questions`);
        const data = await response.json();
        questions = data.questions || [];
      } catch (error) {
        console.error('加载题目失败:', error);
        return;
      }
    } else {
      // 所有题目
      questions = questionStore.getAll();
    }
    
    if (questions.length === 0) {
      alert('该题库暂无题目');
      return;
    }
    
    // 随机模式打乱顺序
    if (mode === 'random') {
      questions = [...questions].sort(() => Math.random() - 0.5);
    }
    
    setSelectedQuestions(questions);
    setPracticeMode(mode);
    setIsPracticing(true);
    setShowExplanation(false);
    
    // 清空之前的答题记录
    recordStore.clear();
    
    // 滚动到顶部
    if (questionContentRef.current) {
      questionContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [practiceBankId]);

  // 本地答案状态
  const [localAnswers, setLocalAnswers] = useState<Record<string, string | string[]>>({});
  const [localCurrentIndex, setLocalCurrentIndex] = useState(0);
  const [localShowResult, setLocalShowResult] = useState(false);

  // 获取当前题目
  const currentQuestion = useMemo(() => {
    if (selectedQuestions.length === 0) return null;
    return selectedQuestions[localCurrentIndex] || null;
  }, [selectedQuestions, localCurrentIndex]);

  // 获取当前答案
  const currentAnswer = useMemo(() => {
    if (!currentQuestion) return undefined;
    return localAnswers[currentQuestion.id];
  }, [currentQuestion, localAnswers]);

  // 选择答案
  const selectAnswer = useCallback((questionId: string, answer: string | string[]) => {
    setLocalAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
  }, []);

  // 上一题/下一题
  const goToQuestion = useCallback((index: number) => {
    setLocalCurrentIndex(index);
    setShowExplanation(false);
    setShowAnswerSheet(false);
    
    // 滚动到题目内容
    setTimeout(() => {
      if (questionContentRef.current) {
        questionContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }, []);

  // 上一题
  const prevQuestion = useCallback(() => {
    if (localCurrentIndex > 0) {
      setLocalCurrentIndex(localCurrentIndex - 1);
      setShowExplanation(false);
      setTimeout(() => {
        if (questionContentRef.current) {
          questionContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [localCurrentIndex]);

  // 下一题
  const nextQuestion = useCallback(() => {
    if (localCurrentIndex < selectedQuestions.length - 1) {
      setLocalCurrentIndex(localCurrentIndex + 1);
      setShowExplanation(false);
      setTimeout(() => {
        if (questionContentRef.current) {
          questionContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [localCurrentIndex, selectedQuestions.length]);

  // 检查答案
  const isAnswerCorrect = useMemo(() => {
    if (!currentQuestion || !currentAnswer) return false;
    const correctAnswer = currentQuestion.answer;
    
    if (Array.isArray(correctAnswer)) {
      if (!Array.isArray(currentAnswer)) return false;
      const sortedUser = [...currentAnswer].sort();
      const sortedCorrect = [...correctAnswer].sort();
      return sortedUser.length === sortedCorrect.length && sortedUser.every((a, i) => a === sortedCorrect[i]);
    }
    
    if (currentQuestion.type === 'fill-blank') {
      return String(currentAnswer).trim() === String(correctAnswer).trim();
    }
    
    return String(currentAnswer).toLowerCase() === String(correctAnswer).toLowerCase();
  }, [currentQuestion, currentAnswer]);

  // 提交答案
  const submitAnswer = useCallback(() => {
    setShowExplanation(true);
    setLocalShowResult(true);
    
    if (!currentQuestion) return;
    
    const userAnswer = localAnswers[currentQuestion.id];
    const isCorrect = isAnswerCorrect;
    
    // 记录答案
    recordStore.add({
      id: `record_${Date.now()}`,
      questionId: currentQuestion.id,
      isCorrect,
      selectedAnswer: userAnswer || '',
      timestamp: Date.now(),
    });
    
    // 错题处理
    if (!isCorrect) {
      const streaks = wrongStreakStore.getAll();
      wrongStreakStore.save({ ...streaks, [currentQuestion.id]: 0 });
    } else {
      const streaks = wrongStreakStore.getAll();
      const currentStreak = streaks[currentQuestion.id] || 0;
      wrongStreakStore.save({ ...streaks, [currentQuestion.id]: currentStreak + 1 });
    }
  }, [currentQuestion, localAnswers, isAnswerCorrect]);

  // 交卷
  const handleFinishAndExit = useCallback(() => {
    setShowAnswerSheet(false);
    setShowResultSheet(true);
    setLocalShowResult(true);
  }, []);

  // 重置练习
  const resetQuiz = useCallback(() => {
    setIsPracticing(false);
    setSelectedQuestions([]);
    setLocalAnswers({});
    setLocalCurrentIndex(0);
    setLocalShowResult(false);
    setShowExplanation(false);
    setShowAnswerSheet(false);
    setShowResultSheet(false);
  }, []);

  // 计算答题结果统计
  const resultStats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    
    selectedQuestions.forEach(q => {
      const answer = localAnswers[q.id];
      
      const isUnanswered = 
        answer === undefined || 
        answer === '' || 
        answer === null ||
        (Array.isArray(answer) && answer.length === 0);
      
      if (isUnanswered) {
        unanswered++;
      } else {
        const qAnswer = q.answer;
        
        if (Array.isArray(qAnswer)) {
          const userAnswer = Array.isArray(answer) ? answer.sort() : [String(answer).toLowerCase()];
          const correctAnswer = qAnswer.map(a => String(a).toLowerCase()).sort();
          const isCorrect = userAnswer.length === correctAnswer.length && userAnswer.every((a, i) => a === correctAnswer[i]);
          if (isCorrect) correct++; else wrong++;
        } else if (q.type === 'fill-blank') {
          if (String(answer) === String(qAnswer)) correct++; else wrong++;
        } else {
          if (String(answer).toLowerCase() === String(qAnswer).toLowerCase()) correct++; else wrong++;
        }
      }
    });
    
    const total = selectedQuestions.length;
    const accuracy = total > 0 && (correct + wrong) > 0 ? Math.round((correct / (correct + wrong + unanswered)) * 100) : (total > 0 ? Math.round((correct / total) * 100) : 0);
    
    return { correct, wrong, unanswered, total, accuracy };
  }, [selectedQuestions, localAnswers]);

  // 进度
  const progressPercent = useMemo(() => {
    if (selectedQuestions.length === 0) return 0;
    const answered = selectedQuestions.filter(q => localAnswers[q.id] !== undefined).length;
    return Math.round((answered / selectedQuestions.length) * 100);
  }, [selectedQuestions, localAnswers]);

  // 获取答题记录
  const getRecordByQuestionId = (questionId: string) => {
    return recordStore.getAll().filter(r => r.questionId === questionId);
  };

  // 处理被踢下线
  const handleKicked = useCallback(() => {
    setCurrentUser(null);
    clearKickState();
    window.location.reload();
  }, [clearKickState]);

  // 退出做题
  const handleExitPractice = useCallback(() => {
    setIsPracticing(false);
    setSelectedQuestions([]);
    setShowExplanation(false);
    setShowAnswerSheet(false);
    setShowResultSheet(false);
    
    // 重新计算统计
    calculateStats();
  }, [calculateStats]);

  // 返回首页
  const handleReturnHome = useCallback(() => {
    handleExitPractice();
  }, [handleExitPractice]);

  // 触摸滑动处理
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    handleSwipe();
  };

  const handleSwipe = () => {
    const swipeThreshold = 50;
    const diff = touchStartX.current - touchEndX.current;
    
    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0 && localCurrentIndex < selectedQuestions.length - 1) {
        // 左滑 - 下一题
        nextQuestion();
      } else if (diff < 0 && localCurrentIndex > 0) {
        // 右滑 - 上一题
        prevQuestion();
      }
    }
  };

  // 题目切换动画
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);


  // ==================== 做题页面 ====================
  
  if (isPracticing) {
    if (!currentQuestion) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
          <p className="text-slate-500">加载中...</p>
        </div>
      );
    }
    
    // 获取当前题目的答案
    const currentAnswerForDisplay = localAnswers[currentQuestion.id];
    const isCurrentCorrect = currentAnswerForDisplay !== undefined && isAnswerCorrect;
    
    // 判断题型
    const isMulti = currentQuestion.type === 'multiple';
    const isFillBlank = currentQuestion.type === 'fill-blank';
    const isComprehensive = currentQuestion.type === 'comprehensive';
    const isTrueFalse = currentQuestion.type === 'true-false';
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
        {/* 顶部导航 */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm">
          <div className="max-w-[970px] mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <button
                onClick={handleExitPractice}
                className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">返回</span>
              </button>
              
              <span className="text-sm text-slate-500 font-medium">
                {localCurrentIndex + 1} / {selectedQuestions.length}
              </span>
              
              <button
                onClick={() => setShowAnswerSheet(true)}
                className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <Grid3X3 className="w-4 h-4" />
                <span className="text-sm font-medium">答题卡</span>
              </button>
            </div>
            
            {/* 进度条 */}
            <div className="mt-2.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
        
        {/* 题目内容区域 */}
        <div 
          className="flex-1 overflow-y-auto pb-28"
          ref={questionContentRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="max-w-[970px] mx-auto sm:px-4 py-3">
            {/* 题目卡片 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              {/* 题干头部 */}
              <div className="sm:px-4 px-3 py-2.5 border-b border-slate-50 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold text-white ${
                    currentQuestion.type === 'single' ? 'bg-indigo-500' :
                    currentQuestion.type === 'multiple' ? 'bg-purple-500' :
                    currentQuestion.type === 'true-false' ? 'bg-cyan-500' :
                    currentQuestion.type === 'comprehensive' ? 'bg-rose-500' :
                    'bg-teal-500'
                  }`}>
                    {currentQuestion.type === 'single' ? '单选题' :
                     currentQuestion.type === 'multiple' ? '多选题' :
                     currentQuestion.type === 'true-false' ? '判断题' :
                     currentQuestion.type === 'comprehensive' ? '综合题' : '填空题'}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    第 {localCurrentIndex + 1} 题
                  </span>
                </div>
              </div>
              
              {/* 案例背景（综合题显示） */}
              {currentQuestion.caseBackground && (
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
                  <RichTextWithBreaks content={currentQuestion.content || ''} textClassName="whitespace-pre-wrap" />
                </div>
              </div>
              
              {/* 分隔线 */}
              <div className="sm:mx-4 mx-3 h-px bg-slate-100" />
              
              {/* 选项区域 */}
              <div className="sm:px-4 px-3 pb-4">
                {/* 填空题输入框 */}
                {isFillBlank && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="输入你的答案..."
                      value={(currentAnswer as string) || ''}
                      onChange={(e) => selectAnswer(currentQuestion.id, e.target.value)}
                      disabled={showExplanation}
                      className="min-h-[80px] rounded-xl border-2 border-slate-200 focus:border-blue-300 bg-white text-sm"
                    />
                  </div>
                )}

                {/* 其他题型选项 */}
                {!isFillBlank && (
                  <div className="space-y-2">
                    {currentQuestion.options?.map((option, index) => {
                      const isSelected = isMulti
                        ? Array.isArray(currentAnswer) && currentAnswer.includes(option.id)
                        : currentAnswer === option.id;
                      const isCorrectAnswer = Array.isArray(currentQuestion.answer)
                        ? currentQuestion.answer.includes(option.id)
                        : currentQuestion.answer === option.id;
                      
                      let optionStyle = 'bg-slate-50/50';
                      if (isSelected && showExplanation) {
                        optionStyle = isCorrectAnswer ? 'bg-emerald-50' : 'bg-red-50';
                      } else if (isSelected) {
                        optionStyle = 'bg-indigo-50';
                      } else if (showExplanation && isCorrectAnswer) {
                        optionStyle = 'bg-emerald-50';
                      }
                      
                      const handleOptionClick = () => {
                        if (showExplanation) return;
                        if (isMulti) {
                          const current = Array.isArray(currentAnswer) ? currentAnswer : [];
                          if (current.includes(option.id)) {
                            selectAnswer(currentQuestion.id, current.filter(id => id !== option.id));
                          } else {
                            selectAnswer(currentQuestion.id, [...current, option.id]);
                          }
                        } else {
                          selectAnswer(currentQuestion.id, option.id);
                        }
                      };
                      
                      return (
                        <div
                          key={option.id}
                          className={`flex items-center p-3 rounded-lg transition-all duration-200 cursor-pointer ${optionStyle}`}
                          onClick={handleOptionClick}
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
                          {Array.isArray(currentQuestion.answer) 
                            ? currentQuestion.answer.map(a => a.toUpperCase()).join(', ')
                            : currentQuestion.answer?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {currentQuestion.explanation && (
                    <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-200">
                      <div className="flex items-center gap-2 text-amber-700 mb-2">
                        <BookOpen className="w-4 h-4" />
                        <span className="font-semibold text-sm">解析</span>
                      </div>
                      <div className="text-amber-900 text-sm leading-relaxed">
                        <RichTextWithBreaks content={currentQuestion.explanation} textClassName="whitespace-pre-wrap" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* 底部操作栏 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/50 shadow-lg z-20">
          <div className="max-w-[970px] mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => goToQuestion(localCurrentIndex - 1)}
                disabled={localCurrentIndex === 0}
                className="flex-1 h-11 rounded-xl"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                上一题
              </Button>
              
              {!showExplanation ? (
                <Button
                  onClick={submitAnswer}
                  disabled={currentAnswer === undefined || (Array.isArray(currentAnswer) && currentAnswer.length === 0)}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                >
                  查看答案
                </Button>
              ) : (
                <Button
                  onClick={() => goToQuestion(localCurrentIndex + 1)}
                  disabled={localCurrentIndex >= selectedQuestions.length - 1}
                  className="flex-1 h-11 rounded-xl"
                >
                  下一题
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
            
            {localCurrentIndex >= selectedQuestions.length - 1 && showExplanation && (
              <Button
                onClick={handleFinishAndExit}
                className="w-full mt-2 h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
              >
                <FileCheck className="w-4 h-4 mr-2" />
                交卷
              </Button>
            )}
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
            <div className="space-y-4">
              {['single', 'multiple', 'true-false', 'fill-blank', 'comprehensive'].map(type => {
                const typeQuestions = selectedQuestions
                  .map((q, idx) => ({ q, idx }))
                  .filter(item => item.q.type === type);
                if (typeQuestions.length === 0) return null;
                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${
                        type === 'single' ? 'bg-indigo-500' : 
                        type === 'multiple' ? 'bg-purple-500' : 
                        type === 'true-false' ? 'bg-cyan-500' : 
                        type === 'fill-blank' ? 'bg-teal-500' : 'bg-rose-500'
                      }`}></span>
                      <span className="text-sm font-medium text-slate-700">
                        {type === 'single' ? '单选题' : 
                         type === 'multiple' ? '多选题' : 
                         type === 'true-false' ? '判断题' : 
                         type === 'fill-blank' ? '填空题' : '综合题'}
                      </span>
                      <span className="text-xs text-slate-400">({typeQuestions.length}题)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {typeQuestions.map(({ q, idx }) => {
                        const answered = !!localAnswers[q.id];
                        return (
                          <button
                            key={q.id}
                            onClick={() => goToQuestion(idx)}
                            className={`w-9 h-9 rounded-xl text-sm font-bold transition-all flex items-center justify-center ${
                              idx === localCurrentIndex
                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                                : answered
                                  ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
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
            </div>
          </DialogContent>
        </Dialog>
        
        {/* 交卷结果弹窗 */}
        <Dialog open={showResultSheet} onOpenChange={(open) => {
          setShowResultSheet(open);
          if (!open) handleReturnHome();
        }}>
          <DialogContent className="max-w-[90vw] sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-5">
            <DialogHeader className="pb-3 text-center">
              <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                <FileCheck className="w-8 h-8 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold text-slate-800">答题完成</DialogTitle>
            </DialogHeader>
            
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
            
            <div className="text-center text-sm text-slate-500 mb-4">
              <p>做对 {resultStats.correct} 题，做错 {resultStats.wrong} 题，未答 {resultStats.unanswered} 题</p>
            </div>
            
            <Button
              onClick={handleReturnHome}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold"
            >
              返回首页
            </Button>
          </DialogContent>
        </Dialog>
        
        {/* 设备被踢下线提示 */}
        <DeviceKickedDialog
          open={kicked}
          message={kickMessage}
          onConfirm={handleKicked}
        />
      </div>
    );
  }

  // ==================== 题库浏览页面 ====================
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部区域 */}
      <header className="bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-[970px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* 产品标识 */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-md">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900">智能刷题</h1>
                <p className="text-[10px] text-gray-400 -mt-0.5">高效备考</p>
              </div>
            </div>
            
            {/* 用户信息 */}
            <div className="flex items-center gap-2">
              {currentUser?.role === 'admin' && (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="rounded-xl gap-1 border-orange-200 text-orange-600 hover:bg-orange-50">
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline">管理</span>
                  </Button>
                </Link>
              )}
              <UserStatus />
            </div>
          </div>
        </div>
      </header>
      
      {/* 主内容区域 */}
      <div className="max-w-[970px] mx-auto px-4 py-4">
        {/* 页面标题区块 */}
        <div className="mb-5 relative overflow-hidden">
          <div className="bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 rounded-2xl p-4 shadow-sm">
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/30 rounded-full"></div>
            <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/30 rounded-full"></div>
            
            <div className="relative flex items-center gap-3">
              <div className="w-10 h-10 bg-white/60 backdrop-blur rounded-xl flex items-center justify-center shadow-sm">
                <Library className="w-5 h-5 text-slate-600" />
              </div>
              
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-slate-700 tracking-tight">题库浏览</h1>
                <p className="text-slate-500 text-xs mt-0.5">选择分类开始练习</p>
              </div>
              
              {currentUser && (
                <div className="px-2.5 py-1 bg-white/50 backdrop-blur rounded-full">
                  <span className="text-slate-600 text-xs font-medium">
                    {currentUser.activatedCategories?.length || 0} 个分类
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* 未登录提示 */}
        {!currentUser && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-200 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900">登录后查看已激活的题库</h4>
                <p className="text-xs text-gray-600 mt-0.5">请先登录以查看和练习题库</p>
              </div>
              <Button 
                size="sm" 
                className="rounded-xl bg-blue-600 hover:bg-blue-700"
                onClick={() => setAuthModalOpen(true)}
              >
                登录
              </Button>
            </div>
          </div>
        )}
        
        {/* 已登录但无激活分类提示 */}
        {currentUser && (currentUser.activatedCategories?.length === 0) && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-200 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900">暂无激活的题库分类</h4>
                <p className="text-xs text-gray-600 mt-0.5">请联系管理员获取激活码来解锁题库</p>
              </div>
            </div>
          </div>
        )}

        {/* 题库列表 */}
        <div className="space-y-3">
          {banks.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
              <div className="w-14 h-14 mx-auto mb-3 bg-gray-50 rounded-2xl flex items-center justify-center">
                <Library className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm text-gray-500 font-medium">暂无题库</p>
              <p className="text-xs text-gray-400 mt-1">请联系管理员导入</p>
            </div>
          ) : (
            <>
              {/* 未分类题库 */}
              {banks.filter(b => !b.categoryId).length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                    <FolderOpen className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-700">未分类</h3>
                    <span className="text-xs text-slate-400 ml-auto">({banks.filter(b => !b.categoryId).length} 题库)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {banks.filter(b => !b.categoryId).map((bank) => (
                      <BankCard 
                        key={bank.id} 
                        bank={bank} 
                        onStartPractice={(bankId) => {
                          if (!currentUser) {
                            setAuthModalOpen(true);
                            return;
                          }
                          setPracticeBankId(bankId);
                          startQuiz('sequential', bankId);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* 按分类显示题库 */}
              {(() => {
                if (!currentUser) return null;
                
                const activatedCategoryIds = currentUser.activatedCategories || [];
                const activatedCategories = categories.filter(c => 
                  activatedCategoryIds.includes(c.id)
                );
                
                if (activatedCategories.length === 0) return null;
                
                const topCategories = activatedCategories.filter(c => !c.parentId);
                const childCategories = activatedCategories.filter(c => c.parentId);
                
                const childCategoriesByParent = new Map<string, typeof childCategories>();
                childCategories.forEach(cat => {
                  const parentId = cat.parentId!;
                  if (!childCategoriesByParent.has(parentId)) {
                    childCategoriesByParent.set(parentId, []);
                  }
                  childCategoriesByParent.get(parentId)!.push(cat);
                });
                
                return (
                  <>
                    {/* 子分类 */}
                    {Array.from(childCategoriesByParent.entries()).map(([parentId, children]) => {
                      const parentCategory = categories.find(c => c.id === parentId);
                      return (
                        <div key={`parent-${parentId}`} className="mb-4">
                          {parentCategory && (
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                              <Folder className="w-4 h-4 text-slate-400" />
                              <span className="text-sm font-semibold text-slate-700">
                                {parentCategory.name}
                              </span>
                            </div>
                          )}
                          <div className="space-y-2">
                            {children.map(category => {
                              const categoryBanks = banks.filter(b => b.categoryId === category.id);
                              if (categoryBanks.length === 0) return null;
                              
                              return (
                                <div key={category.id} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
                                  <div 
                                    className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-3 -m-2 rounded-xl transition-all duration-200"
                                    onClick={() => setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)}
                                  >
                                    {selectedCategoryId === category.id ? (
                                      <FolderOpen className="w-4 h-4 text-slate-500" />
                                    ) : (
                                      <Folder className="w-4 h-4 text-slate-400" />
                                    )}
                                    <span className="text-sm font-medium text-slate-700 flex-1">
                                      {category.name}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                      {categoryBanks.length} 个题库
                                    </span>
                                    <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${selectedCategoryId === category.id ? 'rotate-90' : ''}`} />
                                  </div>
                                
                                  {selectedCategoryId === category.id && (
                                    <div className="mt-3 space-y-3 pl-2">
                                      {categoryBanks.map(bank => (
                                        <BankCard
                                          key={bank.id}
                                          bank={bank}
                                          onStartPractice={(bankId) => {
                                            if (!currentUser) {
                                              setAuthModalOpen(true);
                                              return;
                                            }
                                            setPracticeBankId(bankId);
                                            startQuiz('sequential', bankId);
                                          }}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* 顶级分类 */}
                    {topCategories.map(category => {
                      const categoryBanks = banks.filter(b => b.categoryId === category.id);
                      const activatedChildCategories = childCategoriesByParent.get(category.id) || [];
                      const childCategoryIds = activatedChildCategories.map(c => c.id);
                      const childCategoryBanks = banks.filter(b => childCategoryIds.includes(b.categoryId || ''));
                      
                      if (categoryBanks.length === 0 && childCategoryBanks.length === 0) return null;
                      
                      return (
                        <div key={category.id} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm mb-4">
                          <div 
                            className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50/80 p-2 -m-2 rounded-xl transition-all duration-200"
                            onClick={() => setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)}
                          >
                            {selectedCategoryId === category.id ? (
                              <FolderOpen className="w-4 h-4 text-slate-500" />
                            ) : (
                              <Folder className="w-4 h-4 text-slate-400" />
                            )}
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg tracking-wide ${
                              category.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                              category.color === 'green' ? 'bg-green-100 text-green-700' :
                              category.color === 'red' ? 'bg-red-100 text-red-700' :
                              category.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                              category.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                              category.color === 'pink' ? 'bg-pink-100 text-pink-700' :
                              category.color === 'indigo' ? 'bg-indigo-100 text-indigo-700' :
                              'bg-cyan-100 text-cyan-700'
                            }`}>
                              {category.name}
                            </span>
                            <span className="text-xs text-gray-500 ml-auto pr-1 font-medium">
                              {categoryBanks.length + childCategoryBanks.length} 个题库
                            </span>
                            <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${selectedCategoryId === category.id ? 'rotate-90' : ''}`} />
                          </div>
                        
                          {selectedCategoryId === category.id && (
                            <div className="mt-3 space-y-3">
                              {categoryBanks.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                    <span className="text-xs text-gray-400 font-medium">直接题库</span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {categoryBanks.map((bank) => (
                                      <BankCard 
                                        key={bank.id} 
                                        bank={bank} 
                                        onStartPractice={(bankId) => {
                                          if (!currentUser) {
                                            setAuthModalOpen(true);
                                            return;
                                          }
                                          setPracticeBankId(bankId);
                                          startQuiz('sequential', bankId);
                                        }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {activatedChildCategories.map(child => {
                                const childBanks = banks.filter(b => b.categoryId === child.id);
                                if (childBanks.length === 0) return null;
                                
                                return (
                                  <div key={child.id}>
                                    <div className="flex items-center gap-2 mb-2">
                                      <FolderOpen className="w-3 h-3 text-gray-500" />
                                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${
                                        child.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                                        child.color === 'green' ? 'bg-green-100 text-green-700' :
                                        child.color === 'red' ? 'bg-red-100 text-red-700' :
                                        child.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                                        child.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                                        child.color === 'pink' ? 'bg-pink-100 text-pink-700' :
                                        child.color === 'indigo' ? 'bg-indigo-100 text-indigo-700' :
                                        'bg-cyan-100 text-cyan-700'
                                      }`}>
                                        {child.name}
                                      </span>
                                      <span className="text-xs text-gray-500 font-medium">({childBanks.length} 题库)</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {childBanks.map((bank) => (
                                        <BankCard 
                                          key={bank.id} 
                                          bank={bank} 
                                          onStartPractice={(bankId) => {
                                            if (!currentUser) {
                                              setAuthModalOpen(true);
                                              return;
                                            }
                                            setPracticeBankId(bankId);
                                            startQuiz('sequential', bankId);
                                          }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </>
          )}
        </div>
        
        <div className="h-8"></div>
      </div>
      
      {/* 登录弹窗 */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onAuthChange={() => {
          const user = getStoredUser();
          if (user) {
            setCurrentUser(user);
          }
          loadBanks();
          loadCategories();
        }}
      />
    </div>
  );
}
