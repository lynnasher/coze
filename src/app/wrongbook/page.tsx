'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  BookOpen,
  Filter,
  RotateCcw,
  AlertCircle,
  Clock,
  Star,
  ArrowLeft,
  FileCheck,
  Grid3X3,
  FileText,
  Trophy,
  Target,
  BarChart3,
  Settings,
  History,
  Flame,
  Puzzle,
  User,
  RefreshCw
} from 'lucide-react';
import { questionStore, recordStore, getWrongQuestionIds, wrongStreakStore, generateId } from '@/lib/quiz-store';
import { Question, QuestionType } from '@/lib/types';
import Link from 'next/link';
import { UserStatus, AuthModal, getCurrentUser as getStoredUser } from '@/components/AuthModal';
import { RichTextWithBreaks } from '@/lib/rich-text';

// 题型统计
interface QuestionTypeStat {
  type: QuestionType;
  label: string;
  count: number;
  color: string;
  bgColor: string;
}

// 用户错题信息
interface UserWrongQuestion {
  questionId: string;
  wrongCount: number;
  correctCount: number;
  streak: number;
  lastWrongAt: string | null;
}

export default function WrongBookPage() {
  const [selectedType, setSelectedType] = useState<QuestionType | 'all'>('all');
  const [reviewMode, setReviewMode] = useState<'forgot' | 'byType' | 'all'>('forgot');
  const [showExplanation, setShowExplanation] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewQuestions, setReviewQuestions] = useState<Question[]>([]);
  const [localAnswer, setLocalAnswer] = useState<string | string[] | undefined>(undefined);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [userWrongQuestions, setUserWrongQuestions] = useState<UserWrongQuestion[]>([]);
  const [isLoadingWrongQuestions, setIsLoadingWrongQuestions] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const questionContentRef = useRef<HTMLDivElement>(null);

  // 检查认证状态
  const checkAuth = useCallback(() => {
    const user = getStoredUser();
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    setMounted(true);
    // 获取当前登录用户
    const user = getStoredUser();
    setCurrentUser(user);
  }, [checkAuth]);

  // 从云端获取用户错题记录
  const loadUserWrongQuestions = useCallback(async () => {
    if (!currentUser) return;
    
    setIsLoadingWrongQuestions(true);
    try {
      const token = localStorage.getItem('quiz_user_token');
      const response = await fetch('/api/wrong-questions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUserWrongQuestions(data.wrongQuestions || []);
        }
      }
    } catch (error) {
      console.error('加载错题失败:', error);
    } finally {
      setIsLoadingWrongQuestions(false);
    }
  }, [currentUser]);

  // 用户登录后加载错题
  useEffect(() => {
    if (currentUser && mounted) {
      loadUserWrongQuestions();
    } else {
      setUserWrongQuestions([]);
    }
  }, [currentUser, mounted, loadUserWrongQuestions]);

  // 从云端数据获取错题列表
  const wrongQuestions = useMemo(() => {
    // 从云端获取的错题中查找对应的题目详情
    const allQuestions = questionStore.getAll();
    return userWrongQuestions
      .map(wq => allQuestions.find(q => q.id === wq.questionId))
      .filter((q): q is Question => q !== undefined);
  }, [userWrongQuestions]);

  // 获取错题数量（从云端）
  const wrongQuestionIds = useMemo(() => {
    return userWrongQuestions.map(wq => wq.questionId);
  }, [userWrongQuestions]);

  // 按题型分组统计
  const typeStats = useMemo((): QuestionTypeStat[] => {
    const stats: Record<string, QuestionTypeStat> = {
      'single': { type: 'single', label: '单选题', count: 0, color: 'bg-indigo-500', bgColor: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
      'multiple': { type: 'multiple', label: '多选题', count: 0, color: 'bg-purple-500', bgColor: 'bg-purple-50 border-purple-200 text-purple-700' },
      'true-false': { type: 'true-false', label: '判断题', count: 0, color: 'bg-cyan-500', bgColor: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
      'fill-blank': { type: 'fill-blank', label: '填空题', count: 0, color: 'bg-teal-500', bgColor: 'bg-teal-50 border-teal-200 text-teal-700' },
      'comprehensive': { type: 'comprehensive', label: '综合题', count: 0, color: 'bg-rose-500', bgColor: 'bg-rose-50 border-rose-200 text-rose-700' },
    };
    
    wrongQuestions.forEach(q => {
      if (stats[q.type]) {
        stats[q.type].count++;
      }
    });
    
    return Object.entries(stats)
      .filter(([_, v]) => v.count > 0)
      .map(([key, v]) => v);
  }, [wrongQuestions]);

  // 根据筛选条件获取错题列表
  const filteredQuestions = useMemo(() => {
    let questions = [...wrongQuestions];
    
    if (selectedType !== 'all') {
      questions = questions.filter(q => q.type === selectedType);
    }
    
    if (reviewMode === 'forgot') {
      const streakStore = wrongStreakStore.getAll();
      questions.sort((a, b) => {
        const aStreak = streakStore[a.id] || 0;
        const bStreak = streakStore[b.id] || 0;
        const aRecords = recordStore.getAll().filter(r => r.questionId === a.id);
        const bRecords = recordStore.getAll().filter(r => r.questionId === b.id);
        const aWrong = aRecords.filter(r => !r.isCorrect).length;
        const bWrong = bRecords.filter(r => !r.isCorrect).length;
        const aLastWrong = aRecords.filter(r => !r.isCorrect).pop()?.timestamp || 0;
        const bLastWrong = bRecords.filter(r => !r.isCorrect).pop()?.timestamp || 0;
        
        if (Math.abs(aWrong - bWrong) > 1) return bWrong - aWrong;
        return aLastWrong - bLastWrong;
      });
    }
    
    return questions;
  }, [wrongQuestions, selectedType, reviewMode]);

  // 获取题目的错题信息
  const getWrongInfo = useCallback((questionId: string) => {
    const records = recordStore.getAll().filter(r => r.questionId === questionId);
    const wrongRecords = records.filter(r => !r.isCorrect);
    const correctRecords = records.filter(r => r.isCorrect);
    const streak = wrongStreakStore.get(questionId);
    const lastWrong = wrongRecords.length > 0 ? wrongRecords[wrongRecords.length - 1].timestamp : 0;
    const daysAgo = Math.floor((Date.now() - lastWrong) / (1000 * 60 * 60 * 24));
    
    return {
      wrongCount: wrongRecords.length,
      correctCount: correctRecords.length,
      streak,
      lastWrong,
      daysAgo,
    };
  }, []);

  // 开始错题复习
  const startReview = useCallback((type?: QuestionType | 'all') => {
    let questions = [...wrongQuestions];
    
    if (type && type !== 'all') {
      questions = questions.filter(q => q.type === type);
    }
    
    if (questions.length === 0) return;
    
    setReviewQuestions(questions);
    setReviewIndex(0);
    setShowExplanation(false);
    setLocalAnswer(undefined);
    setIsAnswerCorrect(false);
    setIsReviewing(true);
  }, [wrongQuestions]);

  // 获取当前复习的题目
  const currentReviewQuestion = reviewQuestions[reviewIndex];

  // 处理答案选择
  const handleSelectAnswer = useCallback((optionId: string, question: Question) => {
    if (question.type === 'multiple') {
      const current = Array.isArray(localAnswer) ? localAnswer : [];
      if (current.includes(optionId)) {
        setLocalAnswer(current.filter(id => id !== optionId));
      } else {
        setLocalAnswer([...current, optionId]);
      }
    } else {
      setLocalAnswer(optionId);
    }
  }, [localAnswer]);

  // 检查答案是否正确
  const checkAnswer = useCallback((question: Question, answer: string | string[] | undefined): boolean => {
    if (!answer) return false;
    
    if (Array.isArray(question.answer)) {
      const userAnswers = Array.isArray(answer) ? answer : [answer];
      return userAnswers.length === question.answer.length && 
             userAnswers.every(a => question.answer.includes(a));
    }
    
    return answer === question.answer;
  }, []);

  // 提交答案
  const handleSubmitAnswer = useCallback(() => {
    if (currentReviewQuestion && localAnswer !== undefined) {
      const correct = checkAnswer(currentReviewQuestion, localAnswer);
      setIsAnswerCorrect(correct);
      setShowExplanation(true);
      
      const record = {
        id: generateId(),
        questionId: currentReviewQuestion.id,
        isCorrect: correct,
        selectedAnswer: localAnswer,
        timestamp: Date.now(),
      };
      recordStore.add(record);
      
      if (correct) {
        wrongStreakStore.increment(currentReviewQuestion.id);
        const newStreak = wrongStreakStore.get(currentReviewQuestion.id);
        if (newStreak >= 3) {
          const records = recordStore.getAll().filter(r => !(r.questionId === currentReviewQuestion.id && !r.isCorrect));
          recordStore.save(records);
          wrongStreakStore.remove(currentReviewQuestion.id);
        }
      } else {
        wrongStreakStore.reset(currentReviewQuestion.id);
      }
    }
  }, [currentReviewQuestion, localAnswer, checkAnswer]);

  // 下一题
  const handleNext = useCallback(() => {
    if (reviewIndex < reviewQuestions.length - 1) {
      setReviewIndex(reviewIndex + 1);
      setShowExplanation(false);
      setLocalAnswer(undefined);
      setIsAnswerCorrect(false);
    } else {
      setIsReviewing(false);
    }
  }, [reviewIndex, reviewQuestions.length]);

  // 上一题
  const handlePrev = useCallback(() => {
    if (reviewIndex > 0) {
      setReviewIndex(reviewIndex - 1);
      setShowExplanation(false);
      setLocalAnswer(undefined);
      setIsAnswerCorrect(false);
    }
  }, [reviewIndex]);

  // 标记已掌握
  const markAsMastered = useCallback((questionId: string) => {
    const records = recordStore.getAll().filter(r => !(r.questionId === questionId && !r.isCorrect));
    recordStore.save(records);
    wrongStreakStore.remove(questionId);
    window.location.reload();
  }, []);

  // 获取选项字母
  const getOptionLabel = (index: number) => String.fromCharCode(65 + index);

  // 计算进度
  const progressPercent = reviewQuestions.length > 0 
    ? Math.round(((reviewIndex + 1) / reviewQuestions.length) * 100) 
    : 0;

  // 题型标签
  const getTypeStyle = (type: QuestionType) => {
    const styles: Record<QuestionType, { bg: string; label: string }> = {
      'single': { bg: 'bg-indigo-500', label: '单选题' },
      'multiple': { bg: 'bg-purple-500', label: '多选题' },
      'true-false': { bg: 'bg-cyan-500', label: '判断题' },
      'fill-blank': { bg: 'bg-teal-500', label: '填空题' },
      'comprehensive': { bg: 'bg-rose-500', label: '综合题' },
    };
    return styles[type] || { bg: 'bg-gray-500', label: '未知' };
  };

  // 错题复习做题页面（与正常做题页面一致的风格）
  if (isReviewing && currentReviewQuestion) {
    const wrongInfo = getWrongInfo(currentReviewQuestion.id);
    const typeStyle = getTypeStyle(currentReviewQuestion.type);
    
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Logo 头部导航 - 与首页一致 */}
        <header className="bg-white border-b border-slate-100">
          <div className="max-w-[970px] mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              {/* 产品标识 */}
              <div className="flex items-center gap-2">
                <Link href="/" className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-md">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-800">智能刷题</h1>
                    <p className="text-xs text-gray-400">错题复习</p>
                  </div>
                </Link>
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
        
        {/* 返回按钮栏 */}
        <div className="bg-white border-b border-slate-200 px-4 py-2 sticky top-[68px] z-20">
          <div className="max-w-[970px] mx-auto">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsReviewing(false)}
                className="text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg px-2 h-9 -ml-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">返回</span>
              </Button>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">
                  {reviewIndex + 1} / {reviewQuestions.length}
                </span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAsMastered(currentReviewQuestion.id)}
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg px-2 h-9"
              >
                <Check className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">已掌握</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 进度条 */}
        <div className="bg-white border-b border-slate-100 px-4 py-2">
          <div className="max-w-[970px] mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-500 min-w-[3rem] text-right">
                {progressPercent}%
              </span>
            </div>
          </div>
        </div>

        {/* 错题信息提示 */}
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2">
          <div className="max-w-[970px] mx-auto">
            <div className="flex items-center gap-4 text-sm text-amber-700">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>错题 {wrongInfo.wrongCount} 次</span>
              </div>
              <div className="flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" />
                <span>掌握度 {wrongInfo.streak}/3</span>
              </div>
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
                  <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold text-white ${typeStyle.bg}`}>
                    {typeStyle.label}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    第 {reviewIndex + 1} 题
                  </span>
                </div>
              </div>
              
              {/* 案例背景（综合题显示） */}
              {currentReviewQuestion.caseBackground && (
                <div className="mx-4 mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-indigo-700 leading-relaxed whitespace-pre-wrap">
                      {currentReviewQuestion.caseBackground}
                    </div>
                  </div>
                </div>
              )}
              
              {/* 题目内容 */}
              <div className="px-4 py-4">
                <div className="text-base font-medium text-slate-800 leading-relaxed">
                  <RichTextWithBreaks content={currentReviewQuestion.content || ''} textClassName="whitespace-pre-wrap" />
                </div>
              </div>
              
              {/* 分隔线 */}
              <div className="mx-4 h-px bg-slate-100" />
              
              {/* 选项区域 */}
              <div className="px-4 py-4">
                {currentReviewQuestion.options && currentReviewQuestion.options.length > 0 ? (
                  <div className="space-y-2.5">
                    {currentReviewQuestion.options.map((option, index) => {
                      const isMulti = currentReviewQuestion.type === 'multiple';
                      const isSelected = isMulti
                        ? Array.isArray(localAnswer) && localAnswer.includes(option.id)
                        : localAnswer === option.id;
                      const isCorrectOption = Array.isArray(currentReviewQuestion.answer)
                        ? currentReviewQuestion.answer.includes(option.id)
                        : currentReviewQuestion.answer === option.id;
                      
                      let optionStyle = 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30';
                      if (isSelected && showExplanation) {
                        optionStyle = isCorrectOption
                          ? 'bg-emerald-50 border-emerald-400'
                          : 'bg-red-50 border-red-400';
                      } else if (isSelected) {
                        optionStyle = 'bg-indigo-50 border-indigo-400';
                      } else if (showExplanation && isCorrectOption) {
                        optionStyle = 'bg-emerald-50 border-emerald-400';
                      }
                      
                      // 多选题处理逻辑
                      const handleOptionClick = () => {
                        if (showExplanation) return;
                        if (isMulti) {
                          const current = Array.isArray(localAnswer) ? localAnswer : [];
                          if (current.includes(option.id)) {
                            setLocalAnswer(current.filter(id => id !== option.id));
                          } else {
                            setLocalAnswer([...current, option.id]);
                          }
                        } else {
                          setLocalAnswer(option.id);
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
                              ? isCorrectOption
                                ? 'bg-emerald-500 text-white'
                                : 'bg-red-500 text-white'
                              : isSelected
                                ? 'bg-indigo-500 text-white'
                                : 'bg-slate-100 text-slate-400'
                          }`}>
                            {isMulti && isSelected ? (
                              <Check className="w-4 h-4" />
                            ) : isSelected ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              getOptionLabel(index)
                            )}
                          </div>
                          <div className="flex-1 text-sm font-medium text-slate-700">
                            <RichTextWithBreaks content={option.text} textClassName="whitespace-pre-wrap" />
                          </div>
                          {showExplanation && isCorrectOption && (
                            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center ml-2">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                          {showExplanation && isSelected && !isCorrectOption && (
                            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center ml-2">
                              <X className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* 填空题 */
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="输入你的答案"
                      value={(localAnswer as string) || ''}
                      onChange={(e) => !showExplanation && setLocalAnswer(e.target.value)}
                      disabled={showExplanation}
                      className="w-full px-4 py-3 text-base rounded-xl border-2 border-gray-200 focus:border-indigo-300 focus:outline-none bg-white disabled:bg-gray-50"
                    />
                  </div>
                )}
              </div>
              
              {/* 答案与解析 */}
              {showExplanation && (
                <div className="px-4 pb-4 space-y-3">
                  {/* 结果卡片 */}
                  <div className={`rounded-xl p-3.5 ${isAnswerCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isAnswerCorrect ? 'bg-emerald-500' : 'bg-red-500'}`}>
                          {isAnswerCorrect ? <Check className="w-5 h-5 text-white" /> : <X className="w-5 h-5 text-white" />}
                        </div>
                        <span className={`text-sm font-bold ${isAnswerCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                          {isAnswerCorrect ? '太棒了！' : '再接再厉！'}
                        </span>
                      </div>
                      <div className="bg-white rounded-lg px-2.5 py-1">
                        <span className="text-xs text-slate-500">答案</span>
                        <span className="text-sm font-bold text-emerald-600 ml-1.5">
                          {Array.isArray(currentReviewQuestion.answer) 
                            ? currentReviewQuestion.answer.map(a => a.toUpperCase()).join(', ')
                            : currentReviewQuestion.answer?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* 解析 */}
                  {currentReviewQuestion.explanation && (
                    <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-200">
                      <div className="flex items-center gap-2 text-amber-700 mb-2">
                        <BookOpen className="w-4 h-4" />
                        <span className="font-semibold text-sm">解析</span>
                      </div>
                      <div className="text-amber-900 text-sm leading-relaxed">
                        <RichTextWithBreaks content={currentReviewQuestion.explanation} textClassName="whitespace-pre-wrap" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 底部导航栏 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 z-20">
          <div className="max-w-[970px] mx-auto flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={reviewIndex === 0}
              className="rounded-xl h-10 px-4"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              <span>上一题</span>
            </Button>
            
            {!showExplanation ? (
              <Button
                onClick={handleSubmitAnswer}
                disabled={localAnswer === undefined || (Array.isArray(localAnswer) && localAnswer.length === 0)}
                className="rounded-xl h-10 px-6 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
              >
                提交答案
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                className="rounded-xl h-10 px-6 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
              >
                {reviewIndex < reviewQuestions.length - 1 ? '下一题' : '完成'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 错题本列表页面
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 - 与首页一致 */}
      <header className="bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-[970px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* 产品标识 */}
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-md">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-800">错题本</h1>
                  {mounted && currentUser && wrongQuestions.length > 0 ? (
                    <p className="text-xs text-orange-500 font-medium">{wrongQuestions.length} 道错题待复习</p>
                  ) : (
                    <p className="text-xs text-gray-400">巩固薄弱知识点</p>
                  )}
                </div>
              </Link>
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
        {/* 未登录提示 */}
        {!currentUser && mounted && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <User className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">请先登录</h2>
            <p className="text-slate-400 mb-6">登录后才能使用错题本功能</p>
            <Button 
              onClick={() => setAuthModalOpen(true)}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-xl h-11 px-6"
            >
              去登录
            </Button>
          </div>
        )}
        
        {/* 加载中 */}
        {currentUser && isLoadingWrongQuestions && (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mr-2" />
            <span className="text-slate-500">加载错题中...</span>
          </div>
        )}
        
        {/* 错题列表 - 仅登录用户可见 */}
        {currentUser && !isLoadingWrongQuestions && userWrongQuestions.length === 0 && (
          /* 空状态 */
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">太棒了！暂无错题</h2>
            <p className="text-slate-400">继续保持，做题全对不是梦</p>
            <Link href="/">
              <Button className="mt-6 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-xl h-11 px-6">
                去刷题
              </Button>
            </Link>
          </div>
        )}
        
        {currentUser && !isLoadingWrongQuestions && userWrongQuestions.length > 0 && (
          <div className="space-y-4">
            {/* 刷新按钮 */}
            <div className="flex justify-end">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => loadUserWrongQuestions()}
                className="text-slate-500"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                刷新
              </Button>
            </div>
            
            {/* 统计概览 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Puzzle className="w-3.5 h-3.5 text-purple-500" />
                </div>
                错题统计
              </h3>
              <div className="flex gap-4 text-center">
                <div className="flex-1 bg-red-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-red-600">{userWrongQuestions.length}</p>
                  <p className="text-xs text-red-400">错题数量</p>
                </div>
                <div className="flex-1 bg-emerald-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-emerald-600">
                    {userWrongQuestions.filter(q => q.streak >= 2).length}
                  </p>
                  <p className="text-xs text-emerald-400">即将掌握</p>
                </div>
              </div>
            </div>
            
            {/* 提示信息 */}
            <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-700">
              <p>错题来自您的练习记录，连续答对3次后将从错题本中移除</p>
            </div>
            
            {/* 题型分布 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Puzzle className="w-3.5 h-3.5 text-purple-500" />
                </div>
                错题列表（{userWrongQuestions.length} 道）
              </h3>
              <div className="space-y-2">
                {userWrongQuestions.map((wq, index) => {
                  const question = questionStore.getAll().find(q => q.id === wq.questionId);
                  if (!question) return null;
                  
                  const typeStyle = getTypeStyle(question.type);
                  
                  return (
                    <div 
                      key={wq.questionId}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold ${typeStyle.bg}`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {question.content.slice(0, 50)}...
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${typeStyle.bg} text-white`}>
                            {typeStyle.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            错 {wq.wrongCount} 次
                          </span>
                          {wq.streak > 0 && (
                            <span className="text-xs text-emerald-500">
                              已连续答对 {wq.streak} 次
                            </span>
                          )}
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setReviewQuestions([question]);
                          setReviewIndex(0);
                          setShowExplanation(false);
                          setLocalAnswer(undefined);
                          setIsAnswerCorrect(false);
                          setIsReviewing(true);
                        }}
                        className="shrink-0"
                      >
                        复习
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 登录弹窗 */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onAuthChange={checkAuth}
      />
    </div>
  );
}
