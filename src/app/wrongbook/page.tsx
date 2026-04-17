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
  Filter,
} from 'lucide-react';
import { questionStore, recordStore, getWrongQuestionIds, wrongStreakStore, generateId, cloudSyncService } from '@/lib/quiz-store';
import { Question, QuestionType } from '@/lib/types';
import Link from 'next/link';
import { UserStatus, AuthModal, getCurrentUser as getStoredUser } from '@/components/AuthModal';
import { RichTextWithBreaks } from '@/lib/rich-text';

// 题型样式配置
const TYPE_STYLES: Record<QuestionType, { bg: string; label: string; active: string; inactive: string; text: string; dot: string }> = {
  'single': { bg: 'bg-indigo-500', label: '单选题', active: 'bg-indigo-500 text-white', inactive: 'bg-indigo-50 text-indigo-600 border border-indigo-200', text: 'text-indigo-600', dot: 'bg-indigo-500' },
  'multiple': { bg: 'bg-purple-500', label: '多选题', active: 'bg-purple-500 text-white', inactive: 'bg-purple-50 text-purple-600 border border-purple-200', text: 'text-purple-600', dot: 'bg-purple-500' },
  'true-false': { bg: 'bg-cyan-500', label: '判断题', active: 'bg-cyan-500 text-white', inactive: 'bg-cyan-50 text-cyan-600 border border-cyan-200', text: 'text-cyan-600', dot: 'bg-cyan-500' },
  'fill-blank': { bg: 'bg-teal-500', label: '填空题', active: 'bg-teal-500 text-white', inactive: 'bg-teal-50 text-teal-600 border border-teal-200', text: 'text-teal-600', dot: 'bg-teal-500' },
  'comprehensive': { bg: 'bg-rose-500', label: '综合题', active: 'bg-rose-500 text-white', inactive: 'bg-rose-50 text-rose-600 border border-rose-200', text: 'text-rose-600', dot: 'bg-rose-500' },
};

const ALL_TYPES: (QuestionType | 'all')[] = ['all', 'single', 'multiple', 'true-false', 'fill-blank', 'comprehensive'];

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
  const questionContentRef = useRef<HTMLDivElement>(null);

  const checkAuth = useCallback(() => {
    const user = getStoredUser();
    setCurrentUser(user);
  }, []);

  const refreshData = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // 重新计算错题数据
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

  // 云端同步：先 push 再 pull
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

  // 获取全部错题
  const wrongQuestions = useMemo(() => {
    const _rk = refreshKey;
    void _rk;
    const wrongIds = getWrongQuestionIds();
    const allQuestions = questionStore.getAll();
    return wrongIds.map(id => allQuestions.find(q => q.id === id)).filter((q): q is Question => q !== undefined);
  }, [refreshKey]);

  // 按题型筛选后的错题
  const filteredQuestions = useMemo(() => {
    if (typeFilter === 'all') return wrongQuestions;
    return wrongQuestions.filter(q => q.type === typeFilter);
  }, [wrongQuestions, typeFilter]);

  // 各题型数量
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: wrongQuestions.length };
    wrongQuestions.forEach(q => {
      counts[q.type] = (counts[q.type] || 0) + 1;
    });
    return counts;
  }, [wrongQuestions]);

  const getWrongInfo = useCallback((questionId: string) => {
    const records = recordStore.getAll().filter(r => r.questionId === questionId);
    const wrongRecords = records.filter(r => !r.isCorrect);
    const streak = wrongStreakStore.get(questionId);
    return { wrongCount: wrongRecords.length, streak };
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

  function checkAnswerInline(question: Question, answer: string | string[] | undefined): boolean {
    if (!answer) return false;
    if (Array.isArray(question.answer)) {
      const userAnswers = Array.isArray(answer) ? answer : [answer];
      return userAnswers.length === question.answer.length && userAnswers.every(a => question.answer.includes(a));
    }
    return answer === question.answer;
  }

  const getOptionLabel = (index: number) => String.fromCharCode(65 + index);

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

        {/* 有错题 */}
        {currentUser && mounted && !isSyncing && wrongQuestions.length > 0 && (
          <div className="space-y-3">
            {/* 顶部操作栏 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={recalculateWrongData} className="text-slate-400 hover:text-slate-600 h-7 px-2 text-xs">
                  <RotateCcw className="w-3 h-3 mr-1" />重新计算
                </Button>
                <span className="text-xs text-slate-400">连续答对3次自动移除</span>
              </div>
              <Button onClick={() => startReview(filteredQuestions)} disabled={filteredQuestions.length === 0} className="rounded-xl h-8 px-4 text-xs bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white">
                复习{typeFilter === 'all' ? '全部' : TYPE_STYLES[typeFilter].label}（{filteredQuestions.length}）
              </Button>
            </div>

            {/* 题型筛选 */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {ALL_TYPES.map(t => {
                const count = typeCounts[t] || 0;
                if (t !== 'all' && count === 0) return null;
                const isActive = typeFilter === t;
                const label = t === 'all' ? '全部' : TYPE_STYLES[t].label;
                return (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isActive ? (t === 'all' ? 'bg-slate-700 text-white' : TYPE_STYLES[t].active) : (t === 'all' ? 'bg-slate-100 text-slate-500' : TYPE_STYLES[t].inactive)}`}
                  >
                    {label} {count}
                  </button>
                );
              })}
            </div>

            {/* 错题列表 */}
            <div className="space-y-2">
              {filteredQuestions.map(question => {
                const ts = TYPE_STYLES[question.type] || TYPE_STYLES['single'];
                const info = getWrongInfo(question.id);
                return (
                  <div key={question.id} className="bg-white rounded-xl p-3.5 shadow-sm hover:shadow transition-shadow">
                    <div className="flex items-start gap-3">
                      {/* 题型标签 */}
                      <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-md text-xs font-bold text-white ${ts.bg} mt-0.5`}>
                        {ts.label}
                      </span>
                      {/* 题目内容 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 leading-relaxed line-clamp-2">{question.content}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs text-slate-400">错{info.wrongCount}次</span>
                          {info.streak > 0 && (
                            <span className="text-xs text-emerald-500">连续答对{info.streak}次</span>
                          )}
                        </div>
                      </div>
                      {/* 复习按钮 */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startReview([question])}
                        className="shrink-0 h-7 px-2.5 text-xs rounded-lg mt-0.5"
                      >
                        复习
                      </Button>
                    </div>
                  </div>
                );
              })}

              {filteredQuestions.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm">
                  该题型暂无错题
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} onAuthChange={checkAuth} />
    </div>
  );
}
