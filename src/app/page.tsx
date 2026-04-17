'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuiz } from '@/hooks/use-quiz';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { 
  Library, 
  BarChart3, 
  ChevronLeft, 
  ChevronRight, 
  Check,
  X,
  Trophy,
  Target,
  BookOpen,
  Star,
  RefreshCw,
  FileText,
  FileCheck,
  Grid3X3,
  ArrowLeft,
  TrendingUp,
  RotateCcw,
  Settings,
  Folder,
  FolderOpen,
  Home,
  User,
  History,
  Flame,
  Calendar,
  Zap,
  Clock,
  Award,
  Sparkles,
  ChevronDown,
  MoreHorizontal,
  PlayCircle,
  AlertCircle
} from 'lucide-react';
import { questionStore, recordStore, bankStore, categoryStore, getWrongQuestionIds, generateId, recentPracticeStore, RecentPractice, cachedFetch, CACHE_TTL, getCacheKey, invalidateCache, cloudSyncService, wrongStreakStore } from '@/lib/quiz-store';
import { Question, QuestionBank, QuestionType, Difficulty, Category } from '@/lib/types';
import { BankCard } from '@/components/BankCard';
import { UserStatus, getCurrentUser as getStoredUser, AuthModal } from '@/components/AuthModal';
import { RichTextWithBreaks } from '@/lib/rich-text';

// 从 AuthModal 获取当前用户
const getCurrentUser = (): { id: string; phone: string; nickname?: string; role: string; activatedCategories?: string[] } | null => {
  return getStoredUser();
};

// 淡雅风格颜色
const COLORS = {
  primary: 'from-slate-500 to-slate-600',
  success: 'from-emerald-500 to-emerald-600',
  warning: 'from-amber-500 to-amber-600',
  danger: 'from-rose-500 to-rose-600',
  info: 'from-blue-500 to-blue-600',
};

