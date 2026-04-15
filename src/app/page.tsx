'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
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
  Play, 
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
  Trash2,
  FileText,
  FileCheck,
  Grid3X3,
  ArrowLeft,
  TrendingUp,
  RotateCcw,
  BookMarked,
  Settings,
  Folder,
  FolderOpen
} from 'lucide-react';
import { questionStore, recordStore, bankStore, getWrongQuestionIds, generateId } from '@/lib/quiz-store';
import { Question, QuestionType, Difficulty, Category } from '@/lib/types';
import { BankCard } from '@/components/BankCard';
import { UserStatus, getCurrentUser as getStoredUser } from '@/components/AuthModal';

// 从 AuthModal 获取当前用户
const getCurrentUser = (): { id: string; phone: string; nickname?: string; role: string; activatedCategories?: string[] } | null => {
  return getStoredUser();
};

// Duolingo 风格颜色
const COLORS = {
  purple: 'from-purple-500 to-violet-600',
  green: 'from-emerald-500 to-teal-500',
  blue: 'from-blue-500 to-cyan-500',
  orange: 'from-orange-500 to-amber-500',
  pink: 'from-pink-500 to-rose-500',
  red: 'from-red-500 to-pink-500',
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
    getStats,
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
  
  // 统计页面日期筛选状态
  const [statsFilter, setStatsFilter] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    phone: string;
    nickname?: string;
    role: string;
    activatedCategories?: string[];
  } | null>(null);
  
  const banks = useMemo(() => bankStore.getAll(), [questions]);
  
  // 加载分类
  const loadCategories = useCallback(() => {
    const storedCategories = localStorage.getItem('quiz_categories');
    if (storedCategories) {
      setCategories(JSON.parse(storedCategories));
    }
  }, []);
  
  const loadQuestions = useCallback(() => {
    setQuestions(questionStore.getAll());
    loadCategories();
  }, [loadCategories]);

  // 刷新用户激活的分类（检查过期时间）
  const refreshActivatedCategories = async (userId: string) => {
    try {
      const token = localStorage.getItem('quiz_user_token');
      const response = await fetch('/api/auth/user/activations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.activatedCategories) {
          setCurrentUser(prev => prev ? { ...prev, activatedCategories: data.activatedCategories } : null);
        }
      }
    } catch (error) {
      console.error('刷新激活分类失败:', error);
    }
  };

  useEffect(() => {
    loadQuestions();
    // 获取当前登录用户
    const user = getCurrentUser();
    setCurrentUser(user);
    
    // 如果用户已登录，刷新激活的分类（检查过期）
    if (user) {
      refreshActivatedCategories(user.id);
    }
  }, [loadQuestions]);

  // 获取用户激活的分类ID列表（未登录用户返回所有分类）
  const getActivatedCategoryIds = useCallback(() => {
    if (!currentUser) {
      // 未登录用户：返回所有一级分类ID
      return categories.filter(c => !c.parentId).map(c => c.id);
    }
    // 已登录用户：有激活的分类则用激活的，否则返回所有
    const activated = currentUser.activatedCategories || [];
    return activated.length > 0 ? activated : categories.filter(c => !c.parentId).map(c => c.id);
  }, [currentUser, categories]);

  // 过滤出可用的分类（用于显示）
  const getAvailableCategories = useCallback(() => {
    const activatedIds = getActivatedCategoryIds();
    return categories.filter(c => !c.parentId && activatedIds.includes(c.id));
  }, [categories, getActivatedCategoryIds]);

  // 处理单选答案
  const handleSingleSelect = (value: string) => {
    if (currentQuestion && !quizState.showResult) {
      selectAnswer(currentQuestion.id, value);
    }
  };

  // 处理多选答案
  const handleMultiSelect = (optionId: string, checked: boolean) => {
    if (currentQuestion && !quizState.showResult) {
      const current = (currentAnswer as string[]) || [];
      if (checked) {
        selectAnswer(currentQuestion.id, [...current, optionId]);
      } else {
        selectAnswer(currentQuestion.id, current.filter(id => id !== optionId));
      }
    }
  };

  // 处理判断题答案
  const handleTrueFalseSelect = (value: string) => {
    if (currentQuestion && !quizState.showResult) {
      selectAnswer(currentQuestion.id, value);
    }
  };

  // 处理填空题答案
  const handleFillBlankChange = (value: string) => {
    if (currentQuestion && !quizState.showResult) {
      selectAnswer(currentQuestion.id, value);
    }
  };

  // 删除题库
  const handleDeleteBank = (bankId: string) => {
    const bank = bankStore.getById(bankId);
    if (!bank) return;
    
    if (confirm(`确定要删除题库「${bank.name}」吗？\n这将同时删除该题库中的 ${bank.questionIds.length} 道题目。`)) {
      bank.questionIds.forEach(qId => {
        questionStore.remove(qId);
      });
      bankStore.remove(bankId);
      loadQuestions();
    }
  };
  
  // 清空所有题库和题目
  const handleClearAll = () => {
    if (confirm('确定要清空所有题库和题目吗？\n此操作不可恢复！')) {
      questionStore.clear();
      bankStore.clear();
      recordStore.clear();
      loadQuestions();
      alert('已清空所有题库和题目');
    }
  };

  // 渲染选项
  const renderOptions = () => {
    if (!currentQuestion) return null;
    
    if (currentQuestion.type === 'fill-blank') {
      return (
        <div className="space-y-2">
          <Textarea
            placeholder="输入你的答案..."
            value={(currentAnswer as string) || ''}
            onChange={(e) => handleFillBlankChange(e.target.value)}
            disabled={quizState.showResult}
            className="min-h-[60px] sm:min-h-[100px] rounded-xl sm:rounded-2xl border-2 border-gray-200 focus:border-orange-300 bg-white text-sm sm:text-base"
          />
        </div>
      );
    }
    
    const getOptionStyle = (isSelected: boolean, isCorrectAnswer: boolean, showResult: boolean) => {
      if (showResult) {
        if (isSelected && isCorrectAnswer) {
          return 'border-emerald-400 bg-emerald-50';
        }
        if (isSelected && !isCorrectAnswer) {
          return 'border-red-400 bg-red-50';
        }
        if (isCorrectAnswer) {
          return 'border-emerald-300 bg-emerald-25';
        }
      }
      if (isSelected) {
        return 'border-orange-400 bg-orange-50';
      }
      return 'border-gray-200 bg-white hover:border-orange-200';
    };
    
    if (currentQuestion.type === 'true-false') {
      const defaultOptions = currentQuestion.options?.length === 2 
        ? currentQuestion.options 
        : [
            { id: 'a', text: '正确' },
            { id: 'b', text: '错误' }
          ];
      
      return (
        <div className="grid grid-cols-2 gap-3">
          {defaultOptions.map((option, index) => {
            const isCorrectAnswer = currentQuestion.answer === option.id;
            const isSelected = currentAnswer === option.id;
            
            return (
              <div
                key={`tf-${index}-${option.id}`}
                className={`flex items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${getOptionStyle(isSelected, isCorrectAnswer, quizState.showResult)}`}
                onClick={() => !quizState.showResult && handleTrueFalseSelect(option.id)}
              >
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center mr-2 sm:mr-3 font-bold text-sm sm:text-base transition-colors ${
                  isSelected 
                    ? quizState.showResult 
                      ? isCorrectAnswer 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-red-500 text-white'
                      : 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {isSelected ? (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    option.id.toUpperCase()
                  )}
                </div>
                <span className="flex-1 text-sm sm:text-base font-medium">{option.text}</span>
                {quizState.showResult && isCorrectAnswer && (
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }
    
    if (currentQuestion.type === 'multiple') {
      const options = Array.isArray(currentQuestion.options) ? currentQuestion.options : [];
      return (
        <div className="space-y-3">
          {options.map((option: { id: string; text: string }, index: number) => {
            const correctAnswers = Array.isArray(currentQuestion.answer) 
              ? currentQuestion.answer 
              : [currentQuestion.answer];
            const isCorrectAnswer = correctAnswers.includes(option.id);
            const isSelected = Array.isArray(currentAnswer) && currentAnswer.includes(option.id);
            
            return (
              <div
                key={`multi-${index}-${option.id}`}
                className={`flex items-center p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${getOptionStyle(isSelected, isCorrectAnswer, quizState.showResult)}`}
                onClick={() => !quizState.showResult && handleMultiSelect(option.id, !isSelected)}
              >
                <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center mr-2 sm:mr-3 font-bold text-xs sm:text-base transition-colors ${
                  isSelected 
                    ? quizState.showResult 
                      ? isCorrectAnswer 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-red-500 text-white'
                      : 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {option.id.toUpperCase()}
                </div>
                <span className="flex-1 text-xs sm:text-base font-medium leading-tight">{option.text}</span>
                {quizState.showResult && isCorrectAnswer && (
                  <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-emerald-500 flex items-center justify-center ml-1">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                )}
                {quizState.showResult && isSelected && !isCorrectAnswer && (
                  <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-red-500 flex items-center justify-center ml-1">
                    <X className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-gray-400 mt-1 sm:mt-2">* 此题为多选题，可选择多个答案</p>
        </div>
      );
    }
    
    // 单选题
    const options = Array.isArray(currentQuestion.options) ? currentQuestion.options : [];
    return (
      <div className="space-y-3">
        {options.map((option: { id: string; text: string }, index: number) => {
          const isCorrectAnswer = currentQuestion.answer === option.id;
          const isSelected = currentAnswer === option.id;
          
          return (
            <div
              key={`single-${index}-${option.id}`}
              className={`flex items-center p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${getOptionStyle(isSelected, isCorrectAnswer, quizState.showResult)}`}
              onClick={() => !quizState.showResult && handleSingleSelect(option.id)}
            >
              <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center mr-2 sm:mr-3 font-bold text-xs sm:text-base transition-colors ${
                isSelected 
                  ? quizState.showResult 
                    ? isCorrectAnswer 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-red-500 text-white'
                    : 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {isSelected ? (
                  <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  option.id.toUpperCase()
                )}
              </div>
              <span className="flex-1 text-xs sm:text-base font-medium leading-tight">{option.text}</span>
              {quizState.showResult && isCorrectAnswer && (
                <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-emerald-500 flex items-center justify-center ml-1">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
              )}
              {quizState.showResult && isSelected && !isCorrectAnswer && (
                <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-red-500 flex items-center justify-center ml-1">
                  <X className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <p className="text-gray-600 font-medium">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-white">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-orange-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              if (hasStarted) {
                if (confirm('确定要退出练习返回主页吗？')) {
                  setHasStarted(false);
                  setPracticeBankId(null);
                }
              }
            }}
          >
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">智能刷题</h1>
              <p className="text-xs text-gray-400">{questions.length} 道题目</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button variant="outline" size="sm" className="rounded-xl gap-1">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">管理</span>
              </Button>
            </Link>
            <UserStatus />
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* 当 hasStarted 为 true 时，隐藏 Tabs，直接显示练习页面 */}
        {hasStarted ? (
          <PracticeView 
            onExit={() => {
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
          />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Duolingo 风格 Tab 切换 */}
        <div className="flex gap-2 p-1.5 bg-gray-100 rounded-2xl">
          {[
            { key: 'practice', icon: Play, label: '练习', color: 'from-green-500 to-emerald-500' },
            { key: 'library', icon: Library, label: '题库', color: 'from-blue-500 to-cyan-500' },
            { key: 'stats', icon: BarChart3, label: '统计', color: 'from-purple-500 to-violet-500' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
              }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                    : 'text-gray-600 hover:bg-white/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* 练习页面 */}
          <TabsContent value="practice">
            {!quizState.isComplete && quizState.questions.length > 0 && hasStarted ? (
              <div className="min-h-screen sm:-mx-4">
                {/* 顶部导航栏 - 超精简版 */}
                <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 text-white px-2 py-2 sm:px-4 sm:py-4 sticky top-0 z-20 rounded-b-3xl shadow-lg">
                  <div className="flex items-center justify-between">
                    {/* 退出按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('确定要退出练习吗？')) {
                          setHasStarted(false);
                          setPracticeBankId(null);
                        }
                      }}
                      className="text-white hover:bg-white/20 rounded-lg px-2 h-8"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    
                    {/* 进度信息 */}
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                      {quizState.currentIndex + 1}/{quizState.questions.length}
                    </span>
                    
                    {/* 右侧按钮组 */}
                    <div className="flex items-center gap-1">
                      {/* 答题卡按钮 */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAnswerSheet(true)}
                        className="text-white hover:bg-white/20 rounded-lg px-2 h-8"
                      >
                        <Grid3X3 className="w-4 h-4" />
                      </Button>
                      
                      {/* 交卷按钮 */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('确定要交卷吗？')) {
                            finishQuiz();
                          }
                        }}
                        className="text-white hover:bg-white/20 rounded-lg px-3 h-8 font-medium"
                      >
                        <FileCheck className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 题目内容区域 */}
                <div className="pb-24 sm:pb-32">
                  {currentQuestion && (
                    <div>
                      {/* 题干 - 显眼设计 + 固定顶部 */}
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-b border-orange-100 sticky top-[56px] sm:top-[56px] z-10 shadow-sm">
                        <div className="max-w-2xl mx-auto px-4 py-3 sm:py-4">
                          {/* 题型标签 + 题号 */}
                          <div className="mb-2 flex items-center gap-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                              currentQuestion.type === 'single' ? 'bg-blue-500 text-white' :
                              currentQuestion.type === 'multiple' ? 'bg-purple-500 text-white' :
                              currentQuestion.type === 'true-false' ? 'bg-orange-500 text-white' :
                              currentQuestion.type === 'comprehensive' ? 'bg-red-500 text-white' :
                              'bg-green-500 text-white'
                            }`}>
                              {currentQuestion.type === 'single' ? '单选' :
                               currentQuestion.type === 'multiple' ? '多选' :
                               currentQuestion.type === 'true-false' ? '判断' :
                               currentQuestion.type === 'comprehensive' ? '综合' : '填空'}
                            </span>
                            <span className="text-xs text-gray-500 font-medium">
                              第 {quizState.currentIndex + 1} 题 / 共 {quizState.questions.length} 题
                            </span>
                          </div>
                          
                          {/* 综合题背景材料 */}
                          {currentQuestion.parentId && (
                            <div className="bg-white border border-amber-200 rounded-xl p-3 sm:p-4 mb-3">
                              <div className="flex items-center gap-2 text-amber-600 mb-2">
                                <BookMarked className="w-4 h-4" />
                                <span className="font-semibold text-sm">案例背景</span>
                              </div>
                              <p className="text-amber-900 text-sm leading-relaxed">
                                {(() => {
                                  const parentQuestion = questions.find(q => q.id === currentQuestion.parentId);
                                  return parentQuestion?.content || '（背景材料）';
                                })()}
                              </p>
                            </div>
                          )}
                          
                          <p className="text-base sm:text-xl text-gray-800 leading-relaxed font-semibold">
                            {currentQuestion.content}
                          </p>
                        </div>
                      </div>
                      
                      {/* 选项列表 */}
                      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-1.5 sm:space-y-3">
                        {renderOptions()}
                      </div>
                      
                      {/* 答案与解析 - 精简版 */}
                      {quizState.showResult && (
                        <div className="max-w-2xl mx-auto px-4 sm:px-0 mt-3 sm:mt-4 space-y-2 sm:space-y-3">
                          {/* 结果卡片 */}
                          <div className={`rounded-xl p-3 sm:p-4 ${isAnswerCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${isAnswerCorrect ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                  {isAnswerCorrect ? <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> : <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
                                </div>
                                <span className={`text-sm sm:text-base font-bold ${isAnswerCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {isAnswerCorrect ? '太棒了！' : '再接再厉！'}
                                </span>
                              </div>
                              <div className="bg-white rounded-lg px-2 py-1 sm:px-3 sm:py-1">
                                <span className="text-xs sm:text-sm text-gray-500">答案：</span>
                                <span className="text-sm sm:text-lg font-bold text-emerald-600 ml-1">
                                  {Array.isArray(currentQuestion.answer) 
                                    ? currentQuestion.answer.map(a => a.toUpperCase()).join(', ')
                                    : currentQuestion.answer.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* 解析 */}
                          {currentQuestion.explanation && (
                            <div className="bg-amber-50 rounded-xl p-2 sm:p-3 border border-amber-200">
                              <div className="flex items-center gap-1 sm:gap-2 text-amber-700 mb-1">
                                <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="font-semibold text-xs sm:text-sm">解析</span>
                              </div>
                              <p className="text-amber-900 text-xs sm:text-sm leading-relaxed">
                                {currentQuestion.explanation}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 底部固定操作栏 - 超精简版 */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 sm:static sm:max-w-2xl sm:mx-auto sm:mt-4 sm:bg-transparent sm:border-0 sm:p-0 sm:shadow-none">
                  <div className="flex items-center justify-between gap-1 sm:gap-2 max-w-2xl mx-auto">
                    {/* 上一题 */}
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (quizState.currentIndex > 0) {
                          prevQuestion();
                          setTimeout(() => {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }, 50);
                        }
                      }}
                      disabled={quizState.currentIndex === 0}
                      className="h-10 sm:h-11 px-2 rounded-lg border border-gray-200 flex-shrink-0"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline ml-1 text-sm">上一题</span>
                    </Button>
                    
                    {/* 查看解析 */}
                    {currentAnswer && !quizState.showResult && (
                      <Button
                        onClick={submitAnswer}
                        className="h-10 sm:h-11 px-2 sm:px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-medium text-sm sm:font-semibold flex-1 sm:flex-none"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span className="ml-1 sm:ml-2 text-xs sm:text-sm">查看解析</span>
                      </Button>
                    )}
                    
                    {/* 结果提示 */}
                    {quizState.showResult && (
                      <div className={`h-10 sm:h-11 flex items-center justify-center px-2 sm:px-3 rounded-xl font-medium text-sm ${
                        isAnswerCorrect 
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                          : 'bg-red-100 text-red-700 border border-red-300'
                      }`}>
                        {isAnswerCorrect ? (
                          <Check className="w-4 h-4 mr-1" />
                        ) : (
                          <X className="w-4 h-4 mr-1" />
                        )}
                        <span className="text-xs sm:text-sm">{isAnswerCorrect ? '正确' : '错误'}</span>
                      </div>
                    )}

                    {/* 下一题 / 交卷 */}
                    {quizState.currentIndex === quizState.questions.length - 1 ? (
                      <Button
                        onClick={() => finishQuiz()}
                        className="h-10 sm:h-11 px-2 sm:px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl flex-1 sm:flex-none"
                      >
                        <FileCheck className="w-4 h-4" />
                        <span className="ml-1 sm:ml-2 text-xs sm:text-sm">交卷</span>
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          if (currentAnswer && !quizState.showResult) {
                            submitAnswer();
                          }
                          nextQuestion();
                          setTimeout(() => {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }, 50);
                        }}
                        className="h-10 sm:h-11 px-2 sm:px-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl flex-1 sm:flex-none"
                      >
                        <span className="text-xs sm:text-sm">下一题</span>
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* 答题卡弹窗 */}
                <Dialog open={showAnswerSheet} onOpenChange={setShowAnswerSheet}>
                  <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[80vh] overflow-y-auto rounded-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-base flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                          <Grid3X3 className="w-4 h-4 text-white" />
                        </div>
                        答题卡
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {/* 按题型分组显示 */}
                      {['single', 'multiple', 'true-false', 'fill-blank', 'comprehensive'].map(type => {
                        const typeQuestions = quizState.questions
                          .map((q, idx) => ({ q, idx }))
                          .filter(item => item.q.type === type);
                        
                        if (typeQuestions.length === 0) return null;
                        
                        const typeLabel = type === 'single' ? '单选题' : 
                                         type === 'multiple' ? '多选题' : 
                                         type === 'true-false' ? '判断题' : 
                                         type === 'fill-blank' ? '填空题' : '综合题';
                        const typeColor = type === 'single' ? 'bg-blue-500' : 
                                         type === 'multiple' ? 'bg-purple-500' : 
                                         type === 'true-false' ? 'bg-orange-500' : 
                                         type === 'fill-blank' ? 'bg-green-500' : 'bg-red-500';
                        
                        return (
                          <div key={type}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`w-2 h-2 rounded-full ${typeColor}`}></span>
                              <span className="text-sm font-medium text-gray-700">{typeLabel}</span>
                              <span className="text-xs text-gray-400">({typeQuestions.length}题)</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {typeQuestions.map(({ q, idx }) => {
                                const answered = !!quizState.answers[q.id];
                                const record = recordStore.getByQuestionId(q.id);
                                const isWrong = answered && record.length > 0 && !record[record.length - 1].isCorrect;
                                const isCurrent = idx === quizState.currentIndex;
                                
                                return (
                                  <button
                                    key={q.id}
                                    onClick={() => {
                                      goToQuestion(idx);
                                      setShowAnswerSheet(false);
                                    }}
                                    className={`w-9 h-9 rounded-xl text-sm font-bold transition-all flex items-center justify-center ${
                                      isCurrent
                                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                                        : answered
                                          ? isWrong
                                            ? 'bg-red-100 text-red-700 border-2 border-red-300'
                                            : 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                                          : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200'
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
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded bg-gradient-to-r from-orange-500 to-amber-500"></div>
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
                          <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200"></div>
                          <span>未答</span>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ) : quizState.isComplete ? (
              /* 完成页面 - Duolingo 风格庆祝，可滚动 */
              <div className="pb-8">
                <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md mx-auto text-center relative overflow-hidden">
                  {/* 庆祝动画背景 */}
                  <div className="absolute inset-0 bg-gradient-to-b from-orange-50 to-white pointer-events-none" />
                  
                  <div className="relative z-10">
                    {/* 奖杯图标 */}
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl flex items-center justify-center shadow-xl shadow-amber-200 animate-bounce">
                      <Trophy className="w-12 h-12 text-white" />
                    </div>
                    
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">练习完成!</h2>
                    <p className="text-gray-500 mb-8">你已完成本次练习，继续加油！</p>
                    
                    {/* 统计卡片 */}
                    <div className="grid grid-cols-3 gap-3 mb-8">
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-100">
                        <p className="text-3xl font-bold text-blue-600">{quizState.questions.length}</p>
                        <p className="text-xs text-gray-500 mt-1">总题数</p>
                      </div>
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100">
                        <p className="text-3xl font-bold text-emerald-600">
                          {Object.values(quizState.answers).filter((_, idx) => {
                            const q = quizState.questions[idx];
                            const ans = quizState.answers[q.id];
                            if (Array.isArray(q.answer)) {
                              return Array.isArray(ans) && q.answer.every(a => ans.includes(a));
                            }
                            return ans === q.answer;
                          }).length}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">正确</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-4 border border-purple-100">
                        <p className="text-3xl font-bold text-purple-600">
                          {Math.round(
                            (Object.values(quizState.answers).filter((_, idx) => {
                              const q = quizState.questions[idx];
                              const ans = quizState.answers[q.id];
                              if (Array.isArray(q.answer)) {
                                return Array.isArray(ans) && q.answer.every(a => ans.includes(a));
                              }
                              return ans === q.answer;
                            }).length / quizState.questions.length) * 100
                          )}%
                        </p>
                        <p className="text-xs text-gray-500 mt-1">正确率</p>
                      </div>
                    </div>
                    
                    {/* 按钮 */}
                    <div className="flex gap-3 justify-center">
                      <Button 
                        onClick={restartQuiz} 
                        className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl shadow-lg"
                      >
                        <RotateCcw className="w-4 h-4" />
                        错题重练
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setHasStarted(false);
                          setPracticeBankId(null);
                        }}
                        className="gap-2 rounded-xl border-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        返回主页
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : questions.length > 0 ? (
              /* 练习开始页面 - 题库管理风格 */
              <div className="space-y-5">
                {/* 题库选择区域 - 卡片列表 */}
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                      <Library className="w-4 h-4 text-white" />
                    </div>
                    选择分类
                    {selectedCategoryId && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setSelectedCategoryId(null);
                          setPracticeBankId(null);
                        }}
                        className="text-xs h-7 ml-auto"
                      >
                        <ArrowLeft className="w-3 h-3 mr-1" />
                        返回
                      </Button>
                    )}
                  </h2>
                  
                  {!selectedCategoryId ? (
                    /* 显示已激活的一级分类列表 */
                    getAvailableCategories().length === 0 ? (
                      <Card className="border-dashed border-2 bg-gray-50">
                        <CardContent className="p-6 text-center">
                          <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                          <p className="text-gray-500 text-sm mb-2">暂无激活的分类</p>
                          <p className="text-gray-400 text-xs">请在个人中心激活分类后开始练习</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {/* 已激活的一级分类卡片 - 紧凑显示 */}
                        {getAvailableCategories().map((category) => {
                          const subCategories = categories.filter(c => c.parentId === category.id);
                          const categoryBanks = banks.filter(b => b.categoryId === category.id);
                          const categoryQuestions = questions.filter(q => categoryBanks.some(b => b.id === q.bankId));
                          const isSelected = practiceBankId === category.id;
                          
                          return (
                            <Card 
                              key={category.id}
                              className={`cursor-pointer transition-all border-0 shadow-md rounded-xl overflow-hidden hover:shadow-lg ${
                                isSelected ? 'ring-2 ring-blue-500' : ''
                              }`}
                              onClick={() => {
                                setSelectedCategoryId(category.id);
                                setPracticeBankId(null);
                              }}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold text-gray-900 leading-tight mb-1 truncate">{category.name}</h3>
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                      <span>{categoryQuestions.length} 题</span>
                                      {subCategories.length > 0 && (
                                        <span className="text-blue-400">{subCategories.length} 子分类</span>
                                      )}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 ml-1">
                                      <Check className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    /* 显示选中分类下的子分类和题库 */
                    <div className="space-y-3">
                      {/* 返回按钮和当前分类标题 */}
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setSelectedCategoryId(null);
                            setPracticeBankId(null);
                          }}
                          className="text-xs"
                        >
                          <ArrowLeft className="w-3 h-3 mr-1" />
                          返回
                        </Button>
                        <span className="text-sm text-gray-500">
                          {categories.find(c => c.id === selectedCategoryId)?.name}
                        </span>
                      </div>
                      
                      {/* 子分类列表 - 单列紧凑 */}
                      {categories.filter(c => c.parentId === selectedCategoryId).length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-400 px-1">子分类</p>
                          {categories.filter(c => c.parentId === selectedCategoryId).map((subCategory) => {
                            const subCategoryBanks = banks.filter(b => b.categoryId === subCategory.id);
                            const subCategoryQuestions = questions.filter(q => subCategoryBanks.some(b => b.id === q.bankId));
                            const isSelected = practiceBankId === `cat_${subCategory.id}`;
                            const hasBanks = banks.some(b => b.categoryId === subCategory.id);
                            
                            return (
                              <Card 
                                key={subCategory.id}
                                className={`cursor-pointer transition-all border-0 shadow-sm rounded-lg overflow-hidden hover:shadow-md ${
                                  isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-white'
                                }`}
                                onClick={() => {
                                  setPracticeBankId(`cat_${subCategory.id}`);
                                }}
                              >
                                <CardContent className="p-2 px-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <Folder className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                      <span className="text-sm font-medium text-gray-700 truncate">{subCategory.name}</span>
                                      <span className="text-xs text-gray-400 flex-shrink-0">{subCategoryQuestions.length}题</span>
                                      {hasBanks && (
                                        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 flex-shrink-0">
                                          {subCategoryBanks.length}库
                                        </Badge>
                                      )}
                                    </div>
                                    {isSelected && (
                                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                                        <Check className="w-3 h-3 text-white" />
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* 该分类直接关联的题库列表 - 单列紧凑 */}
                      {banks.filter(b => b.categoryId === selectedCategoryId).length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-400 px-1">题库</p>
                          {banks.filter(b => b.categoryId === selectedCategoryId).map((bank) => {
                            const bankQuestions = questions.filter(q => q.bankId === bank.id);
                            const isSelected = practiceBankId === bank.id;
                            return (
                              <Card 
                                key={bank.id}
                                className={`cursor-pointer transition-all border-0 shadow-sm rounded-lg overflow-hidden hover:shadow-md ${
                                  isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-white'
                                }`}
                                onClick={() => setPracticeBankId(bank.id)}
                              >
                                <CardContent className="p-2 px-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <BookOpen className="w-4 h-4 text-green-400 flex-shrink-0" />
                                      <span className="text-sm font-medium text-gray-700 truncate">{bank.name}</span>
                                      <span className="text-xs text-gray-400 flex-shrink-0">{bankQuestions.length}题</span>
                                    </div>
                                    {isSelected && (
                                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                                        <Check className="w-3 h-3 text-white" />
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* 练习模式选择 - 简约卡片 */}
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                      <Play className="w-4 h-4 text-white" />
                    </div>
                    选择练习模式
                    {practiceBankId && (
                      <span className="text-sm font-normal text-gray-400 ml-2">
                        ({(() => {
                          if (practiceBankId.startsWith('cat_')) {
                            const subCategoryId = practiceBankId.replace('cat_', '');
                            const subCategoryBanks = banks.filter(b => b.categoryId === subCategoryId);
                            return questions.filter(q => subCategoryBanks.some(b => b.id === q.bankId)).length;
                          } else if (selectedCategoryId) {
                            // 一级分类
                            return questions.filter(q => banks.some(b => b.categoryId === selectedCategoryId && b.id === q.bankId)).length;
                          } else {
                            return questions.filter(q => q.bankId === practiceBankId).length;
                          }
                        })()} 道题)
                      </span>
                    )}
                  </h2>
                  
                  {!practiceBankId ? (
                    <Card className="border-dashed border-2 bg-gray-50">
                      <CardContent className="p-4 text-center text-gray-400 text-sm">
                        请先选择上方分类后开始练习
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                  {/* 顺序练习 + 随机练习 一行 */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {/* 顺序练习 */}
                    <Card 
                      className="cursor-pointer transition-all border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl hover:scale-[1.02]"
                      onClick={() => startQuiz('sequential', practiceBankId)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Target className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 text-sm">顺序练习</h3>
                            <p className="text-xs text-gray-400">按顺序攻克</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* 随机练习 */}
                    <Card 
                      className="cursor-pointer transition-all border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl hover:scale-[1.02]"
                      onClick={() => startQuiz('random', practiceBankId)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <RefreshCw className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 text-sm">随机练习</h3>
                            <p className="text-xs text-gray-400">打乱顺序挑战</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* 错题重练 单独一行 */}
                  <Card 
                    className="cursor-pointer transition-all border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl hover:scale-[1.02]"
                    onClick={() => startQuiz('wrong', practiceBankId)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Star className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">错题重练</h3>
                          <p className="text-xs text-gray-400">专攻易错题目</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* 题库为空 - Duolingo 风格空状态 */
              <Card className="shadow-xl rounded-2xl border-0">
                <CardContent className="pt-12 pb-12 text-center">
                  <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-gray-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">开始你的学习之旅</h2>
                  <p className="text-gray-500 mb-4">请在右上角登录后开始练习</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 题库页面 - Duolingo 风格 */}
          <TabsContent value="library">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
                  <Library className="w-5 h-5 text-white" />
                </div>
                题库管理
              </h2>
              {banks.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleClearAll}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">清空</span>
                </Button>
              )}
            </div>

            {/* 题库列表 - 按分类分组 */}
            <div className="space-y-6">
              {banks.length === 0 ? (
                <Card className="bg-gradient-to-br from-gray-50 to-white border-dashed border-2 rounded-2xl">
                  <CardContent className="py-10 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center">
                      <Library className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500">暂无题库，请先导入题库</p>
                    <p className="text-sm text-gray-400 mt-1">可在右上角「管理」中导入题库</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* 未分类题库 */}
                  {banks.filter(b => !b.categoryId).length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <FolderOpen className="w-4 h-4 text-slate-500" />
                        <h3 className="font-medium text-slate-700">未分类</h3>
                        <span className="text-sm text-slate-400">({banks.filter(b => !b.categoryId).length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {banks.filter(b => !b.categoryId).map((bank) => (
                          <BankCard 
                            key={bank.id} 
                            bank={bank} 
                            questions={questions}
                            onDelete={handleDeleteBank}
                            onStartPractice={(bankId) => {
                              setPracticeBankId(bankId);
                              setActiveTab('practice');
                              setTimeout(() => startQuiz('sequential', bankId), 100);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* 按分类显示题库 - 支持二级分类 */}
                  {categories.filter(c => !c.parentId).map(category => {
                    // 获取该分类下的所有直接子分类
                    const childCategories = categories.filter(c => c.parentId === category.id);
                    
                    // 获取该分类的直接题库
                    const categoryBanks = banks.filter(b => b.categoryId === category.id);
                    
                    // 获取所有子分类的题库
                    const childCategoryBanks = childCategories.flatMap(child => 
                      banks.filter(b => b.categoryId === child.id)
                    );
                    
                    // 如果该分类和子分类都没有题库，则不显示
                    if (categoryBanks.length === 0 && childCategoryBanks.length === 0) return null;
                    
                    return (
                      <div key={category.id}>
                        {/* 顶级分类 */}
                        <div className="flex items-center gap-2 mb-3">
                          <Folder className="w-4 h-4 text-slate-500" />
                          <h3 className={`font-medium px-2 py-0.5 rounded ${
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
                          </h3>
                          <span className="text-sm text-slate-400">
                            ({categoryBanks.length + childCategoryBanks.length})
                          </span>
                        </div>
                        
                        {/* 该分类的直接题库 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                          {categoryBanks.map((bank) => (
                            <BankCard 
                              key={bank.id} 
                              bank={bank} 
                              questions={questions}
                              onDelete={handleDeleteBank}
                              onStartPractice={(bankId) => {
                                setPracticeBankId(bankId);
                                setActiveTab('practice');
                                setTimeout(() => startQuiz('sequential', bankId), 100);
                              }}
                            />
                          ))}
                        </div>
                        
                        {/* 子分类 */}
                        {childCategories.map(child => {
                          const childBanks = banks.filter(b => b.categoryId === child.id);
                          if (childBanks.length === 0) return null;
                          
                          return (
                            <div key={child.id} className="ml-4 mb-4">
                              <div className="flex items-center gap-2 mb-3">
                                <FolderOpen className="w-4 h-4 text-slate-400" />
                                <h4 className={`text-sm font-medium px-2 py-0.5 rounded ${
                                  child.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                                  child.color === 'green' ? 'bg-green-50 text-green-600' :
                                  child.color === 'red' ? 'bg-red-50 text-red-600' :
                                  child.color === 'yellow' ? 'bg-yellow-50 text-yellow-600' :
                                  child.color === 'purple' ? 'bg-purple-50 text-purple-600' :
                                  child.color === 'pink' ? 'bg-pink-50 text-pink-600' :
                                  child.color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
                                  'bg-cyan-50 text-cyan-600'
                                }`}>
                                  {child.name}
                                </h4>
                                <span className="text-xs text-slate-400">({childBanks.length})</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {childBanks.map((bank) => (
                                  <BankCard 
                                    key={bank.id} 
                                    bank={bank} 
                                    questions={questions}
                                    onDelete={handleDeleteBank}
                                    onStartPractice={(bankId) => {
                                      setPracticeBankId(bankId);
                                      setActiveTab('practice');
                                      setTimeout(() => startQuiz('sequential', bankId), 100);
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </TabsContent>

          {/* 统计页面 - Duolingo 风格 */}
          <TabsContent value="stats">
            {(() => {
              // 获取日期范围内的记录
              const getFilteredStats = (filter: 'day' | 'week' | 'month' | 'all') => {
                const records = recordStore.getAll();
                const now = Date.now();
                const dayMs = 24 * 60 * 60 * 1000;
                let filteredRecords = records;
                
                if (filter === 'day') {
                  filteredRecords = records.filter(r => now - r.timestamp < dayMs);
                } else if (filter === 'week') {
                  filteredRecords = records.filter(r => now - r.timestamp < 7 * dayMs);
                } else if (filter === 'month') {
                  filteredRecords = records.filter(r => now - r.timestamp < 30 * dayMs);
                }
                
                const totalCount = filteredRecords.length;
                const correctCount = filteredRecords.filter(r => r.isCorrect).length;
                const wrongCount = totalCount - correctCount;
                const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
                
                return { totalCount, correctCount, wrongCount, accuracy };
              };
              
              return (
                <div className="space-y-4">
                  {/* 日期筛选按钮 */}
                  <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                    {[
                      { key: 'day', label: '今日' },
                      { key: 'week', label: '本周' },
                      { key: 'month', label: '本月' },
                      { key: 'all', label: '全部' },
                    ].map(filter => (
                      <button
                        key={filter.key}
                        onClick={() => setStatsFilter(filter.key as 'day' | 'week' | 'month' | 'all')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          statsFilter === filter.key
                            ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-lg'
                            : 'text-gray-600 hover:bg-white/50'
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                  
                  {/* 统计卡片网格 */}
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                      <CardContent className="p-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-blue-200">
                          <BarChart3 className="w-6 h-6 text-white" />
                        </div>
                        <p className="text-3xl font-bold text-gray-800">{getFilteredStats(statsFilter).totalCount}</p>
                        <p className="text-sm text-gray-400">总练习</p>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                      <CardContent className="p-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-emerald-200">
                          <Check className="w-6 h-6 text-white" />
                        </div>
                        <p className="text-3xl font-bold text-gray-800">{getFilteredStats(statsFilter).correctCount}</p>
                        <p className="text-sm text-gray-400">正确</p>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                      <CardContent className="p-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-red-200">
                          <X className="w-6 h-6 text-white" />
                        </div>
                        <p className="text-3xl font-bold text-gray-800">{getFilteredStats(statsFilter).wrongCount}</p>
                        <p className="text-sm text-gray-400">错误</p>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                      <CardContent className="p-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-500 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-purple-200">
                          <Target className="w-6 h-6 text-white" />
                        </div>
                        <p className="text-3xl font-bold text-gray-800">{getFilteredStats(statsFilter).accuracy}%</p>
                        <p className="text-sm text-gray-400">正确率</p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* 错题数量提示 */}
                  <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Star className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        当前错题库有 {getWrongQuestionIds().length} 道题需要复习
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      )}
    </main>
    </div>
  );
}

// 练习页面组件 - 无 Tabs，简洁设计
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
}: PracticeViewProps) {
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  // 答案与解析显示状态（不自动显示，需手动点击按钮）
  const [showExplanation, setShowExplanation] = useState(false);
  // 当前综合题的子题目索引
  const [currentChildIndex, setCurrentChildIndex] = useState(0);
  
  // 切换题目时重置答案与解析显示状态
  useEffect(() => {
    setShowExplanation(false);
    setCurrentChildIndex(0);
  }, [quizState.currentIndex]);
  
  // 获取当前要显示的题目（综合题显示子题目）
  const getDisplayQuestion = useMemo(() => {
    if (!currentQuestion) return null;
    // 如果是综合题且有子题目，返回当前子题目
    if (currentQuestion.type === 'comprehensive' && currentQuestion.children && currentQuestion.children.length > 0) {
      const child = currentQuestion.children[currentChildIndex];
      if (child) return child;
    }
    return currentQuestion;
  }, [currentQuestion, currentChildIndex]);
  
  const displayQuestion = getDisplayQuestion;
  
  const isCurrentCorrect = useMemo(() => {
    if (!displayQuestion || !currentAnswer) return false;
    if (Array.isArray(displayQuestion.answer)) {
      return Array.isArray(currentAnswer) && 
        displayQuestion.answer.every(a => currentAnswer.includes(a));
    }
    return currentAnswer === displayQuestion.answer;
  }, [displayQuestion, currentAnswer]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl flex items-center justify-center animate-pulse">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <p className="text-gray-600 font-medium">加载中...</p>
        </div>
      </div>
    );
  }

  if (quizState.isComplete) {
    // 计算当前练习的统计
    const totalQuestions = quizState.questions.length;
    const answeredQuestions = quizState.questions.filter(q => quizState.answers[q.id] !== undefined);
    const correctCount = answeredQuestions.filter(q => {
      const userAnswer = quizState.answers[q.id];
      if (Array.isArray(q.answer)) {
        return Array.isArray(userAnswer) && q.answer.every(a => userAnswer.includes(a));
      }
      return userAnswer === q.answer;
    }).length;
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    
    return (
      <div className="min-h-screen -mx-4 sm:mx-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-orange-50 to-white pointer-events-none" />
          <div className="relative z-10">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl flex items-center justify-center shadow-xl shadow-amber-200 animate-bounce">
              <Trophy className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">练习完成!</h2>
            <p className="text-gray-500 mb-8">你已完成本次练习，继续加油！</p>
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-100">
                <p className="text-3xl font-bold text-blue-600">{totalQuestions}</p>
                <p className="text-xs text-gray-500 mt-1">总题数</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100">
                <p className="text-3xl font-bold text-emerald-600">{correctCount}</p>
                <p className="text-xs text-gray-500 mt-1">正确</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-4 border border-purple-100">
                <p className="text-3xl font-bold text-purple-600">{accuracy}%</p>
                <p className="text-xs text-gray-500 mt-1">正确率</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={() => restartQuiz()} 
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                再练一次
              </Button>
              <Button 
                onClick={() => onExit()} 
                variant="outline"
                className="flex-1 border-2 border-gray-200 rounded-xl"
              >
                返回主页
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">正在加载题目...</p>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:mx-0">
      {/* 顶部导航栏 - 简洁设计 */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 text-white px-3 py-3 sticky top-0 z-20 rounded-b-2xl shadow-lg">
        <div className="flex items-center justify-between">
          {/* 返回按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('确定要退出练习吗？')) {
                onExit();
              }
            }}
            className="bg-white/20 hover:bg-white/30 text-white rounded-xl px-3 h-10 gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">返回</span>
          </Button>
          
          {/* 答题卡和交卷按钮 */}
          <div className="flex items-center gap-1">
            {/* 答题卡按钮 */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAnswerSheet(true)}
              className="bg-white/20 hover:bg-white/30 text-white rounded-xl px-3 h-10"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            
            {/* 交卷按钮 */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm('确定要交卷吗？')) {
                  finishQuiz();
                }
              }}
              className="bg-white/20 hover:bg-white/30 text-white rounded-xl px-3 h-10 font-medium"
            >
              <FileCheck className="w-4 h-4" />
              <span className="ml-1 text-sm">交卷</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 题目内容区域 */}
      <div className="pb-24 sm:pb-32">
        {/* 题干 */}
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-b border-orange-100 sticky top-[56px] sm:top-[56px] z-10 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 sm:py-4">
            <div className="mb-2 flex items-center gap-2">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                currentQuestion.type === 'single' ? 'bg-blue-500 text-white' :
                currentQuestion.type === 'multiple' ? 'bg-purple-500 text-white' :
                currentQuestion.type === 'true-false' ? 'bg-orange-500 text-white' :
                currentQuestion.type === 'comprehensive' ? 'bg-red-500 text-white' :
                'bg-green-500 text-white'
              }`}>
                {currentQuestion.type === 'single' ? '单选' :
                 currentQuestion.type === 'multiple' ? '多选' :
                 currentQuestion.type === 'true-false' ? '判断' :
                 currentQuestion.type === 'comprehensive' ? '综合' : '填空'}
              </span>
              <span className="text-xs text-gray-500 font-medium">
                第 {quizState.currentIndex + 1} 题 / 共 {quizState.questions.length} 题
              </span>
            </div>
            
            {/* 案例背景（综合题显示） */}
            {currentQuestion.caseBackground && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-700 leading-relaxed whitespace-pre-wrap">
                    {currentQuestion.caseBackground}
                  </div>
                </div>
              </div>
            )}
            
            {/* 子题目指示器（综合题显示） */}
            {currentQuestion.type === 'comprehensive' && currentQuestion.children && currentQuestion.children.length > 0 && (
              <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                <span>子题 {currentChildIndex + 1}/{currentQuestion.children.length}</span>
                <span className="text-purple-600 font-medium">（{displayQuestion?.type === 'multiple' ? '多选' : displayQuestion?.type === 'single' ? '单选' : displayQuestion?.type === 'true-false' ? '判断' : '填空'}）</span>
              </div>
            )}
            
            <p className="text-base sm:text-lg font-semibold text-gray-800 leading-relaxed">
              {displayQuestion?.content}
            </p>
          </div>
        </div>

        {/* 选项区域 */}
        <div className="max-w-2xl mx-auto px-4 py-4">
          {/* 选项列表 */}
          <div className="space-y-3">
            {displayQuestion?.options?.map((option, index) => {
              const isSelected = Array.isArray(currentAnswer) 
                ? currentAnswer.includes(option.id)
                : currentAnswer === option.id;
              const isCorrectAnswer = Array.isArray(displayQuestion.answer)
                ? displayQuestion.answer.includes(option.id)
                : displayQuestion.answer === option.id;
              
              // 选中和显示结果时的样式
              let optionStyle = 'bg-white border-gray-200 hover:border-orange-300';
              if (isSelected && showExplanation) {
                // 显示结果后：选中且正确的绿色，选中且错误的红色
                optionStyle = isCorrectAnswer
                  ? 'bg-emerald-50 border-emerald-500'
                  : 'bg-red-50 border-red-500';
              } else if (isSelected) {
                // 未显示结果时：只显示选中状态
                optionStyle = 'bg-orange-50 border-orange-500';
              } else if (showExplanation && isCorrectAnswer) {
                // 显示结果后：未选中但正确的也显示绿色
                optionStyle = 'bg-emerald-50 border-emerald-500';
              }
              
              return (
                <div
                  key={option.id}
                  className={`flex items-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${optionStyle}`}
                  onClick={() => !showExplanation && displayQuestion && selectAnswer(displayQuestion.id, option.id)}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 font-bold text-sm ${
                    isSelected && showExplanation
                      ? isCorrectAnswer
                        ? 'bg-emerald-500 text-white'
                        : 'bg-red-500 text-white'
                      : isSelected
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-500'
                  }`}>
                    {isSelected ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      String.fromCharCode(65 + index)
                    )}
                  </div>
                  <span className="flex-1 text-sm font-medium">{option.text}</span>
                  {showExplanation && isCorrectAnswer && (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center ml-2">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  {showExplanation && isSelected && !isCorrectAnswer && (
                    <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center ml-2">
                      <X className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 答案与解析 - 需手动点击按钮显示 */}
          {showExplanation && (
            <div className="mt-4 space-y-2 sm:space-y-3">
              {/* 结果卡片 */}
              <div className={`rounded-xl p-3 sm:p-4 ${isCurrentCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${isCurrentCorrect ? 'bg-emerald-500' : 'bg-red-500'}`}>
                      {isCurrentCorrect ? <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> : <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
                    </div>
                    <span className={`text-sm sm:text-base font-bold ${isCurrentCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                      {isCurrentCorrect ? '太棒了！' : '再接再厉！'}
                    </span>
                  </div>
                  <div className="bg-white rounded-lg px-2 py-1 sm:px-3 sm:py-1">
                    <span className="text-xs sm:text-sm text-gray-500">答案：</span>
                    <span className="text-sm sm:text-lg font-bold text-emerald-600 ml-1">
                      {Array.isArray(displayQuestion?.answer) 
                        ? displayQuestion.answer.map(a => a.toUpperCase()).join(', ')
                        : displayQuestion?.answer?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* 解析 */}
              {displayQuestion?.explanation && (
                <div className="bg-amber-50 rounded-xl p-2 sm:p-3 border border-amber-200">
                  <div className="flex items-center gap-1 sm:gap-2 text-amber-700 mb-1">
                    <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="font-semibold text-xs sm:text-sm">解析</span>
                  </div>
                  <p className="text-amber-900 text-xs sm:text-sm leading-relaxed">
                    {displayQuestion.explanation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 底部固定操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 z-30">
        <div className="flex items-center justify-between gap-1 max-w-2xl mx-auto">
          {/* 上一题 */}
          <Button
            variant="outline"
            onClick={() => {
              // 如果是综合题的子题目，切换到上一个子题目
              if (currentQuestion?.type === 'comprehensive' && currentChildIndex > 0) {
                setCurrentChildIndex(prev => prev - 1);
                setShowExplanation(false);
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
              } else if (quizState.currentIndex > 0) {
                prevQuestion();
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
              }
            }}
            disabled={
              currentQuestion?.type === 'comprehensive' 
                ? currentChildIndex === 0 && quizState.currentIndex === 0
                : quizState.currentIndex === 0
            }
            className="h-10 px-3 rounded-lg border border-gray-200"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="ml-1 text-sm">
              {currentQuestion?.type === 'comprehensive' && currentChildIndex > 0 ? '上一子题' : '上一题'}
            </span>
          </Button>

          {/* 答案与解析按钮 */}
          <Button
            variant="outline"
            onClick={() => {
              submitAnswer();
              setShowExplanation(true);
            }}
            className="h-10 px-3 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700"
          >
            <BookOpen className="w-4 h-4" />
            <span className="ml-1 text-sm font-medium">答案与解析</span>
          </Button>

          {/* 下一题 / 下一子题 / 交卷 */}
          {(() => {
            const isComprehensive = currentQuestion?.type === 'comprehensive';
            const hasMoreChildren = isComprehensive && currentQuestion.children && currentChildIndex < currentQuestion.children.length - 1;
            const isLastQuestion = quizState.currentIndex === quizState.questions.length - 1;
            
            if (isLastQuestion && !hasMoreChildren) {
              // 最后一题且没有更多子题目，显示交卷
              return (
                <Button
                  onClick={() => finishQuiz()}
                  className="h-10 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl"
                >
                  <FileCheck className="w-4 h-4" />
                  <span className="ml-2 text-sm">交卷</span>
                </Button>
              );
            } else if (hasMoreChildren) {
              // 还有更多子题目，切换到下一个子题目
              return (
                <Button
                  onClick={() => {
                    setCurrentChildIndex(prev => prev + 1);
                    setShowExplanation(false);
                    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
                  }}
                  className="h-10 px-4 bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white font-medium rounded-xl"
                >
                  <span className="text-sm">下一子题</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              );
            } else {
              // 切换到下一大题
              return (
                <Button
                  onClick={() => {
                    nextQuestion();
                    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
                  }}
                  className="h-10 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl"
                >
                  <span className="text-sm">下一题</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              );
            }
          })()}
        </div>
      </div>

      {/* 答题卡弹窗 */}
      <Dialog open={showAnswerSheet} onOpenChange={setShowAnswerSheet}>
        <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[80vh] overflow-y-auto rounded-2xl p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <Grid3X3 className="w-4 h-4 text-white" />
                </div>
                答题卡
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAnswerSheet(false)}
                className="h-8 w-8 p-0 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
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
              const typeColor = type === 'single' ? 'bg-blue-500' : 
                               type === 'multiple' ? 'bg-purple-500' : 
                               type === 'true-false' ? 'bg-orange-500' : 
                               type === 'fill-blank' ? 'bg-green-500' : 'bg-red-500';
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${typeColor}`}></span>
                    <span className="text-sm font-medium text-gray-700">{typeLabel}</span>
                    <span className="text-xs text-gray-400">({typeQuestions.length}题)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {typeQuestions.map(({ q, idx }) => {
                      const answered = !!quizState.answers[q.id];
                      const record = recordStore.getByQuestionId(q.id);
                      const isWrong = answered && record.length > 0 && !record[record.length - 1].isCorrect;
                      const isCurrent = idx === quizState.currentIndex;
                      return (
                        <button
                          key={q.id}
                          onClick={() => {
                            goToQuestion(idx);
                            setShowAnswerSheet(false);
                          }}
                          className={`w-9 h-9 rounded-xl text-sm font-bold transition-all flex items-center justify-center ${
                            isCurrent
                              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                              : answered
                                ? isWrong
                                  ? 'bg-red-100 text-red-700 border-2 border-red-300'
                                  : 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                                : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200'
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
            <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-gradient-to-r from-orange-500 to-amber-500"></div>
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
                <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200"></div>
                <span>未答</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
