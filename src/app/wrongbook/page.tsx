'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  BookOpen,
  ArrowLeft,
  Settings,
  User,
  RefreshCw,
} from 'lucide-react';
import { questionStore, recordStore, getWrongQuestionIds, wrongStreakStore, generateId, cloudSyncService } from '@/lib/quiz-store';
import { Question, QuestionType } from '@/lib/types';
import Link from 'next/link';
import { UserStatus, AuthModal, getCurrentUser as getStoredUser } from '@/components/AuthModal';
import { RichTextWithBreaks } from '@/lib/rich-text';

const TYPE_LABELS: Record<QuestionType, string> = {
  'single': '单选',
  'multiple': '多选',
  'true-false': '判断',
  'fill-blank': '填空',
  'comprehensive': '综合',
};

const TYPE_COLORS: Record<QuestionType, { bg: string; text: string; light: string }> = {
  'single': { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50' },
  'multiple': { bg: 'bg-violet-500', text: 'text-violet-600', light: 'bg-violet-50' },
  'true-false': { bg: 'bg-cyan-500', text: 'text-cyan-600', light: 'bg-cyan-50' },
  'fill-blank': { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50' },
  'comprehensive': { bg: 'bg-rose-500', text: 'text-rose-600', light: 'bg-rose-50' },
};

export default function WrongBookPage() {
  const [showExplanation, setShowExplanation] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewQuestions, setReviewQuestions] = useState<Question[]>([]);
  const [localAnswer, setLocalAnswer] = useState<string | string[] | undefined>(undefined);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<QuestionType | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const checkAuth = useCallback(() => {
    setCurrentUser(getStoredUser());
  }, []);

  const refreshData = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const recalculateWrongData = useCallback(() => {
    const records = recordStore.getAll();
    const wrongQuestionIds = new Set<string>();
    records.forEach(r => {
      if (!r.selectedAnswer) return;
      if (!r.isCorrect) wrongQuestionIds.add(r.questionId);
    });
    const newStreaks: Record<string, number> = {};
    const masteredIds: string[] = [];
    wrongQuestionIds.forEach(qId => {
      const qRecords = records.filter(r => r.questionId === qId && r.selectedAnswer).sort((a, b) => a.timestamp - b.timestamp);
      let streak = 0;
      for (let i = qRecords.length - 1; i >= 0; i--) {
        if (qRecords[i].isCorrect) streak++;
        else break;
      }
      if (streak >= 3) masteredIds.push(qId);
      else newStreaks[qId] = streak;
    });
    if (masteredIds.length > 0) {
      recordStore.save(records.filter(r => !(masteredIds.includes(r.questionId) && !r.isCorrect)));
    }
    wrongStreakStore.save(newStreaks);
    refreshData();
  }, [refreshData]);

  const syncFromCloud = useCallback(async () => {
    const user = getStoredUser();
    if (!user) return;
    setIsSyncing(true);
    try {
      await cloudSyncService.saveRecordsAndStreaks(user.id, recordStore.getAll(), wrongStreakStore.getAll());
      const cloudData = await cloudSyncService.pullData(user.id);
      if (cloudData) {
        recordStore.save(cloudData.records);
        wrongStreakStore.save(cloudData.streaks);
      }
    } finally {
      setIsSyncing(false);
      recalculateWrongData();
    }
  }, [recalculateWrongData]);

  useEffect(() => {
    setMounted(true);
    const user = getStoredUser();
    setCurrentUser(user);
    if (user) syncFromCloud();
  }, [checkAuth, syncFromCloud]);

  const wrongQuestions = useMemo(() => {
    const wrongIds = getWrongQuestionIds();
    const allQuestions = questionStore.getAll();
    return wrongIds.map(id => allQuestions.find(q => q.id === id)).filter((q): q is Question => q !== undefined);
  }, [refreshKey]);

  const filteredQuestions = useMemo(() => {
    if (typeFilter === 'all') return wrongQuestions;
    return wrongQuestions.filter(q => q.type === typeFilter);
  }, [wrongQuestions, typeFilter]);

  const totalPages = Math.ceil(filteredQuestions.length / PAGE_SIZE);
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredQuestions.slice(start, start + PAGE_SIZE);
  }, [filteredQuestions, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [typeFilter]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: wrongQuestions.length };
    wrongQuestions.forEach(q => { counts[q.type] = (counts[q.type] || 0) + 1; });
    return counts;
  }, [wrongQuestions]);

  const getWrongInfo = useCallback((questionId: string) => {
    const records = recordStore.getAll().filter(r => r.questionId === questionId);
    return { 
      wrongCount: records.filter(r => !r.isCorrect).length, 
      streak: wrongStreakStore.get(questionId) 
    };
  }, []);

  const progressPercent = reviewQuestions.length > 0 ? Math.round(((reviewIndex + 1) / reviewQuestions.length) * 100) : 0;
  const currentReviewQuestion = reviewQuestions[reviewIndex];

  const startReview = useCallback((questions: Question[]) => {
    if (questions.length === 0) return;
    setReviewQuestions(questions);
    setReviewIndex(0);
    setShowExplanation(false);
    setLocalAnswer(undefined);
    setIsAnswerCorrect(false);
    setIsReviewing(true);
  }, []);

  const handleSubmitAnswer = useCallback(() => {
    if (currentReviewQuestion && localAnswer !== undefined) {
      const correct = checkAnswerInline(currentReviewQuestion, localAnswer);
      setIsAnswerCorrect(correct);
      setShowExplanation(true);
      const record = { 
        id: generateId(), 
        questionId: currentReviewQuestion.id, 
        isCorrect: correct, 
        selectedAnswer: localAnswer, 
        timestamp: Date.now() 
      };
      recordStore.add(record);
      if (correct) {
        wrongStreakStore.increment(currentReviewQuestion.id);
        if (wrongStreakStore.get(currentReviewQuestion.id) >= 3) {
          recordStore.save(recordStore.getAll().filter(r => !(r.questionId === currentReviewQuestion.id && !r.isCorrect)));
          wrongStreakStore.remove(currentReviewQuestion.id);
        }
      } else {
        wrongStreakStore.reset(currentReviewQuestion.id);
      }
      const user = getStoredUser();
      if (user) {
        cloudSyncService.saveRecordsAndStreaks(user.id, recordStore.getAll(), wrongStreakStore.getAll());
      }
    }
  }, [currentReviewQuestion, localAnswer]);

  const handleNext = useCallback(() => {
    if (reviewIndex < reviewQuestions.length - 1) {
      setReviewIndex(reviewIndex + 1);
      setShowExplanation(false);
      setLocalAnswer(undefined);
      setIsAnswerCorrect(false);
    } else {
      setIsReviewing(false);
      refreshData();
    }
  }, [reviewIndex, reviewQuestions.length, refreshData]);

  const handlePrev = useCallback(() => {
    if (reviewIndex > 0) {
      setReviewIndex(reviewIndex - 1);
      setShowExplanation(false);
      setLocalAnswer(undefined);
      setIsAnswerCorrect(false);
    }
  }, [reviewIndex]);

  const markAsMastered = useCallback((questionId: string) => {
    recordStore.save(recordStore.getAll().filter(r => !(r.questionId === questionId && !r.isCorrect)));
    wrongStreakStore.remove(questionId);
    const user = getStoredUser();
    if (user) {
      cloudSyncService.saveRecordsAndStreaks(user.id, recordStore.getAll(), wrongStreakStore.getAll());
    }
    // 自动跳到下一题，如果没有下一题则返回错题本
    if (reviewIndex < reviewQuestions.length - 1) {
      setReviewIndex(reviewIndex + 1);
      setShowExplanation(false);
      setLocalAnswer(undefined);
      setIsAnswerCorrect(false);
    } else {
      setIsReviewing(false);
      refreshData();
    }
  }, [reviewIndex, reviewQuestions.length, refreshData]);

  function checkAnswerInline(question: Question, answer: string | string[] | undefined): boolean {
    if (!answer) return false;
    if (Array.isArray(question.answer)) {
      const userAnswers = Array.isArray(answer) ? answer : [answer];
      return userAnswers.length === question.answer.length && userAnswers.every(a => question.answer.includes(a));
    }
    return answer === question.answer;
  }

  const getOptionLabel = (index: number) => String.fromCharCode(65 + index);

  // ============ 复习模式 - 与首页做题页面保持一致风格 ============
  if (isReviewing && currentReviewQuestion) {
    const wrongInfo = getWrongInfo(currentReviewQuestion.id);

    return (
      <div className="min-h-screen bg-slate-50">
        {/* 顶部导航栏 - 与首页一致 */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20">
          <div className="max-w-[970px] mx-auto">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setIsReviewing(false); refreshData(); }}
                className="text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg px-2 h-9 -ml-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">返回</span>
              </Button>
              
              <span className="text-sm text-slate-600">
                {reviewIndex + 1} / {reviewQuestions.length}
              </span>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAsMastered(currentReviewQuestion.id)}
                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg px-2 h-9"
                  title="已掌握"
                >
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 进度条 - 与首页一致 */}
        <div className="bg-white border-b border-slate-100 px-4 py-2">
          <div className="max-w-[970px] mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="text-xs font-medium text-slate-500 min-w-[3rem] text-right">{progressPercent}%</span>
            </div>
          </div>
        </div>

        {/* 错题统计提示 */}
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2">
          <div className="max-w-[970px] mx-auto flex gap-4 text-sm text-amber-700">
            <span>错题 <span className="font-semibold">{wrongInfo.wrongCount}</span> 次</span>
            <span>掌握度 <span className="font-semibold">{wrongInfo.streak}</span>/3</span>
          </div>
        </div>

        {/* 题目内容区域 */}
        <div className="pb-28">
          <div className="max-w-[970px] mx-auto sm:px-4 py-3">
            {/* 题目卡片 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              {/* 题干头部 */}
              <div className="sm:px-4 px-3 py-2.5 border-b border-slate-50 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold text-white ${
                    currentReviewQuestion.type === 'single' ? 'bg-indigo-500' :
                    currentReviewQuestion.type === 'multiple' ? 'bg-purple-500' :
                    currentReviewQuestion.type === 'true-false' ? 'bg-cyan-500' :
                    currentReviewQuestion.type === 'comprehensive' ? 'bg-rose-500' : 'bg-teal-500'
                  }`}>
                    {TYPE_LABELS[currentReviewQuestion.type]}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">第 {reviewIndex + 1} 题</span>
                </div>
              </div>

              {/* 案例背景（综合题显示） */}
              {currentReviewQuestion.caseBackground && (
                <div className="sm:mx-4 mx-3 mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <div className="text-xs text-indigo-700 leading-relaxed">
                    <RichTextWithBreaks content={currentReviewQuestion.caseBackground} textClassName="whitespace-pre-wrap" />
                  </div>
                </div>
              )}

              {/* 题目内容 */}
              <div className="sm:px-4 px-3 py-3">
                <div className="text-base font-medium text-slate-800 leading-relaxed">
                  <RichTextWithBreaks content={currentReviewQuestion.content || ''} textClassName="whitespace-pre-wrap" />
                </div>
              </div>

              {/* 分隔线 */}
              <div className="sm:mx-4 mx-3 h-px bg-slate-100" />

              {/* 选项区域 */}
              <div className="sm:px-4 px-3 pb-4">
                <div className="space-y-2">
                  {currentReviewQuestion.options?.map((option, index) => {
                    const isMulti = currentReviewQuestion.type === 'multiple';
                    const isSelected = isMulti
                      ? Array.isArray(localAnswer) && localAnswer.includes(option.id)
                      : localAnswer === option.id;
                    const isCorrectAnswer = Array.isArray(currentReviewQuestion.answer)
                      ? currentReviewQuestion.answer.includes(option.id)
                      : currentReviewQuestion.answer === option.id;

                    let optionStyle = 'bg-slate-50/50';
                    if (isSelected && showExplanation) {
                      optionStyle = isCorrectAnswer ? 'bg-emerald-50' : 'bg-red-50';
                    } else if (isSelected) {
                      optionStyle = 'bg-indigo-50';
                    } else if (showExplanation && isCorrectAnswer) {
                      optionStyle = 'bg-emerald-50';
                    }

                    return (
                      <div
                        key={option.id}
                        className={`flex items-center p-3 rounded-lg transition-all duration-200 cursor-pointer ${optionStyle}`}
                        onClick={() => {
                          if (showExplanation) return;
                          if (isMulti) {
                            const cur = Array.isArray(localAnswer) ? localAnswer : [];
                            setLocalAnswer(cur.includes(option.id) ? cur.filter(id => id !== option.id) : [...cur, option.id]);
                          } else {
                            setLocalAnswer(option.id);
                          }
                        }}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 font-bold text-xs transition-colors flex-shrink-0 ${
                          isSelected && showExplanation
                            ? isCorrectAnswer ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                            : isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {isSelected ? <Check className="w-3.5 h-3.5" /> : getOptionLabel(index)}
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

        {/* 底部固定操作栏 - 与首页一致 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-4 py-3 z-30">
          <div className="max-w-[970px] mx-auto">
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={reviewIndex === 0}
                className="h-9 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="ml-1 text-sm font-medium">上一题</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  handleSubmitAnswer();
                  setTimeout(() => {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                  }, 100);
                }}
                disabled={localAnswer === undefined || (Array.isArray(localAnswer) && localAnswer.length === 0)}
                className="h-11 px-6 rounded-xl border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold shadow-sm"
              >
                <BookOpen className="w-4 h-4" />
                <span className="ml-1.5 text-sm">查看答案</span>
              </Button>

              <Button
                size="sm"
                onClick={handleNext}
                className="h-9 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-xl"
              >
                <span className="text-sm">{reviewIndex < reviewQuestions.length - 1 ? '下一题' : '完成'}</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ 列表页面 ============
  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-sm">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">智能刷题</span>
          </Link>
          <div className="flex items-center gap-1">
            {currentUser?.role === 'admin' && (
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-gray-500">
                  <Settings className="w-4 h-4" />
                </Button>
              </Link>
            )}
            <UserStatus />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">
        {/* 未登录 */}
        {!currentUser && mounted && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <User className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">请先登录</h2>
            <p className="text-gray-400 text-sm mb-6">登录后查看错题本</p>
            <Button 
              onClick={() => setAuthModalOpen(true)} 
              className="bg-gray-900 hover:bg-gray-800 h-11 px-8 rounded-xl"
            >
              去登录
            </Button>
          </div>
        )}

        {/* 同步中 */}
        {currentUser && mounted && isSyncing && (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-5 h-5 animate-spin text-gray-400 mr-2" />
            <span className="text-gray-500 text-sm">同步中...</span>
          </div>
        )}

        {/* 无错题 */}
        {currentUser && mounted && !isSyncing && wrongQuestions.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Check className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">太棒了！暂无错题</h2>
            <p className="text-gray-400 text-sm mb-6">继续保持，做题全对不是梦</p>
            <Link href="/">
              <Button className="bg-gray-900 hover:bg-gray-800 h-11 px-8 rounded-xl">去刷题</Button>
            </Link>
          </div>
        )}

        {/* 有错题 */}
        {currentUser && mounted && !isSyncing && wrongQuestions.length > 0 && (
          <>
            {/* 统计卡片 - 参考图风格 */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-4">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm text-gray-500 mb-1">错题总数</p>
                  <p className="text-4xl font-bold text-gray-900">{wrongQuestions.length}</p>
                </div>
                <Button 
                  onClick={() => startReview(filteredQuestions)} 
                  disabled={filteredQuestions.length === 0}
                  className="h-12 px-6 rounded-2xl bg-gray-900 hover:bg-gray-800 text-white font-medium"
                >
                  开始复习
                </Button>
              </div>
              
              {/* 题型筛选 */}
              <div className="flex gap-2.5 flex-wrap">
                {(['all', 'single', 'multiple', 'true-false', 'fill-blank', 'comprehensive'] as const).map(t => {
                  const count = typeCounts[t] || 0;
                  if (t !== 'all' && count === 0) return null;
                  const isActive = typeFilter === t;
                  const label = t === 'all' ? '全部' : TYPE_LABELS[t];
                  return (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        isActive 
                          ? 'bg-gray-900 text-white' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {label} {count}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 错题列表 */}
            <div className="space-y-2.5">
              {paginatedQuestions.map(question => {
                const info = getWrongInfo(question.id);
                const typeColors = TYPE_COLORS[question.type];
                return (
                  <div 
                    key={question.id} 
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`shrink-0 w-11 h-6 rounded-full text-[11px] font-semibold text-white flex items-center justify-center ${typeColors?.bg || 'bg-gray-500'}`}>
                        {TYPE_LABELS[question.type]}
                      </span>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-[15px] text-gray-800 leading-relaxed line-clamp-2">{question.content}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span>错 {info.wrongCount} 次</span>
                          {info.streak > 0 && (
                            <span className="text-emerald-600 font-medium">连续答对 {info.streak} 次</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startReview([question])}
                        className="shrink-0 h-9 px-4 rounded-xl text-xs font-medium border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                      >
                        复习
                      </Button>
                    </div>
                  </div>
                );
              })}

              {paginatedQuestions.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  该题型暂无错题
                </div>
              )}
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 mt-6">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="h-10 w-10 p-0 rounded-xl"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => (
                    <div key={p} className="flex items-center">
                      {idx > 0 && p - arr[idx - 1] > 1 && (
                        <span className="w-10 text-center text-gray-400 text-sm">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${
                          currentPage === p 
                            ? 'bg-gray-900 text-white' 
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {p}
                      </button>
                    </div>
                  ))}
                
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="h-10 w-10 p-0 rounded-xl"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} onAuthChange={checkAuth} />
    </div>
  );
}
