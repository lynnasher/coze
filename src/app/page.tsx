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
  Calendar
} from 'lucide-react';
import { questionStore, recordStore, bankStore, getWrongQuestionIds, generateId, recentPracticeStore, RecentPractice } from '@/lib/quiz-store';
import { Question, QuestionType, Difficulty, Category } from '@/lib/types';
import { BankCard } from '@/components/BankCard';
import { UserStatus, getCurrentUser as getStoredUser, AuthModal } from '@/components/AuthModal';

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
  
  // 最近练习记录状态
  const [recentPractices, setRecentPractices] = useState<RecentPractice[]>([]);
  
  // 统计页面日期筛选状态
  const [statsFilter, setStatsFilter] = useState<'day' | 'week' | 'month' | 'all'>('day');
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    phone: string;
    nickname?: string;
    role: string;
    activatedCategories?: string[];
  } | null>(null);
  
  // 登录弹窗状态
  const [authModalOpen, setAuthModalOpen] = useState(false);
  
  const [dbBanks, setDbBanks] = useState<Array<{
    id: string;
    name: string;
    description?: string;
    question_count?: number;
    category_id?: string;
    created_at?: string;
  }>>([]);
  
  // 只使用数据库的题库
  const banks = useMemo(() => {
    return dbBanks.map(b => ({
      id: b.id,
      name: b.name,
      description: b.description || '',
      questionIds: [],
      questionCount: b.question_count || 0,
      categoryId: b.category_id,
      createdAt: b.created_at ? new Date(b.created_at).getTime() : Date.now()
    }));
  }, [dbBanks]);
  
  // 从数据库加载分类
  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      // 备用：从 localStorage 获取
      const storedCategories = localStorage.getItem('quiz_categories');
      if (storedCategories) {
        setCategories(JSON.parse(storedCategories));
      }
    }
  }, []);
  
  // 从数据库加载题库
  const loadBanksFromDb = useCallback(async () => {
    try {
      const response = await fetch('/api/banks');
      if (response.ok) {
        const data = await response.json();
        setDbBanks(data.banks || []);
      }
    } catch (error) {
      console.error('从数据库加载题库失败:', error);
    }
  }, []);
  
  const loadQuestions = useCallback(async () => {
    setQuestions(questionStore.getAll());
    await loadCategories();
    loadBanksFromDb();
    // 加载最近练习记录
    setRecentPractices(recentPracticeStore.getRecent(3));
  }, [loadCategories, loadBanksFromDb]);

  // 确保组件在客户端挂载后才渲染依赖 localStorage 的数据
  useEffect(() => {
    setMounted(true);
  }, []);

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
          // 更新 React state
          setCurrentUser(prev => prev ? { ...prev, activatedCategories: data.activatedCategories } : null);
          // 同时更新 localStorage，确保刷新页面后数据一致
          const storedUser = localStorage.getItem('quiz_user_data');
          if (storedUser) {
            try {
              const userData = JSON.parse(storedUser);
              userData.activatedCategories = data.activatedCategories;
              localStorage.setItem('quiz_user_data', JSON.stringify(userData));
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      console.error('刷新激活分类失败:', error);
    }
  };

  // 加载题库
  useEffect(() => {
    console.log('加载题库...');
    fetch('/api/banks')
      .then(res => {
        console.log('响应状态:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('题库数据:', data);
        setDbBanks(data.banks || []);
      })
      .catch(err => {
        console.error('加载题库失败:', err);
      });
  }, []);

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

  // 监听 localStorage 变化，以便在用户登录/登出后刷新状态
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'quiz_user_data' || e.key === 'quiz_user_token') {
        const user = getCurrentUser();
        setCurrentUser(user);
        if (user) {
          refreshActivatedCategories(user.id);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 获取用户激活的分类ID列表
  // 规则：未登录用户不能做任何题库，登录用户只能做已激活分类的题库
  const getActivatedCategoryIds = useCallback(() => {
    if (!currentUser) {
      // 未登录用户：不能做任何题库
      console.log('getActivatedCategoryIds - 未登录用户');
      return [];
    }
    // 已登录用户：只能做已激活分类的题库
    const activated = currentUser.activatedCategories || [];
    console.log('getActivatedCategoryIds - 已登录用户, activatedCategories:', activated);
    // 如果没有激活任何分类，返回空数组
    return activated;
  }, [currentUser]);

  // 过滤出可用的分类（用于显示）
  const getAvailableCategories = useCallback(() => {
    const activatedIds = getActivatedCategoryIds();
    console.log('getAvailableCategories - activatedIds:', activatedIds);
    console.log('getAvailableCategories - categories:', categories.length);
    const result = categories.filter(c => !c.parentId && activatedIds.includes(c.id));
    console.log('getAvailableCategories - result:', result.length);
    return result;
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
            className="min-h-[80px] rounded-xl border-2 border-gray-200 focus:border-blue-300 bg-white text-sm"
          />
        </div>
      );
    }
    
    const getOptionStyle = (isSelected: boolean, isCorrectAnswer: boolean, showResult: boolean) => {
      if (showResult) {
        if (isSelected && isCorrectAnswer) {
          return 'border-emerald-500 bg-emerald-50 shadow-sm';
        }
        if (isSelected && !isCorrectAnswer) {
          return 'border-red-500 bg-red-50 shadow-sm';
        }
        if (isCorrectAnswer) {
          return 'border-emerald-400 bg-emerald-50/50';
        }
      }
      if (isSelected) {
        return 'border-blue-500 bg-blue-50 shadow-sm shadow-blue-500/10';
      }
      return 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30';
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
                className={`flex items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${getOptionStyle(isSelected, isCorrectAnswer, quizState.showResult)}`}
                onClick={() => !quizState.showResult && handleTrueFalseSelect(option.id)}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-2 font-bold text-sm transition-colors ${
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
                <span className="flex-1 text-sm font-medium">{option.text}</span>
                {quizState.showResult && isCorrectAnswer && (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
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
        <div className="space-y-2">
          {options.map((option: { id: string; text: string }, index: number) => {
            const correctAnswers = Array.isArray(currentQuestion.answer) 
              ? currentQuestion.answer 
              : [currentQuestion.answer];
            const isCorrectAnswer = correctAnswers.includes(option.id);
            const isSelected = Array.isArray(currentAnswer) && currentAnswer.includes(option.id);
            
            return (
              <div
                key={`multi-${index}-${option.id}`}
                className={`flex items-center p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer ${getOptionStyle(isSelected, isCorrectAnswer, quizState.showResult)}`}
                onClick={() => !quizState.showResult && handleMultiSelect(option.id, !isSelected)}
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
                  {option.id.toUpperCase()}
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
          <p className="text-xs text-gray-400 mt-2">* 此题为多选题，可选择多个答案</p>
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
    <div className="min-h-screen bg-gray-50">
      {/* 顶部区域 - 简洁清爽风格 */}
      <header className="bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-[970px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* 产品标识 */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-md">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">智能刷题</h1>
                <p className="text-xs text-gray-400">{questions.length} 道题目</p>
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

      {/* 主内容 */}
      <main className="max-w-[970px] mx-auto px-4 py-4">
        {/* 当 hasStarted 为 true 时，隐藏 Tabs，直接显示练习页面 */}
        {hasStarted ? (
          <PracticeView 
            onExit={() => {
              // 交卷时记录所有答案
              finishQuiz();
              // 重置练习状态
              resetQuiz();
              // 返回首页
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
          />
        ) : (
          <Tabs value={activeTab} onValueChange={(value) => {
            setActiveTab(value);
            // 切换标签页时重置展开状态
            setSelectedCategoryId(null);
            setPracticeBankId(null);
          }} className="space-y-6">
        {/* 功能标签导航 - 清新风格 */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4">
          {[
            { key: 'practice', icon: Home, label: '首页', color: 'bg-emerald-500' },
            { key: 'library', icon: Library, label: '题库', color: 'bg-blue-500' },
            { key: 'stats', icon: BarChart3, label: '统计', color: 'bg-violet-500' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                // 切换标签页时重置展开状态
                setSelectedCategoryId(null);
                setPracticeBankId(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? `${tab.color} text-white shadow-md`
                  : 'text-gray-500 hover:bg-white/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

          {/* 练习页面 - 单栏布局 */}
          <TabsContent value="practice">
            <div className="space-y-4">
              {/* 宣传图区域 */}
              <div className="rounded-2xl overflow-hidden shadow-sm">
                <img 
                  src="https://coze-coding-project.tos.coze.site/coze_storage_7627388534718103615/image/generate_image_1d4f58e3-afe1-4357-9ac8-92a08a77cc5c.jpeg?sign=1807788692-32b74fe686-0-8b149b77cd7c9a0b904429699ef25a0dd3578dfd4ebce3d49afc914c91250132" 
                  alt="智能刷题助手"
                  className="w-full object-cover"
                  style={{ maxHeight: '160px' }}
                />
              </div>

              {/* 学习成就卡片 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <div className="w-6 h-6 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  学习成就
                </h3>
                
                {/* 连续学习天数 */}
                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl mb-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Flame className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-600">7</p>
                    <p className="text-xs text-gray-500">连续学习天数</p>
                  </div>
                </div>
                
                {/* 已掌握和正确率 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl p-3 text-white text-center">
                    <p className="text-2xl font-bold">{mounted ? stats.masteredCount : '-'}</p>
                    <p className="text-xs opacity-80">已掌握</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl p-3 text-white text-center">
                    <p className="text-2xl font-bold">{mounted ? stats.accuracy : 0}%</p>
                    <p className="text-xs opacity-80">正确率</p>
                  </div>
                </div>
                
                {/* 错题本入口 */}
                <Link href="/wrongbook">
                  <div className="mt-3 p-3 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-100 cursor-pointer hover:border-red-200 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">错题本</p>
                        <p className="text-xs text-gray-500">{mounted ? stats.wrongQuestionIds.length : '-'} 道待复习</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </Link>
              </div>

              {/* 登录提示 */}
                {!currentUser && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 shadow-sm border border-amber-100">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <User className="w-6 h-6 text-amber-500" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-800">登录解锁全部功能</h4>
                        <p className="text-xs text-gray-500 mt-0.5">激活码激活、错题本、学习统计</p>
                      </div>
                      <Button 
                        size="sm" 
                        className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
                        onClick={() => setAuthModalOpen(true)}
                      >
                        登录
                      </Button>
                    </div>
                  </div>
                )}
            </div>
          </TabsContent>

          {/* 题库浏览页面 */}
          <TabsContent value="library">
            {/* 标题区域 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Library className="w-4 h-4 text-blue-500" />
                </div>
                题库浏览
              </h2>
              <p className="text-sm text-gray-400 mt-1">点击题库开始练习</p>
            </div>

            {/* 未登录或无激活分类时的提示 - 清新简洁风格 */}
            {(!currentUser || getActivatedCategoryIds().length === 0) && (
              <div className="bg-white rounded-2xl p-6 shadow-sm mb-4 text-center">
                <div className="w-14 h-14 mx-auto mb-3 bg-amber-50 rounded-2xl flex items-center justify-center">
                  <BookOpen className="w-7 h-7 text-amber-400" />
                </div>
                {!currentUser ? (
                  <>
                    <h3 className="text-base font-semibold text-gray-800 mb-1">请先登录</h3>
                    <p className="text-gray-400 text-sm mb-3">登录后才能访问题库</p>
                    <Button 
                      size="sm" 
                      className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
                      onClick={() => setAuthModalOpen(true)}
                    >
                      去登录
                    </Button>
                  </>
                ) : (
                  <>
                    <h3 className="text-base font-semibold text-gray-800 mb-1">暂无激活分类</h3>
                    <p className="text-gray-400 text-sm mb-3">您还没有激活任何分类，请使用激活码激活</p>
                    <Link href="/profile">
                      <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg">
                        去激活
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            )}

            {/* 题库列表 - 按分类分组，默认折叠 */}
            <div className="space-y-3">
              {banks.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
                  <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <Library className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="text-gray-500 text-sm">暂无题库</p>
                  <p className="text-gray-400 text-xs mt-1">请联系管理员导入题库</p>
                </div>
              ) : (
                <>
                  {/* 未分类题库 - 只有已登录用户才能访问 */}
                  {currentUser && banks.filter(b => !b.categoryId).length > 0 && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <FolderOpen className="w-4 h-4 text-slate-400" />
                        <h3 className="text-sm font-semibold text-gray-700">未分类</h3>
                        <span className="text-xs text-gray-400">({banks.filter(b => !b.categoryId).length})</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {banks.filter(b => !b.categoryId).map((bank) => (
                          <BankCard 
                            key={bank.id} 
                            bank={bank} 
                            onStartPractice={(bankId) => {
                              setPracticeBankId(bankId);
                              setActiveTab('practice');
                              startQuiz('sequential', bankId);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* 按分类显示题库 - 支持二级分类，点击展开 */}
                  {(() => {
                    const activatedIds = getActivatedCategoryIds();
                    // 只显示已激活的分类（包括一级和二级分类）
                    const visibleCategories = categories.filter(c => 
                      activatedIds.includes(c.id) || 
                      (c.parentId && activatedIds.includes(c.parentId))
                    );
                    
                    if (visibleCategories.length === 0) {
                      return null;
                    }
                    
                    return (
                      <>
                        {visibleCategories.map(category => {
                          // 获取该分类下的所有直接子分类（只显示已激活的）
                          const childCategories = categories.filter(c => 
                            c.parentId === category.id && activatedIds.includes(c.id)
                          );
                          
                          // 获取该分类的直接题库
                          const categoryBanks = banks.filter(b => b.categoryId === category.id);
                          
                          // 获取所有子分类的题库
                          const childCategoryBanks = childCategories.flatMap(child => 
                            banks.filter(b => b.categoryId === child.id)
                          );
                          
                          // 如果该分类和子分类都没有题库，则不显示
                          if (categoryBanks.length === 0 && childCategoryBanks.length === 0) return null;
                          
                          return (
                            <div key={category.id} className="bg-white rounded-2xl p-4 shadow-sm">
                              {/* 顶级分类 - 可点击展开 */}
                              <div 
                                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded-lg transition-colors"
                                onClick={() => setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)}
                              >
                                {selectedCategoryId === category.id ? (
                                  <FolderOpen className="w-4 h-4 text-slate-600" />
                                ) : (
                                  <Folder className="w-4 h-4 text-slate-400" />
                                )}
                                <span className={`text-sm font-semibold px-2 py-0.5 rounded ${
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
                                <span className="text-xs text-gray-400">
                                  ({categoryBanks.length + childCategoryBanks.length})
                                </span>
                                <ChevronRight className={`w-4 h-4 text-gray-300 ml-auto transition-transform ${selectedCategoryId === category.id ? 'rotate-90' : ''}`} />
                              </div>
                            
                              {/* 展开时显示题库 */}
                              {selectedCategoryId === category.id && (
                                <div className="mt-4 space-y-4">
                                  {/* 该分类的直接题库 */}
                                  {categoryBanks.length > 0 && (
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs text-gray-400">直接题库</span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        {categoryBanks.map((bank) => (
                                          <BankCard 
                                            key={bank.id} 
                                            bank={bank} 
                                            onStartPractice={(bankId) => {
                                              setPracticeBankId(bankId);
                                              setActiveTab('practice');
                                              startQuiz('sequential', bankId);
                                            }}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* 子分类 */}
                                  {childCategories.map(child => {
                                    const childBanks = banks.filter(b => b.categoryId === child.id);
                                    if (childBanks.length === 0) return null;
                                    
                                    return (
                                      <div key={child.id}>
                                        <div className="flex items-center gap-2 mb-2">
                                          <FolderOpen className="w-3 h-3 text-gray-400" />
                                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
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
                                          </span>
                                          <span className="text-xs text-gray-400">({childBanks.length})</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          {childBanks.map((bank) => (
                                            <BankCard 
                                              key={bank.id} 
                                              bank={bank} 
                                              onStartPractice={(bankId) => {
                                                setPracticeBankId(bankId);
                                                setActiveTab('practice');
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
                
                // 只统计用户实际作答过的题目（排除空答题记录）
                const answeredRecords = filteredRecords.filter(r => {
                  if (!r.selectedAnswer) return false;
                  const answer = Array.isArray(r.selectedAnswer) ? r.selectedAnswer : String(r.selectedAnswer);
                  return answer.length > 0;
                });
                
                const totalCount = answeredRecords.length;
                const correctCount = answeredRecords.filter(r => r.isCorrect).length;
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
                  
                  {/* 错题本导航卡片 */}
                  <Link href="/wrongbook">
                    <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 transition-all cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 text-white">
                            <p className="text-lg font-bold">错题本</p>
                            <p className="text-sm opacity-80">{mounted ? getWrongQuestionIds().length : '-'} 道待复习</p>
                          </div>
                          <ChevronRight className="w-6 h-6 text-white/60" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      )}
    </main>
    
    {/* 登录弹窗 */}
    <AuthModal
      open={authModalOpen}
      onOpenChange={setAuthModalOpen}
      onAuthChange={() => {
        // 刷新用户状态
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
  resetQuiz: ReturnType<typeof useQuiz>['resetQuiz'];
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
}: PracticeViewProps) {
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  // 答案与解析显示状态（不自动显示，需手动点击按钮）
  const [showExplanation, setShowExplanation] = useState(false);
  // 当前综合题的子题目索引
  const [currentChildIndex, setCurrentChildIndex] = useState(0);
  // 题目内容区域的 ref，用于滚动聚焦
  const questionContentRef = useRef<HTMLDivElement>(null);
  
  // 切换题目时重置答案与解析显示状态
  useEffect(() => {
    setShowExplanation(false);
    setCurrentChildIndex(0);
  }, [quizState.currentIndex]);
  
  // 获取当前要显示的题目（综合题显示子题目）
  const displayQuestion = useMemo(() => {
    if (!currentQuestion) return null;
    // 如果是综合题且有子题目，返回当前子题目
    if (currentQuestion.type === 'comprehensive' && currentQuestion.children && currentQuestion.children.length > 0) {
      const child = currentQuestion.children[currentChildIndex];
      if (child) return child;
    }
    return currentQuestion;
  }, [currentQuestion, currentChildIndex]);
  
  const isCurrentCorrect = useMemo(() => {
    if (!displayQuestion || !currentAnswer) return false;
    if (Array.isArray(displayQuestion.answer)) {
      return Array.isArray(currentAnswer) && 
        displayQuestion.answer.every(a => currentAnswer.includes(a));
    }
    return currentAnswer === displayQuestion.answer;
  }, [displayQuestion, currentAnswer]);
  
  // 计算进度 - 使用 useMemo 避免重复计算
  const { answeredCount, progressPercent } = useMemo(() => {
    const count = quizState.questions.filter(q => quizState.answers[q.id] !== undefined).length;
    const percent = quizState.questions.length > 0 
      ? Math.round((count / quizState.questions.length) * 100) 
      : 0;
    return { answeredCount: count, progressPercent: percent };
  }, [quizState.questions, quizState.answers]);
  
  // 交卷并返回首页（不显示完成弹窗）
  const handleFinishAndExit = useCallback(() => {
    if (confirm('确定要交卷吗？')) {
      // 直接返回首页，PracticeView 会被卸载
      // onExit 会处理状态重置
      onExit();
    }
  }, [onExit]);
  
  // 滚动到题目内容区域
  const scrollToQuestion = useCallback(() => {
    if (questionContentRef.current) {
      questionContentRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, []);
  
  // 如果正在加载，显示加载状态
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
  
  // 交卷后直接返回首页，不显示完成页面
  // PracticeView 会被立即卸载，所以这个分支不会被渲染
  if (quizState.isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center animate-pulse shadow-lg">
            <FileCheck className="w-10 h-10 text-white" />
          </div>
          <p className="text-slate-600 font-medium">正在返回首页...</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">正在加载题目...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航栏 - 紧凑设计 */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20">
        <div className="max-w-[970px] mx-auto">
          <div className="flex items-center justify-between">
            {/* 左侧：返回按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm('确定要退出练习吗？')) {
                  onExit();
                }
              }}
              className="text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg px-2 h-9 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span className="text-sm font-medium">返回</span>
            </Button>
            
            {/* 中间：题号 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">
                {quizState.currentIndex + 1} / {quizState.questions.length}
              </span>
            </div>
            
            {/* 右侧：交卷 + 答题卡 */}
            <div className="flex items-center gap-1">
              {/* 交卷按钮 */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleFinishAndExit()}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg px-2 h-9"
              >
                <FileCheck className="w-4 h-4" />
                <span className="text-sm font-medium ml-1">交卷</span>
              </Button>
              
              {/* 答题卡 */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAnswerSheet(true)}
                className="text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg px-2 h-9 -mr-2"
              >
                <Grid3X3 className="w-4 h-4" />
                <span className="text-sm font-medium ml-1.5">答题卡</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

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
      <div className="pb-28" ref={questionContentRef}>
        <div className="max-w-[970px] mx-auto px-4 py-4">
          {/* 题目卡片 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* 题干头部 */}
            <div className="px-4 py-3 border-b border-slate-50 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center justify-between gap-2">
                {/* 左侧：题型标签 */}
                <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold text-white ${
                  displayQuestion?.type === 'single' ? 'bg-indigo-500' :
                  displayQuestion?.type === 'multiple' ? 'bg-purple-500' :
                  displayQuestion?.type === 'true-false' ? 'bg-cyan-500' :
                  displayQuestion?.type === 'comprehensive' ? 'bg-rose-500' :
                  'bg-teal-500'
                }`}>
                  {displayQuestion?.type === 'single' ? '单选题' :
                   displayQuestion?.type === 'multiple' ? '多选题' :
                   displayQuestion?.type === 'true-false' ? '判断题' :
                   displayQuestion?.type === 'comprehensive' ? '综合题' : '填空题'}
                </span>
                
                {/* 右侧：题号 */}
                <span className="text-xs text-slate-500 font-medium">
                  {currentQuestion.type === 'comprehensive' && currentQuestion.children && currentQuestion.children.length > 0 ? (
                    <>子题 {currentChildIndex + 1}/{currentQuestion.children.length}</>
                  ) : (
                    <>第 {quizState.currentIndex + 1} 题</>
                  )}
                </span>
              </div>
            </div>
            
            {/* 案例背景（综合题显示） */}
            {currentQuestion.caseBackground && (
              <div className="mx-4 mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-indigo-700 leading-relaxed whitespace-pre-wrap">
                    {currentQuestion.caseBackground}
                  </div>
                </div>
              </div>
            )}
            
            {/* 题目内容 */}
            <div className="px-4 py-4">
              <p className="text-base font-medium text-slate-800 leading-relaxed">
                {displayQuestion?.content}
              </p>
            </div>
            
            {/* 分隔线 */}
            <div className="mx-4 h-px bg-slate-100" />
            
            {/* 选项区域 */}
            <div className="px-4 py-4">
              {/* 选项列表 */}
              <div className="space-y-2.5">
                {displayQuestion?.options?.map((option, index) => {
                  const isMulti = displayQuestion.type === 'multiple';
                  const isSelected = isMulti
                    ? Array.isArray(currentAnswer) && currentAnswer.includes(option.id)
                    : currentAnswer === option.id;
                  const isCorrectAnswer = Array.isArray(displayQuestion.answer)
                    ? displayQuestion.answer.includes(option.id)
                    : displayQuestion.answer === option.id;
                  
                  // 选中和显示结果时的样式
                  let optionStyle = 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30';
                  if (isSelected && showExplanation) {
                    // 显示结果后：选中且正确的绿色，选中且错误的红色
                    optionStyle = isCorrectAnswer
                      ? 'bg-emerald-50 border-emerald-400'
                      : 'bg-red-50 border-red-400';
                  } else if (isSelected) {
                    // 未显示结果时：只显示选中状态
                    optionStyle = 'bg-indigo-50 border-indigo-400';
                  } else if (showExplanation && isCorrectAnswer) {
                    // 显示结果后：未选中但正确的也显示绿色
                    optionStyle = 'bg-emerald-50 border-emerald-400';
                  }
                  
                  // 多选题处理逻辑
                  const handleOptionClick = () => {
                    if (showExplanation || !displayQuestion) return;
                    if (isMulti) {
                      // 多选题：切换选项选中状态
                      const current = Array.isArray(currentAnswer) ? currentAnswer : [];
                      if (current.includes(option.id)) {
                        selectAnswer(displayQuestion.id, current.filter(id => id !== option.id));
                      } else {
                        selectAnswer(displayQuestion.id, [...current, option.id]);
                      }
                    } else {
                      // 单选题/判断题：直接选择
                      selectAnswer(displayQuestion.id, option.id);
                    }
                  };
                  
                  return (
                    <div
                      key={option.id}
                      className={`flex items-center p-3.5 rounded-xl border-2 transition-all duration-200 cursor-pointer ${optionStyle}`}
                      onClick={handleOptionClick}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center mr-3 font-bold text-xs transition-colors ${
                        isSelected && showExplanation
                          ? isCorrectAnswer
                            ? 'bg-emerald-500 text-white'
                            : 'bg-red-500 text-white'
                          : isSelected
                            ? 'bg-indigo-500 text-white'
                            : 'bg-slate-100 text-slate-400'
                      }`}>
                        {isSelected ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          String.fromCharCode(65 + index)
                        )}
                      </div>
                      <span className="flex-1 text-sm font-medium text-slate-700">{option.text}</span>
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
            
            {/* 答案与解析 - 需手动点击按钮显示 */}
            {showExplanation && (
              <div className="px-4 pb-4 space-y-3">
                {/* 结果卡片 */}
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
                
                {/* 解析 */}
                {displayQuestion?.explanation && (
                  <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-200">
                    <div className="flex items-center gap-2 text-amber-700 mb-2">
                      <BookOpen className="w-4 h-4" />
                      <span className="font-semibold text-sm">解析</span>
                    </div>
                    <p className="text-amber-900 text-sm leading-relaxed">
                      {displayQuestion.explanation}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部固定操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-4 py-3 z-30">
        <div className="max-w-[970px] mx-auto">
          <div className="flex items-center justify-between gap-3">
            {/* 上一题 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // 如果是综合题的子题目，切换到上一个子题目
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
              <span className="ml-1 text-sm font-medium">
                {currentQuestion?.type === 'comprehensive' && currentChildIndex > 0 ? '上一子题' : '上一题'}
              </span>
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

            {/* 下一题 / 下一子题 / 交卷 */}
            {(() => {
              const isComprehensive = currentQuestion?.type === 'comprehensive';
              const hasMoreChildren = isComprehensive && currentQuestion.children && currentChildIndex < currentQuestion.children.length - 1;
              const isLastQuestion = quizState.currentIndex === quizState.questions.length - 1;
              
              if (isLastQuestion && !hasMoreChildren) {
                // 最后一题且没有更多子题目，显示交卷
                return (
                  <Button
                    size="sm"
                    onClick={() => handleFinishAndExit()}
                    className="h-9 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-xl"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span className="ml-1.5 text-sm">交卷</span>
                  </Button>
                );
              } else if (hasMoreChildren) {
                // 还有更多子题目，切换到下一个子题目
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
                    <span className="text-sm">下一子题</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                );
              } else {
                // 切换到下一大题
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
              const typeColor = type === 'single' ? 'bg-indigo-500' : 
                               type === 'multiple' ? 'bg-purple-500' : 
                               type === 'true-false' ? 'bg-cyan-500' : 
                               type === 'fill-blank' ? 'bg-teal-500' : 'bg-rose-500';
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${typeColor}`}></span>
                    <span className="text-sm font-medium text-slate-700">{typeLabel}</span>
                    <span className="text-xs text-slate-400">({typeQuestions.length}题)</span>
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
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
