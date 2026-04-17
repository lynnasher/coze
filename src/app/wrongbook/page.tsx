'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  BookOpen,
  RotateCcw,
  ArrowLeft,
  Settings,
  User,
  RefreshCw,
  FolderOpen,
  Library,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { questionStore, recordStore, getWrongQuestionIds, wrongStreakStore, generateId, cloudSyncService, bankStore, categoryStore } from '@/lib/quiz-store';
import { Question, QuestionType } from '@/lib/types';
import Link from 'next/link';
import { UserStatus, AuthModal, getCurrentUser as getStoredUser } from '@/components/AuthModal';
import { RichTextWithBreaks } from '@/lib/rich-text';

// 题型样式配置
const TYPE_STYLES: Record<QuestionType, { bg: string; label: string; light: string; text: string }> = {
  'single': { bg: 'bg-indigo-500', label: '单选题', light: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-600' },
  'multiple': { bg: 'bg-purple-500', label: '多选题', light: 'bg-purple-50 border-purple-200', text: 'text-purple-600' },
  'true-false': { bg: 'bg-cyan-500', label: '判断题', light: 'bg-cyan-50 border-cyan-200', text: 'text-cyan-600' },
  'fill-blank': { bg: 'bg-teal-500', label: '填空题', light: 'bg-teal-50 border-teal-200', text: 'text-teal-600' },
  'comprehensive': { bg: 'bg-rose-500', label: '综合题', light: 'bg-rose-50 border-rose-200', text: 'text-rose-600' },
};

// 分类渐变色配置
const CATEGORY_GRADIENTS = [
  'from-indigo-500 to-blue-600',
  'from-purple-500 to-violet-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-cyan-500 to-sky-600',
  'from-red-500 to-rose-600',
  'from-fuchsia-500 to-purple-600',
];

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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const questionContentRef = useRef<HTMLDivElement>(null);

  // 检查认证状态
  const checkAuth = useCallback(() => {
    const user = getStoredUser();
    setCurrentUser(user);
  }, []);

  // 刷新数据
  const refreshData = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // 重新计算错题数据（仅本地计算，不同步云端——由 syncFromCloud 统一管理）
  const recalculateWrongData = useCallback(() => {
    const records = recordStore.getAll();
    const wrongQuestionIds = new Set<string>();
    records.forEach(r => {
      if (!r.selectedAnswer) return;
      const answer = Array.isArray(r.selectedAnswer) ? r.selectedAnswer : String(r.selectedAnswer);
      if (answer.length === 0) return;
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
      const filtered = records.filter(r => !(masteredIds.includes(r.questionId) && !r.isCorrect));
      recordStore.save(filtered);
    }
    wrongStreakStore.save(newStreaks);
    refreshData();
  }, [refreshData]);

  // 从云端同步：先 push 本地数据到云端，再 pull 云端数据下来，以云端为准
  const syncFromCloud = useCallback(async () => {
    const user = getStoredUser();
    if (!user) return;
    setIsSyncing(true);
    try {
      // 第一步：push 本地数据到云端（确保答题记录不丢失）
      await cloudSyncService.saveRecordsAndStreaks(
        user.id,
        recordStore.getAll(),
        wrongStreakStore.getAll()
      );

      // 第二步：pull 云端数据（以云端为准，替换本地缓存）
      const cloudData = await cloudSyncService.pullData(user.id);
      if (cloudData) {
        recordStore.save(cloudData.records);
        wrongStreakStore.save(cloudData.streaks);
      }
    } catch (error) {
      console.error('云端同步失败，使用本地数据:', error);
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

  // 获取错题列表
  const wrongQuestions = useMemo(() => {
    const _rk = refreshKey;
    void _rk;
    const wrongIds = getWrongQuestionIds();
    const allQuestions = questionStore.getAll();
    return wrongIds.map(id => allQuestions.find(q => q.id === id)).filter((q): q is Question => q !== undefined);
  }, [refreshKey]);

  // 按题库/分类分组错题
  const categorizedWrongQuestions = useMemo(() => {
    const banks = bankStore.getAll();
    const categories = categoryStore.getAll();
    
    const bankMap = new Map(banks.map(b => [b.id, b]));
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    const bankGroups = new Map<string, { bankId: string; bankName: string; categoryName: string; categoryId: string; questions: Question[] }>();
    const ungrouped: Question[] = [];

    wrongQuestions.forEach(q => {
      if (q.bankId && bankMap.has(q.bankId)) {
        const bank = bankMap.get(q.bankId)!;
        const category = bank.categoryId ? categoryMap.get(bank.categoryId) : null;
        const key = bank.id;
        if (!bankGroups.has(key)) {
          bankGroups.set(key, {
            bankId: bank.id,
            bankName: bank.name,
            categoryName: category?.name || '未分类',
            categoryId: bank.categoryId || '',
            questions: [],
          });
        }
        bankGroups.get(key)!.questions.push(q);
      } else {
        ungrouped.push(q);
      }
    });

    const categoryGroups = new Map<string, { categoryName: string; categoryId: string; banks: { bankId: string; bankName: string; questions: Question[] }[] }>();
    
    bankGroups.forEach(group => {
      const catKey = group.categoryId || '__uncategorized__';
      if (!categoryGroups.has(catKey)) {
        categoryGroups.set(catKey, {
          categoryName: catKey === '__uncategorized__' ? '未分类' : group.categoryName,
          categoryId: group.categoryId,
          banks: [],
        });
      }
      categoryGroups.get(catKey)!.banks.push({
        bankId: group.bankId,
        bankName: group.bankName,
        questions: group.questions,
      });
    });

    const result = Array.from(categoryGroups.values());
    
    if (ungrouped.length > 0) {
      const uncategorizedKey = '__uncategorized__';
      const existing = categoryGroups.get(uncategorizedKey);
      if (existing) {
        existing.banks.push({ bankId: '__other__', bankName: '未关联题库', questions: ungrouped });
      } else {
        result.push({
          categoryName: '未分类',
          categoryId: uncategorizedKey,
          banks: [{ bankId: '__other__', bankName: '未关联题库', questions: ungrouped }],
        });
      }
    }

    return result;
  }, [wrongQuestions]);

  // 计算总体题型分布
  const typeStats = useMemo(() => {
    const stats: Record<QuestionType, number> = {
      'single': 0, 'multiple': 0, 'true-false': 0, 'fill-blank': 0, 'comprehensive': 0,
    };
    wrongQuestions.forEach(q => { if (stats[q.type] !== undefined) stats[q.type]++; });
    return Object.entries(stats).filter(([_, v]) => v > 0).map(([type, count]) => ({
      type: type as QuestionType,
      ...TYPE_STYLES[type as QuestionType],
      count,
    }));
  }, [wrongQuestions]);

  // 获取题目的错题信息
  const getWrongInfo = useCallback((questionId: string) => {
    const records = recordStore.getAll().filter(r => r.questionId === questionId);
    const wrongRecords = records.filter(r => !r.isCorrect);
    const streak = wrongStreakStore.get(questionId);
    return { wrongCount: wrongRecords.length, streak };
  }, []);

  const progressPercent = reviewQuestions.length > 0 ? Math.round(((reviewIndex + 1) / reviewQuestions.length) * 100) : 0;
  const currentReviewQuestion = reviewQuestions[reviewIndex];

  // 开始错题复习
  const startReview = useCallback((questions: Question[]) => {
    if (questions.length === 0) return;
    setReviewQuestions(questions);
    setReviewIndex(0);
    setShowExplanation(false);
    setLocalAnswer(undefined);
    setIsAnswerCorrect(false);
    setIsReviewing(true);
  }, []);

  // 提交答案
  const handleSubmitAnswer = useCallback(() => {
    if (currentReviewQuestion && localAnswer !== undefined) {
      const correct = checkAnswerInline(currentReviewQuestion, localAnswer);
      setIsAnswerCorrect(correct);
      setShowExplanation(true);
      const record = { id: generateId(), questionId: currentReviewQuestion.id, isCorrect: correct, selectedAnswer: localAnswer, timestamp: Date.now() };
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
      // 同步到云端
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
    const records = recordStore.getAll().filter(r => !(r.questionId === questionId && !r.isCorrect));
    recordStore.save(records);
    wrongStreakStore.remove(questionId);
    const user = getStoredUser();
    if (user) {
      cloudSyncService.saveRecordsAndStreaks(user.id, recordStore.getAll(), wrongStreakStore.getAll());
    }
    refreshData();
  }, [refreshData]);

  // 内联答案检查
  function checkAnswerInline(question: Question, answer: string | string[] | undefined): boolean {
    if (!answer) return false;
    if (Array.isArray(question.answer)) {
      const userAnswers = Array.isArray(answer) ? answer : [answer];
      return userAnswers.length === question.answer.length && userAnswers.every(a => question.answer.includes(a));
    }
    return answer === question.answer;
  }

  const getOptionLabel = (index: number) => String.fromCharCode(65 + index);

  // 切换分类展开
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  // 初始展开所有分类
  useEffect(() => {
    if (categorizedWrongQuestions.length > 0 && expandedCategories.size === 0) {
      setExpandedCategories(new Set(categorizedWrongQuestions.map(c => c.categoryId || '__other__')));
    }
  }, [categorizedWrongQuestions, expandedCategories.size]);

  // =================== 复习模式 ===================
  if (isReviewing && currentReviewQuestion) {
    const wrongInfo = getWrongInfo(currentReviewQuestion.id);
    const typeStyle = TYPE_STYLES[currentReviewQuestion.type] || TYPE_STYLES['single'];

    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-100">
          <div className="max-w-[970px] mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
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
              <div className="flex items-center gap-2">
                {currentUser?.role === 'admin' && (
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="rounded-xl gap-1 border-orange-200 text-orange-600 hover:bg-orange-50">
                      <Settings className="w-4 h-4" /><span className="hidden sm:inline">管理</span>
                    </Button>
                  </Link>
                )}
                <UserStatus />
              </div>
            </div>
          </div>
        </header>

        <div className="bg-white border-b border-slate-200 px-4 py-2 sticky top-[68px] z-20">
          <div className="max-w-[970px] mx-auto flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => { setIsReviewing(false); refreshData(); }} className="text-slate-600 hover:bg-slate-100 rounded-lg px-2 h-9 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" /><span className="text-sm font-medium">返回</span>
            </Button>
            <span className="text-sm text-slate-600">{reviewIndex + 1} / {reviewQuestions.length}</span>
            <Button variant="outline" size="sm" onClick={() => markAsMastered(currentReviewQuestion.id)} className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg px-2 h-9">
              <Check className="w-4 h-4 mr-1" /><span className="text-sm font-medium">已掌握</span>
            </Button>
          </div>
        </div>

        <div className="bg-white border-b border-slate-100 px-4 py-2">
          <div className="max-w-[970px] mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="text-xs font-medium text-slate-500 min-w-[3rem] text-right">{progressPercent}%</span>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2">
          <div className="max-w-[970px] mx-auto flex items-center gap-4 text-sm text-amber-700">
            <span>错题 {wrongInfo.wrongCount} 次</span>
            <span>掌握度 {wrongInfo.streak}/3</span>
          </div>
        </div>

        <div className="pb-28">
          <div className="max-w-[970px] mx-auto px-4 py-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-50 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold text-white ${typeStyle.bg}`}>{typeStyle.label}</span>
                  <span className="text-xs text-slate-500 font-medium">第 {reviewIndex + 1} 题</span>
                </div>
              </div>
              {currentReviewQuestion.caseBackground && (
                <div className="mx-4 mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="text-xs text-indigo-700 leading-relaxed whitespace-pre-wrap">{currentReviewQuestion.caseBackground}</div>
                </div>
              )}
              <div className="px-4 py-4">
                <div className="text-base font-medium text-slate-800 leading-relaxed">
                  <RichTextWithBreaks content={currentReviewQuestion.content || ''} textClassName="whitespace-pre-wrap" />
                </div>
              </div>
              <div className="mx-4 h-px bg-slate-100" />
              <div className="px-4 py-4">
                {currentReviewQuestion.options && currentReviewQuestion.options.length > 0 ? (
                  <div className="space-y-2.5">
                    {currentReviewQuestion.options.map((option, index) => {
                      const isMulti = currentReviewQuestion.type === 'multiple';
                      const isSelected = isMulti ? Array.isArray(localAnswer) && localAnswer.includes(option.id) : localAnswer === option.id;
                      const isCorrectOption = Array.isArray(currentReviewQuestion.answer) ? currentReviewQuestion.answer.includes(option.id) : currentReviewQuestion.answer === option.id;
                      let optStyle = 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30';
                      if (isSelected && showExplanation) optStyle = isCorrectOption ? 'bg-emerald-50 border-emerald-400' : 'bg-red-50 border-red-400';
                      else if (isSelected) optStyle = 'bg-indigo-50 border-indigo-400';
                      else if (showExplanation && isCorrectOption) optStyle = 'bg-emerald-50 border-emerald-400';
                      return (
                        <div key={option.id} className={`flex items-center p-3.5 rounded-xl border-2 transition-all duration-200 cursor-pointer ${optStyle}`} onClick={() => { if (showExplanation) return; if (isMulti) { const cur = Array.isArray(localAnswer) ? localAnswer : []; setLocalAnswer(cur.includes(option.id) ? cur.filter(id => id !== option.id) : [...cur, option.id]); } else setLocalAnswer(option.id); }}>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center mr-3 font-bold text-xs transition-colors ${isSelected && showExplanation ? isCorrectOption ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white' : isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {isSelected ? <Check className="w-4 h-4" /> : getOptionLabel(index)}
                          </div>
                          <div className="flex-1 text-sm font-medium text-slate-700"><RichTextWithBreaks content={option.text} textClassName="whitespace-pre-wrap" /></div>
                          {showExplanation && isCorrectOption && <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center ml-2"><Check className="w-3 h-3 text-white" /></div>}
                          {showExplanation && isSelected && !isCorrectOption && <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center ml-2"><X className="w-3 h-3 text-white" /></div>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mb-4">
                    <input type="text" placeholder="输入你的答案" value={(localAnswer as string) || ''} onChange={(e) => !showExplanation && setLocalAnswer(e.target.value)} disabled={showExplanation} className="w-full px-4 py-3 text-base rounded-xl border-2 border-gray-200 focus:border-indigo-300 focus:outline-none bg-white disabled:bg-gray-50" />
                  </div>
                )}
              </div>
              {showExplanation && (
                <div className="px-4 pb-4 space-y-3">
                  <div className={`rounded-xl p-3.5 ${isAnswerCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isAnswerCorrect ? 'bg-emerald-500' : 'bg-red-500'}`}>
                          {isAnswerCorrect ? <Check className="w-5 h-5 text-white" /> : <X className="w-5 h-5 text-white" />}
                        </div>
                        <span className={`text-sm font-bold ${isAnswerCorrect ? 'text-emerald-700' : 'text-red-700'}`}>{isAnswerCorrect ? '太棒了！' : '再接再厉！'}</span>
                      </div>
                      <div className="bg-white rounded-lg px-2.5 py-1">
                        <span className="text-xs text-slate-500">答案</span>
                        <span className="text-sm font-bold text-emerald-600 ml-1.5">{Array.isArray(currentReviewQuestion.answer) ? currentReviewQuestion.answer.map(a => a.toUpperCase()).join(', ') : currentReviewQuestion.answer?.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                  {currentReviewQuestion.explanation && (
                    <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-200">
                      <div className="flex items-center gap-2 text-amber-700 mb-2"><BookOpen className="w-4 h-4" /><span className="font-semibold text-sm">解析</span></div>
                      <div className="text-amber-900 text-sm leading-relaxed"><RichTextWithBreaks content={currentReviewQuestion.explanation} textClassName="whitespace-pre-wrap" /></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 z-20">
          <div className="max-w-[970px] mx-auto flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={handlePrev} disabled={reviewIndex === 0} className="rounded-xl h-10 px-4"><ChevronLeft className="w-4 h-4 mr-1" />上一题</Button>
            {!showExplanation ? (
              <Button onClick={handleSubmitAnswer} disabled={localAnswer === undefined || (Array.isArray(localAnswer) && localAnswer.length === 0)} className="rounded-xl h-10 px-6 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600">提交答案</Button>
            ) : (
              <Button onClick={handleNext} className="rounded-xl h-10 px-6 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600">
                {reviewIndex < reviewQuestions.length - 1 ? '下一题' : '完成'}<ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =================== 错题本列表页面 ===================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-[970px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-md">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-800">智能刷题</h1>
                  <p className="text-xs text-gray-400">{mounted ? `${wrongQuestions.length} 道错题` : '错题本'}</p>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {currentUser?.role === 'admin' && (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="rounded-xl gap-1 border-orange-200 text-orange-600 hover:bg-orange-50">
                    <Settings className="w-4 h-4" /><span className="hidden sm:inline">管理</span>
                  </Button>
                </Link>
              )}
              <UserStatus />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[970px] mx-auto px-4 py-4">
        {/* 未登录 */}
        {!currentUser && mounted && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <User className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">请先登录</h2>
            <p className="text-slate-400 mb-6">登录后才能使用错题本功能</p>
            <Button onClick={() => setAuthModalOpen(true)} className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-xl h-11 px-6">去登录</Button>
          </div>
        )}

        {/* 同步中 */}
        {currentUser && mounted && isSyncing && (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mr-2" />
            <span className="text-slate-500">同步数据中...</span>
          </div>
        )}

        {/* 无错题 */}
        {currentUser && mounted && !isSyncing && wrongQuestions.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">太棒了！暂无错题</h2>
            <p className="text-slate-400">继续保持，做题全对不是梦</p>
            <Link href="/">
              <Button className="mt-6 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-xl h-11 px-6">去刷题</Button>
            </Link>
          </div>
        )}

        {/* 有错题 - 卡片式分类显示 */}
        {currentUser && mounted && !isSyncing && wrongQuestions.length > 0 && (
          <div className="space-y-4">
            {/* 统计概览卡片 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <div className="w-6 h-6 bg-amber-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  错题概览
                </h3>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={recalculateWrongData} className="text-slate-400 hover:text-slate-600 h-7 px-2 text-xs">
                    <RotateCcw className="w-3 h-3 mr-1" />重新计算
                  </Button>
                  <Button onClick={() => startReview(wrongQuestions)} className="rounded-xl h-8 px-4 text-xs bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white">
                    全部复习
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-xl p-3 text-white text-center">
                  <p className="text-xl font-bold">{wrongQuestions.length}</p>
                  <p className="text-xs opacity-80">错题总数</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl p-3 text-white text-center">
                  <p className="text-xl font-bold">{wrongQuestions.filter(q => (wrongStreakStore.get(q.id) || 0) >= 2).length}</p>
                  <p className="text-xs opacity-80">即将掌握</p>
                </div>
              </div>
              {/* 题型分布标签 */}
              {typeStats.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {typeStats.map(ts => (
                    <span key={ts.type} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${ts.light} ${ts.text}`}>
                      {ts.label} {ts.count}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-2">连续答对3次后将从错题本中移除</p>
            </div>

            {/* 按分类卡片展示错题 */}
            {categorizedWrongQuestions.map((catGroup, catIdx) => {
              const gradient = CATEGORY_GRADIENTS[catIdx % CATEGORY_GRADIENTS.length];
              const totalInCat = catGroup.banks.reduce((s, b) => s + b.questions.length, 0);
              const catId = catGroup.categoryId || '__other__';
              const isExpanded = expandedCategories.has(catId);

              return (
                <div key={catId} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {/* 分类头部 - 渐变卡片 */}
                  <div 
                    className={`bg-gradient-to-r ${gradient} p-4 cursor-pointer hover:opacity-95 transition-opacity`}
                    onClick={() => toggleCategory(catId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                          <FolderOpen className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-white">
                          <p className="text-base font-bold">{catGroup.categoryName}</p>
                          <p className="text-xs opacity-80">{totalInCat} 道错题 · {catGroup.banks.length} 个题库</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); startReview(catGroup.banks.flatMap(b => b.questions)); }}
                          className="bg-white/20 hover:bg-white/30 text-white border-0 rounded-lg h-8 px-3 text-xs backdrop-blur-sm"
                        >
                          复习此分类
                        </Button>
                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 展开的题库列表 */}
                  {isExpanded && (
                    <div className="p-4 space-y-3">
                      {catGroup.banks.map(bank => {
                        const questionsByType = new Map<QuestionType, Question[]>();
                        bank.questions.forEach(q => {
                          if (!questionsByType.has(q.type)) questionsByType.set(q.type, []);
                          questionsByType.get(q.type)!.push(q);
                        });

                        return (
                          <div key={bank.bankId} className="bg-slate-50 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Library className="w-4 h-4 text-slate-400" />
                                <span className="text-sm font-semibold text-slate-700">{bank.bankName}</span>
                                <span className="text-xs text-slate-400">{bank.questions.length} 题</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startReview(bank.questions)}
                                className="text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 h-7 px-2 text-xs"
                              >
                                复习
                              </Button>
                            </div>
                            
                            {Array.from(questionsByType.entries()).map(([qType, questions]) => {
                              const ts = TYPE_STYLES[qType] || TYPE_STYLES['single'];
                              return (
                                <div key={qType} className="mb-2 last:mb-0">
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${ts.bg}`} />
                                    <span className="text-xs font-medium text-slate-500">{ts.label}</span>
                                    <span className="text-xs text-slate-400">({questions.length})</span>
                                  </div>
                                  <div className="space-y-1.5">
                                    {questions.map(question => {
                                      const info = getWrongInfo(question.id);
                                      return (
                                        <div key={question.id} className="flex items-center gap-2 p-2 bg-white rounded-lg hover:shadow-sm transition-shadow">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-700 truncate">{question.content.slice(0, 60)}{question.content.length > 60 ? '...' : ''}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                              <span className="text-xs text-slate-400">错{info.wrongCount}次</span>
                                              {info.streak > 0 && (
                                                <span className="text-xs text-emerald-500">连续答对{info.streak}次</span>
                                              )}
                                            </div>
                                          </div>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => startReview([question])}
                                            className="shrink-0 h-7 px-2 text-xs rounded-lg"
                                          >
                                            复习
                                          </Button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} onAuthChange={checkAuth} />
    </div>
  );
}