export default function QuizApp() {
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
    setHasStarted,
  } = useQuiz();
  const [activeTab, setActiveTab] = useState('practice');
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // 题库管理状态
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(7200);
  
  // 练习模式状态
  const [practiceBankId, setPracticeBankId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  // 客户端挂载状态（防止 hydration mismatch）
  const [mounted, setMounted] = useState(false);
  
  // 跟踪组件是否已挂载
  const isMountedRef = useRef(true);
  
  // 最近练习记录状态
  const [recentPractices, setRecentPractices] = useState<RecentPractice[]>([]);
  
  // 分类数据状态
  const [categories, setCategories] = useState<Category[]>([]);
  
  // 题库数据状态
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  
  // 认证弹窗状态
  const [authModalOpen, setAuthModalOpen] = useState(false);
  
  // 当前用户状态
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getCurrentUser>>(null);
  
  // 错题数量
  const [wrongCount, setWrongCount] = useState(0);
  
  // 刷新触发器
  const [refreshKey, setRefreshKey] = useState(0);

  // 设置挂载状态
  useEffect(() => {
    setMounted(true);
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 获取当前用户
  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
  }, [refreshKey]);

  // 加载分类数据
  useEffect(() => {
    const loadedCategories = categoryStore.getAll();
    setCategories(loadedCategories);
  }, [refreshKey]);

  // 加载题库数据
  useEffect(() => {
    const loadedBanks = bankStore.getAll();
    setBanks(loadedBanks);
  }, [refreshKey]);

  // 加载最近练习记录
  useEffect(() => {
    if (!currentUser) {
      setRecentPractices([]);
      return;
    }
    
    const practices = recentPracticeStore.getRecent(5);
    setRecentPractices(practices);
  }, [currentUser, refreshKey]);

  // 计算错题数量
  useEffect(() => {
    if (!mounted) return;
    const wrongIds = getWrongQuestionIds();
    setWrongCount(wrongIds.length);
  }, [mounted, refreshKey]);

  // 刷新数据
  const refreshData = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // 处理单选/判断题选择
  const handleSingleSelect = useCallback((value: string) => {
    if (currentQuestion && !quizState.showResult) {
      selectAnswer(currentQuestion.id, value);
    }
  }, [currentQuestion, quizState.showResult, selectAnswer]);

  // 处理多选题选择
  const handleMultiSelect = useCallback((optionId: string, isSelected: boolean) => {
    if (currentQuestion && !quizState.showResult) {
      const current = quizState.answers[currentQuestion.id] as string[] | undefined;
      if (isSelected) {
        selectAnswer(currentQuestion.id, [...(current || []), optionId]);
      } else {
        selectAnswer(currentQuestion.id, (current || []).filter((id: string) => id !== optionId));
      }
    }
  }, [currentQuestion, quizState.showResult, quizState.answers, selectAnswer]);

  // 处理填空题输入
  const handleFillBlankInput = useCallback((value: string) => {
    if (currentQuestion && !quizState.showResult) {
      selectAnswer(currentQuestion.id, value);
    }
  }, [currentQuestion, quizState.showResult, selectAnswer]);

  // 获取选项样式
  const getOptionStyle = (isSelected: boolean, isCorrect: boolean, showResult: boolean) => {
    if (!showResult) {
      return isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50';
    }
    if (isCorrect) return 'border-emerald-500 bg-emerald-50';
    if (isSelected && !isCorrect) return 'border-red-500 bg-red-50';
    return 'border-slate-200 opacity-60';
  };

  // 渲染选项
  const renderOptions = () => {
    if (!currentQuestion) return null;

    // 填空题
    if (currentQuestion.type === 'fill-blank') {
      return (
        <div className="mb-4">
          <Input
            type="text"
            placeholder="请输入答案"
            value={(currentAnswer as string) || ''}
            onChange={(e) => handleFillBlankInput(e.target.value)}
            disabled={quizState.showResult}
            className="w-full"
          />
        </div>
      );
    }

    // 判断题
    if (currentQuestion.type === 'true-false') {
      const defaultOptions = currentQuestion.options?.length === 2 
        ? currentQuestion.options 
        : [{ id: 'true', text: '正确' }, { id: 'false', text: '错误' }];
      
      return (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {defaultOptions.map((option) => {
            const isCorrectAnswer = currentQuestion.answer === option.id;
            const isSelected = currentAnswer === option.id;
            return (
              <div
                key={option.id}
                className={`flex items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${getOptionStyle(isSelected, isCorrectAnswer, quizState.showResult)}`}
                onClick={() => !quizState.showResult && handleSingleSelect(option.id)}
              >
                <span className={`font-bold text-lg ${
                  isSelected 
                    ? quizState.showResult 
                      ? isCorrectAnswer 
                        ? 'text-emerald-600' 
                        : 'text-red-600'
                      : 'text-indigo-600'
                    : 'text-slate-600'
                }`}>
                  {option.text}
                </span>
                {quizState.showResult && isCorrectAnswer && (
                  <Check className="w-5 h-5 text-emerald-500 ml-2" />
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // 多选题
    if (currentQuestion.type === 'multiple') {
      const options = Array.isArray(currentQuestion.options) ? currentQuestion.options : [];
      return (
        <div className="space-y-2 mb-4">
          <p className="text-xs text-slate-500 mb-2">* 此题为多选题，可选择多个答案</p>
          {options.map((option, index) => {
            const correctAnswers = Array.isArray(currentQuestion.answer) 
              ? currentQuestion.answer 
              : [currentQuestion.answer];
            const isCorrectAnswer = correctAnswers.includes(option.id);
            const isSelected = Array.isArray(currentAnswer) && currentAnswer.includes(option.id);
            
            return (
              <div
                key={option.id}
                className={`flex items-center p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer ${getOptionStyle(isSelected, isCorrectAnswer, quizState.showResult)}`}
                onClick={() => !quizState.showResult && handleMultiSelect(option.id, !isSelected)}
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center mr-3 font-bold text-xs transition-colors ${
                  isSelected 
                    ? quizState.showResult 
                      ? isCorrectAnswer 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-red-500 text-white'
                      : 'bg-indigo-500 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {isSelected ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    String.fromCharCode(65 + index)
                  )}
                </div>
                <span className="flex-1 text-sm font-medium leading-tight">{option.text}</span>
                {quizState.showResult && isCorrectAnswer && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center ml-1">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
                {quizState.showResult && isSelected && !isCorrectAnswer && (
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center ml-1">
                    <X className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }
    
    // 单选题
    const options = Array.isArray(currentQuestion.options) ? currentQuestion.options : [];
    return (
      <div className="space-y-2">
        {options.map((option: { id: string; text: string }, index: number) => {
          const isCorrectAnswer = currentQuestion.answer === option.id;
          const isSelected = currentAnswer === option.id;
          
          return (
            <div
              key={`single-${index}-${option.id}`}
              className={`flex items-center p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer ${getOptionStyle(isSelected, isCorrectAnswer, quizState.showResult)}`}
              onClick={() => !quizState.showResult && handleSingleSelect(option.id)}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center mr-2 font-bold text-xs transition-colors ${
                isSelected 
                  ? quizState.showResult 
                    ? isCorrectAnswer 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-red-500 text-white'
                    : 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {isSelected ? (
                  <Check className="w-4 h-4" />
                ) : (
                  option.id.toUpperCase()
                )}
              </div>
              <span className="flex-1 text-sm font-medium leading-tight">{option.text}</span>
              {quizState.showResult && isCorrectAnswer && (
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center ml-1">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              {quizState.showResult && isSelected && !isCorrectAnswer && (
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center ml-1">
                  <X className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部区域 - 仅在非做题模式时显示 */}
      {!hasStarted && (
        <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
          <div className="max-w-[970px] mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-slate-800">智能刷题</span>
            </Link>
            <div className="flex items-center gap-1">
              {currentUser?.role === 'admin' && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500">
                    <Settings className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              <UserStatus />
            </div>
          </div>
        </header>
      )}

      {/* 主内容 */}
      <main className="max-w-[970px] mx-auto px-4 py-4">
        {/* 当 hasStarted 为 true 时，显示练习页面 */}
        {hasStarted ? (
          <PracticeView 
            onExit={() => {
              finishQuiz();
              resetQuiz();
              setHasStarted(false);
              setPracticeBankId(null);
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
        ) : (
          <Tabs value={activeTab} onValueChange={(value) => {
            setActiveTab(value);
            setSelectedCategoryId(null);
            setPracticeBankId(null);
          }} className="space-y-4">
        {/* 功能标签导航 - 淡雅风格 */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {[
            { key: 'practice', icon: Home, label: '首页' },
            { key: 'library', icon: Library, label: '题库' },
            { key: 'stats', icon: BarChart3, label: '统计' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedCategoryId(null);
                setPracticeBankId(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-slate-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

          {/* 练习页面 - 单栏布局 */}
          <TabsContent value="practice" className="space-y-4 mt-0">
            {/* 欢迎卡片 */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5 border border-slate-200">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                  <Sparkles className="w-6 h-6 text-amber-500" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-slate-800">
                    {currentUser ? `欢迎回来，${currentUser.nickname || '学习者'}` : '欢迎使用智能刷题'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {currentUser ? '继续你的学习之旅，今天也要加油哦！' : '登录后解锁全部功能，开启高效学习'}
                  </p>
                </div>
              </div>
            </div>

            {/* 快捷功能入口 */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: BookOpen, label: '错题本', href: '/wrongbook', color: 'bg-rose-50 text-rose-600' },
                { icon: History, label: '最近练习', onClick: () => setActiveTab('stats'), color: 'bg-blue-50 text-blue-600' },
                { icon: Calendar, label: '学习日历', onClick: () => {}, color: 'bg-emerald-50 text-emerald-600' },
                { icon: Trophy, label: '排行榜', onClick: () => {}, color: 'bg-amber-50 text-amber-600' },
              ].map((item, index) => (
                <button
                  key={index}
                  onClick={item.onClick}
                  className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-slate-600">{item.label}</span>
                </button>
              ))}
            </div>

            {/* 学习数据概览 - 淡雅风格 */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <div className="w-5 h-5 bg-slate-100 rounded-md flex items-center justify-center">
                  <BarChart3 className="w-3 h-3 text-slate-500" />
                </div>
                学习数据
              </h3>
              
              {/* 数据统计网格 - 淡雅配色 */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                  <p className="text-xl font-bold text-slate-700">{mounted ? wrongCount : '-'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">待复习错题</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                  <p className="text-xl font-bold text-slate-700">{mounted ? stats.masteredCount : '-'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">已掌握</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                  <p className="text-xl font-bold text-slate-700">{mounted ? stats.accuracy : 0}%</p>
                  <p className="text-xs text-slate-500 mt-0.5">正确率</p>
                </div>
              </div>

              {/* 学习进度条 */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span>本周学习进度</span>
                  <span>3/7 天</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-400 rounded-full" style={{ width: '43%' }} />
                </div>
              </div>
              
              {/* 错题本入口 */}
              <Link href="/wrongbook">
                <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-xl border border-rose-100 hover:border-rose-200 transition-all">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <BookOpen className="w-5 h-5 text-rose-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700">错题本</p>
                    <p className="text-xs text-slate-500">{mounted ? wrongCount : '-'} 道错题待复习</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </Link>
            </div>

            {/* 最近练习记录 */}
            {currentUser && recentPractices.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <div className="w-5 h-5 bg-slate-100 rounded-md flex items-center justify-center">
                      <Clock className="w-3 h-3 text-slate-500" />
                    </div>
                    最近练习
                  </h3>
                  <button 
                    onClick={() => setActiveTab('stats')}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    查看全部
                  </button>
                </div>
                <div className="space-y-2">
                  {recentPractices.slice(0, 3).map((practice, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                      onClick={() => {
                        setPracticeBankId(practice.bankId);
                        startQuiz('sequential', practice.bankId);
                        setHasStarted(true);
                      }}
                    >
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                        <FileText className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{practice.bankName}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(practice.lastPracticeAt).toLocaleDateString()} · {practice.answeredCount}题
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 推荐题库 */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <div className="w-5 h-5 bg-slate-100 rounded-md flex items-center justify-center">
                    <Zap className="w-3 h-3 text-slate-500" />
                  </div>
                  推荐练习
                </h3>
              </div>
              <div className="space-y-2">
                {banks.slice(0, 3).map((bank) => (
                  <div 
                    key={bank.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                    onClick={() => {
                      if (!currentUser) {
                        setAuthModalOpen(true);
                        return;
                      }
                      setPracticeBankId(bank.id);
                      startQuiz('sequential', bank.id);
                      setHasStarted(true);
                    }}
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <Library className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{bank.name}</p>
                      <p className="text-xs text-slate-400">{bank.totalQuestions || 0} 道题目</p>
                    </div>
                    <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center">
                      <PlayCircle className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                ))}
                {banks.length === 0 && (
                  <div className="text-center py-6 text-slate-400">
                    <Library className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">暂无推荐题库</p>
                  </div>
                )}
              </div>
            </div>

            {/* 每日一句 */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-white/80 rounded-lg flex items-center justify-center">
                  <Award className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">"学习不是填满水桶，而是点燃火焰。"</p>
                  <p className="text-xs text-slate-500 mt-1">— 威廉·巴特勒·叶芝</p>
                </div>
              </div>
            </div>

            {/* 登录提示 */}
            {!currentUser && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-700">登录解锁更多功能</h4>
                    <p className="text-xs text-slate-500 mt-0.5">激活码激活 · 学习统计 · 云端同步</p>
                  </div>
                  <Button 
                    size="sm" 
                    className="rounded-lg bg-slate-800 hover:bg-slate-700"
                    onClick={() => setAuthModalOpen(true)}
                  >
                    登录
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* 题库浏览页面 */}
          <TabsContent value="library" className="mt-0">
            {/* 页面标题区块 */}
            <div className="mb-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <Library className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <h1 className="text-base font-semibold text-slate-700">题库浏览</h1>
                    <p className="text-xs text-slate-500">选择分类开始练习</p>
                  </div>
                  {currentUser && (
                    <div className="px-2.5 py-1 bg-white rounded-full text-xs text-slate-600 border border-slate-200">
                      {currentUser.activatedCategories?.length || 0} 个分类
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* 未登录提示 */}
            {!currentUser && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-700">登录后查看已激活的题库</h4>
                    <p className="text-xs text-slate-500 mt-0.5">请先登录以查看和练习题库</p>
                  </div>
                  <Button 
                    size="sm" 
                    className="rounded-lg bg-slate-800 hover:bg-slate-700"
                    onClick={() => setAuthModalOpen(true)}
                  >
                    登录
                  </Button>
                </div>
              </div>
            )}
            
            {/* 已登录但无激活分类提示 */}
            {currentUser && (currentUser.activatedCategories?.length === 0) && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-700">暂无激活的题库分类</h4>
                    <p className="text-xs text-slate-500 mt-0.5">请联系管理员获取激活码来解锁题库</p>
                  </div>
                </div>
              </div>
            )}

            {/* 题库列表 - 按分类分组 */}
            <div className="space-y-3">
              {banks.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 border border-slate-100 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-slate-50 rounded-xl flex items-center justify-center">
                    <Library className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">暂无题库</p>
                  <p className="text-xs text-slate-400 mt-1">请联系管理员导入</p>
                </div>
              ) : (
                <>
                  {/* 未分类题库 */}
                  {banks.filter(b => !b.categoryId).length > 0 && (
                    <div className="bg-white rounded-2xl p-4 border border-slate-100">
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
                              setActiveTab('practice');
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
                                    <div key={category.id} className="bg-white rounded-2xl p-3.5 border border-slate-100">
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
                                                setActiveTab('practice');
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
                        
                        {topCategories.length > 0 && (
                          <div className="bg-white rounded-2xl p-4 border border-slate-100">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                              <Folder className="w-4 h-4 text-slate-400" />
                              <span className="text-sm font-semibold text-slate-700">其他分类</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {topCategories.map(category => {
                                const categoryBanks = banks.filter(b => b.categoryId === category.id);
                                if (categoryBanks.length === 0) return null;
                                
                                return categoryBanks.map(bank => (
                                  <BankCard
                                    key={bank.id}
                                    bank={bank}
                                    onStartPractice={(bankId) => {
                                      if (!currentUser) {
                                        setAuthModalOpen(true);
                                        return;
                                      }
                                      setPracticeBankId(bankId);
                                      setActiveTab('practice');
                                      startQuiz('sequential', bankId);
                                    }}
                                  />
                                ));
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </TabsContent>

          {/* 统计页面 */}
          <TabsContent value="stats" className="mt-0">
            <div className="bg-white rounded-2xl p-4 border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">学习统计</h3>
              
              {currentUser ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-slate-700">{stats.totalCount}</p>
                      <p className="text-xs text-slate-500 mt-0.5">总答题数</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-slate-700">{stats.correctCount}</p>
                      <p className="text-xs text-slate-500 mt-0.5">答对题数</p>
                    </div>
                  </div>
                  
                  {/* 最近练习记录 */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-600 mb-2">最近练习</h4>
                    {recentPractices.length > 0 ? (
                      <div className="space-y-2">
                        {recentPractices.map((practice, index) => (
                          <div 
                            key={index}
                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                          >
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                              <FileText className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">{practice.bankName}</p>
                              <p className="text-xs text-slate-400">
                                {new Date(practice.lastPracticeAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-700">{practice.answeredCount > 0 ? Math.round((practice.correctCount / practice.answeredCount) * 100) : 0}%</p>
                              <p className="text-xs text-slate-400">正确率</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-4">暂无练习记录</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 bg-slate-50 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-500">登录后查看学习统计</p>
                  <Button 
                    size="sm" 
                    className="mt-3 rounded-lg bg-slate-800 hover:bg-slate-700"
                    onClick={() => setAuthModalOpen(true)}
                  >
                    登录
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
      </main>
    </div>
  );
}

// PracticeView component
interface PracticeViewProps {
  onExit: () => void;
  quizState: {
    questions: Question[];
    currentIndex: number;
    answers: Record<string, string | string[]>;
    showResult: boolean;
  };
  currentQuestion: Question | null;
  currentAnswer: string | string[] | undefined;
  isAnswerCorrect: boolean;
  isLoading: boolean;
  selectAnswer: (questionId: string, answer: string | string[]) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  submitAnswer: () => void;
  finishQuiz: () => void;
  goToQuestion: (index: number) => void;
  restartQuiz: () => void;
  resetQuiz: () => void;
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
  
  const resultStats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    
    quizState.questions.forEach(q => {
      const answer = quizState.answers[q.id];
      if (answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
        unanswered++;
      } else {
        const qAnswer = q.answer;
        if (Array.isArray(qAnswer)) {
          const userAnswer = Array.isArray(answer) ? answer.sort() : [answer];
          const correctAnswer = qAnswer.sort();
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
    
    const total = quizState.questions.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    
    return { correct, wrong, unanswered, total, accuracy };
  }, [quizState.questions, quizState.answers]);
  
  useEffect(() => {
    setShowExplanation(false);
    setCurrentChildIndex(0);
  }, [quizState.currentIndex]);
  
  const displayQuestion = useMemo(() => {
    if (!currentQuestion) return null;
    if (currentQuestion.type === 'comprehensive' && currentQuestion.children && currentQuestion.children.length > 0) {
      const child = currentQuestion.children[currentChildIndex];
      if (child) return child;
    }
    return currentQuestion;
  }, [currentQuestion, currentChildIndex]);
  
  const displayQuestionAnswer = useMemo(() => {
    if (!displayQuestion) return undefined;
    if (displayQuestion.id !== currentQuestion?.id) {
      return answers[displayQuestion.id];
    }
    return currentAnswer;
  }, [displayQuestion, currentQuestion, currentAnswer, answers]);
  
  const isCurrentCorrect = useMemo(() => {
    if (!displayQuestion || !displayQuestionAnswer) return false;
    const answer = displayQuestionAnswer;
    if (Array.isArray(displayQuestion.answer)) {
      return Array.isArray(answer) && 
        displayQuestion.answer.every(a => answer.includes(a));
    }
    return answer === displayQuestion.answer;
  }, [displayQuestion, displayQuestionAnswer]);
  
  const { answeredCount, progressPercent } = useMemo(() => {
    const count = quizState.questions.filter(q => quizState.answers[q.id] !== undefined).length;
    const percent = quizState.questions.length > 0 
      ? Math.round((count / quizState.questions.length) * 100) 
      : 0;
    return { answeredCount: count, progressPercent: percent };
  }, [quizState.questions, quizState.answers]);
  
  const handleFinishAndExit = useCallback(() => {
    if (confirm('确定要交卷吗？')) {
      finishQuiz();
      setShowResultSheet(true);
    }
  }, [finishQuiz]);
  
  const handleReturnHome = useCallback(() => {
    resetQuiz();
    onExit();
  }, [resetQuiz, onExit]);
  
  const scrollToQuestion = useCallback(() => {
    if (questionContentRef.current) {
      questionContentRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, []);
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-200 rounded-2xl flex items-center justify-center animate-pulse">
            <BookOpen className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">加载中...</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion && !showResultSheet) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">正在加载题目...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 固定顶部栏 */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 px-4 py-3 z-30">
        <div className="max-w-[970px] mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('确定要退出练习吗？')) {
                onExit();
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
          
          <div className="flex items-center gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleFinishAndExit()}
              className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg h-9 w-9 p-0"
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
                className="h-full bg-slate-400 rounded-full transition-all duration-300"
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
      <div className="pb-28" ref={questionContentRef}>
        <div className="max-w-[970px] mx-auto sm:px-4 py-3">
          {/* 题目卡片 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            {/* 题干头部 */}
            <div className="sm:px-4 px-3 py-2.5 border-b border-slate-50 bg-slate-50/50">
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold text-white ${
                  displayQuestion?.type === 'single' ? 'bg-indigo-500' :
                  displayQuestion?.type === 'multiple' ? 'bg-purple-500' :
                  displayQuestion?.type === 'true-false' ? 'bg-cyan-500' :
                  displayQuestion?.type === 'comprehensive' ? 'bg-rose-500' : 'bg-teal-500'
                }`}>
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
              <div className="sm:mx-4 mx-3 mt-3 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-slate-600 leading-relaxed flex-1">
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
                    optionStyle = isCorrectAnswer
                      ? 'bg-emerald-50'
                      : 'bg-red-50';
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
            </div>
            
            {/* 答案与解析 */}
            {showExplanation && (
              <div className="sm:px-4 px-3 pb-4 space-y-3">
                <div className={`rounded-xl p-3.5 ${isCurrentCorrect ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isCurrentCorrect ? 'bg-emerald-500' : 'bg-red-500'}`}>
                        {isCurrentCorrect ? <Check className="w-4 h-4 text-white" /> : <X className="w-4 h-4 text-white" />}
                      </div>
                      <span className={`text-sm font-bold ${isCurrentCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                        {isCurrentCorrect ? '回答正确' : '回答错误'}
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
                  <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-100">
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
      </div>

      {/* 底部固定操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 z-30">
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
              onClick={() => {
                submitAnswer();
                setShowExplanation(true);
                setTimeout(scrollToQuestion, 100);
              }}
              className="h-11 px-6 rounded-xl border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold"
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
                    onClick={() => handleFinishAndExit()}
                    className="h-9 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl"
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
                    className="h-9 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl"
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
                    className="h-9 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl"
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
              <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center">
                <Grid3X3 className="w-4 h-4 text-slate-600" />
              </div>
              <span>答题卡</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {['single', 'multiple', 'true-false', 'fill-blank', 'comprehensive'].map(type => {
              const typeQuestions = quizState.questions
                .map((q, idx) => ({ q, idx }))
                .filter(item => item.q.type === type);
              if (typeQuestions.length === 0) return null;
              const typeLabel = type === 'single' ? '单选题' : 
                               type === 'multiple' ? '多选题' : 
                               type === 'true-false' ? '判断题' : 
                               type === 'fill-blank' ? '填空题' : '综合题';
              return (
                <div key={type}>
                  <h4 className="text-xs font-semibold text-slate-500 mb-2">{typeLabel}</h4>
                  <div className="flex flex-wrap gap-2">
                    {typeQuestions.map(({ q, idx }) => {
                      const answer = quizState.answers[q.id];
                      const hasAnswer = answer !== undefined && answer !== '' && (!Array.isArray(answer) || answer.length > 0);
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            goToQuestion(idx);
                            setShowAnswerSheet(false);
                          }}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                            hasAnswer
                              ? 'bg-slate-800 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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

      {/* 结果弹窗 */}
      <Dialog open={showResultSheet} onOpenChange={setShowResultSheet}>
        <DialogContent className="max-w-[90vw] sm:max-w-sm rounded-2xl p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <Trophy className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">练习完成！</h3>
            <p className="text-sm text-slate-500 mt-1">
              答对 {resultStats.correct} / {resultStats.total} 题
            </p>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-xl font-bold text-emerald-600">{resultStats.correct}</p>
                <p className="text-xs text-slate-500">正确</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-red-500">{resultStats.wrong}</p>
                <p className="text-xs text-slate-500">错误</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-slate-700">{resultStats.accuracy}%</p>
                <p className="text-xs text-slate-500">正确率</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-11"
                onClick={() => {
                  setShowResultSheet(false);
                  restartQuiz();
                }}
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                再练一次
              </Button>
              <Button
                className="flex-1 rounded-xl h-11 bg-slate-800 hover:bg-slate-700"
                onClick={() => {
                  setShowResultSheet(false);
                  handleReturnHome();
                }}
              >
                返回首页
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
