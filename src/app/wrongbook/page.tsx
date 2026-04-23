'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft, 
  ChevronRight, 
  Check, 
  BookOpen,
  ArrowLeft,
  User,
  RefreshCw,
  Brain,
} from 'lucide-react';
import { questionStore, recordStore, bankStore, getWrongQuestionIds, wrongStreakStore, generateId, cloudSyncService, queueRecordForSync, queueStreakForSync, forceSync, forceSyncBeacon, getUserToken } from '@/lib/quiz-store';
import { Question, QuestionType } from '@/lib/types';
import { recalculateWrongData as recalculateWrongDataUtil } from '@/lib/stats-utils';
import Link from 'next/link';
import { AuthModal, getCurrentUser as getStoredUser } from '@/components/AuthModal';
import { QuizCard } from '@/components/quiz/QuizCard';
import { TYPE_LABELS, checkAnswer } from '@/lib/wrongbook-utils';

// 错题本页面专用颜色配置
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
  const [bankFilter, setBankFilter] = useState<string | 'all'>('all');
  
  // 分页状态
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const listContainerRef = useRef<HTMLDivElement>(null);
  
  // 云端题目数据缓存
  const [cloudQuestions, setCloudQuestions] = useState<Record<string, Question>>({});
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([]);

  const checkAuth = useCallback(() => {
    setCurrentUser(getStoredUser());
  }, []);

  // 加载题库数据
  useEffect(() => {
    const loadBanks = async () => {
      try {
        const response = await fetch('/api/banks');
        if (response.ok) {
          const data = await response.json();
          if (data.banks) {
            setBanks(data.banks);
            bankStore.save(data.banks.map((b: { id: string; name: string; description?: string; question_count?: number; category_id?: string; created_at?: string }) => ({
              id: b.id,
              name: b.name,
              description: b.description,
              questionCount: b.question_count || 0,
              categoryId: b.category_id,
              createdAt: b.created_at ? new Date(b.created_at).getTime() : Date.now(),
            })));
          }
        }
      } catch (error) {
        console.error('Failed to load banks:', error);
      }
    };
    loadBanks();
  }, []);

  const refreshData = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const recalculateWrongData = useCallback(() => {
    const result = recalculateWrongDataUtil(
      recordStore.getAll(),
      (records) => recordStore.save(records),
      (streaks) => wrongStreakStore.save(streaks),
      () => getWrongQuestionIds().length
    );
    refreshData();
    return result;
  }, [refreshData]);

  const syncFromCloud = useCallback(async (skipPush: boolean = false) => {
    const user = getStoredUser();
    if (!user) return;
    setIsSyncing(true);
    try {
      const cloudData = await cloudSyncService.pullData(user.id);
      if (cloudData) {
        recordStore.save(cloudData.records);
        wrongStreakStore.save(cloudData.streaks);
      }
      if (!skipPush) {
        await cloudSyncService.saveRecordsAndStreaks(user.id, recordStore.getAll(), wrongStreakStore.getAll());
      }
    } finally {
      setIsSyncing(false);
      recalculateWrongData();
    }
  }, [recalculateWrongData]);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);
    if (user) {
      syncFromCloud(true);
    }
    setMounted(true);
    
    const handleBeforeUnload = () => {
      if (cloudSyncService.hasPendingSync()) {
        forceSyncBeacon();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (cloudSyncService.hasPendingSync()) {
        forceSync();
      }
    };
  }, [checkAuth, syncFromCloud]);

  // 从云端批量获取题目数据
  const fetchQuestionsFromCloud = useCallback(async (questionIds: string[]) => {
    if (questionIds.length === 0) return;
    
    const token = getUserToken();
    if (!token) return;
    
    try {
      const batchSize = 10;
      const fetchedQuestions: Record<string, Question> = {};
      
      for (let i = 0; i < questionIds.length; i += batchSize) {
        const batch = questionIds.slice(i, i + batchSize);
        const response = await fetch('/api/questions/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ ids: batch }),
        });
        
        if (response.ok) {
          const data = await response.json();
          data.questions?.forEach((q: Question) => {
            fetchedQuestions[q.id] = q;
          });
        }
      }
      
      setCloudQuestions(prev => ({ ...prev, ...fetchedQuestions }));
    } catch (error) {
      console.error('Failed to fetch questions from cloud:', error);
    }
  }, []);

  // 获取所有错题ID（用于统计）
  const allWrongIds = useMemo(() => getWrongQuestionIds(), [refreshKey]);
  
  // 分页加载错题数据
  const [displayedQuestions, setDisplayedQuestions] = useState<Question[]>([]);
  
  // 加载指定页的错题
  const loadMoreQuestions = useCallback(async (page: number, isReset = false) => {
    // 使用函数式获取最新状态，避免依赖 isLoadingMore
    let shouldReturn = false;
    setIsLoadingMore(prev => {
      if (prev && !isReset) shouldReturn = true;
      return true;
    });
    if (shouldReturn) return;
    
    try {
      // 获取所有错题ID
      const wrongIds = getWrongQuestionIds();
      
      // 筛选（在分页前筛选）
      let filteredIds = wrongIds;
      if (bankFilter !== 'all' || typeFilter !== 'all') {
        const allQuestions = questionStore.getAll();
        filteredIds = wrongIds.filter(id => {
          const q = allQuestions.find(q => q.id === id) || cloudQuestions[id];
          if (!q) return false;
          if (bankFilter !== 'all' && q.bankId !== bankFilter) return false;
          if (typeFilter !== 'all' && q.type !== typeFilter) return false;
          return true;
        });
      }
      
      // 分页切片 - 只加载当前页的数据
      const start = (page - 1) * PAGE_SIZE;
      const end = page * PAGE_SIZE;
      const pageIds = filteredIds.slice(start, end);
      
      // 获取题目详情
      const allQuestions = questionStore.getAll();
      const newQuestions = pageIds.map(id => {
        const localQuestion = allQuestions.find(q => q.id === id);
        if (localQuestion) return localQuestion;
        return cloudQuestions[id];
      }).filter((q): q is Question => q !== undefined);
      
      // 累加数据（不是替换）
      setDisplayedQuestions(prev => isReset ? newQuestions : [...prev, ...newQuestions]);
      setHasMore(end < filteredIds.length);
      
      // 检测缺失的题目并从云端获取
      const localIds = new Set(allQuestions.map(q => q.id));
      const missingIds = pageIds.filter(id => !localIds.has(id) && !cloudQuestions[id]);
      if (missingIds.length > 0) {
        fetchQuestionsFromCloud(missingIds);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [bankFilter, typeFilter, cloudQuestions, fetchQuestionsFromCloud]);
  
  // 初始加载和筛选变化时重置
  useEffect(() => {
    setCurrentPage(1);
    setHasMore(true);
    loadMoreQuestions(1, true);
  }, [refreshKey, bankFilter, typeFilter]);
  
  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    loadMoreQuestions(nextPage);
  }, [currentPage, hasMore, isLoadingMore, loadMoreQuestions]);
  
  // 页面滚动加载检测
  useEffect(() => {
    const handleScroll = () => {
      // 距离页面底部200px时加载更多
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      
      if (scrollHeight - scrollTop - clientHeight < 200) {
        handleLoadMore();
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleLoadMore]);
  
  // 用于统计的完整错题列表（轻量级，只计算数量）
  const wrongQuestionsStats = useMemo(() => {
    return allWrongIds.map(id => {
      const q = questionStore.getAll().find(q => q.id === id) || cloudQuestions[id];
      return q;
    }).filter((q): q is Question => q !== undefined);
  }, [allWrongIds, cloudQuestions]);

  const filteredQuestions = displayedQuestions;
  const paginatedQuestions = filteredQuestions;

  const typeCounts = useMemo(() => {
    const base = bankFilter === 'all' ? wrongQuestionsStats : wrongQuestionsStats.filter(q => q.bankId === bankFilter);
    const counts: Record<string, number> = { all: base.length };
    base.forEach(q => { counts[q.type] = (counts[q.type] || 0) + 1; });
    return counts;
  }, [wrongQuestionsStats, bankFilter]);

  // 按题库分类统计
  const bankCounts = useMemo(() => {
    const counts: { id: string; name: string; count: number }[] = [];
    const bankMap = new Map<string, number>();
    
    wrongQuestionsStats.forEach(q => {
      if (q.bankId) {
        bankMap.set(q.bankId, (bankMap.get(q.bankId) || 0) + 1);
      }
    });
    
    bankMap.forEach((count, bankId) => {
      const bank = banks.find(b => b.id === bankId);
      counts.push({
        id: bankId,
        name: bank?.name || '未知题库',
        count,
      });
    });
    
    return counts.sort((a, b) => b.count - a.count);
  }, [wrongQuestionsStats, banks]);
  
  // 获取错题统计信息
  const getWrongInfo = useCallback((questionId: string) => {
    const records = recordStore.getAll().filter(r => r.questionId === questionId);
    return { 
      wrongCount: records.filter(r => !r.isCorrect).length, 
      streak: wrongStreakStore.get(questionId) 
    };
  }, []);

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

  const syncStreakAndRecord = useCallback((questionId: string, correct: boolean, streak: number) => {
    const user = getStoredUser();
    if (!user) return;
    
    if (correct) {
      queueStreakForSync(questionId, streak);
      if (streak >= 3) {
        queueStreakForSync(questionId, 0);
      }
    } else {
      queueStreakForSync(questionId, 0);
    }
  }, []);

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
        timestamp: Date.now() 
      };
      recordStore.add(record);
      
      const user = getStoredUser();
      
      if (correct) {
        wrongStreakStore.increment(currentReviewQuestion.id);
        const newStreak = wrongStreakStore.get(currentReviewQuestion.id);
        syncStreakAndRecord(currentReviewQuestion.id, true, newStreak);
        
        if (newStreak >= 3) {
          recordStore.save(recordStore.getAll().filter(r => !(r.questionId === currentReviewQuestion.id && !r.isCorrect)));
          wrongStreakStore.remove(currentReviewQuestion.id);
        }
      } else {
        wrongStreakStore.reset(currentReviewQuestion.id);
        syncStreakAndRecord(currentReviewQuestion.id, false, 0);
      }
      
      if (user) {
        queueRecordForSync(record);
      }
    }
  }, [currentReviewQuestion, localAnswer, syncStreakAndRecord]);

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
      queueStreakForSync(questionId, 0);
    }
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

  const handleAnswerSelect = useCallback((questionId: string, answer: string | string[]) => {
    setLocalAnswer(answer);
  }, []);

  // ============ 复习模式 - 使用 QuizCard 组件 ============
  if (isReviewing && currentReviewQuestion) {
    const wrongInfo = getWrongInfo(currentReviewQuestion.id);

    return (
      <div className="min-h-screen bg-slate-50">
        {/* 固定顶部栏 */}
        <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 py-3 z-30">
          <div className="max-w-[970px] mx-auto flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setIsReviewing(false); refreshData(); }}
              className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg h-9 px-3"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span className="text-sm">退出</span>
            </Button>
            
            <span className="text-sm font-medium text-slate-600">
              {reviewIndex + 1} / {reviewQuestions.length}
            </span>
            
            <div className="w-16" />
          </div>
        </div>

        <div className="h-12" />

        {/* 错题统计提示 */}
        <div className="bg-amber-50 px-4 py-2 border-b border-amber-100">
          <div className="max-w-[970px] mx-auto flex gap-4 text-sm text-amber-700">
            <span>错题 <span className="font-semibold">{wrongInfo.wrongCount}</span> 次</span>
            <span>掌握度 <span className="font-semibold">{wrongInfo.streak}</span>/3</span>
          </div>
        </div>

        {/* 使用 QuizCard 组件 */}
        <QuizCard
          question={currentReviewQuestion}
          displayQuestion={currentReviewQuestion}
          currentIndex={reviewIndex}
          currentChildIndex={0}
          showExplanation={showExplanation}
          answer={localAnswer}
          onAnswerSelect={handleAnswerSelect}
          onViewAnswer={() => setShowExplanation(true)}
        />

        {/* 底部固定操作栏 */}
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

              {!showExplanation ? (
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={localAnswer === undefined || (Array.isArray(localAnswer) && localAnswer.length === 0)}
                  className="h-11 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold shadow-sm"
                >
                  <span className="text-sm">提交</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => markAsMastered(currentReviewQuestion.id)}
                  className="h-11 px-6 rounded-xl border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span className="ml-1.5 text-sm">已掌握</span>
                </Button>
              )}

              <Button
                size="sm"
                onClick={handleNext}
                disabled={!showExplanation}
                className="h-9 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-xl disabled:opacity-50"
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
      <main className="max-w-[970px] mx-auto px-4 py-5">
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
        {currentUser && mounted && !isSyncing && wrongQuestionsStats.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Check className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">太棒了！暂无错题</h2>
            <p className="text-gray-400 text-sm mb-6">继续保持，做题全对不是梦</p>
            <Link href="/?tab=library">
              <Button className="bg-gray-900 hover:bg-gray-800 h-11 px-8 rounded-xl">去刷题</Button>
            </Link>
          </div>
        )}

        {/* 有错题 */}
        {currentUser && mounted && !isSyncing && wrongQuestionsStats.length > 0 && (
          <>
            {/* 统计仪表盘 */}
            <WrongBookStats 
              wrongQuestions={wrongQuestionsStats}
              filteredQuestions={filteredQuestions}
              onStartReview={startReview}
            />

            {/* 题库分类筛选 */}
            {bankCounts.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 whitespace-nowrap">题库:</span>
                  <Select value={bankFilter} onValueChange={setBankFilter}>
                    <SelectTrigger className="h-8 text-sm flex-1">
                      <SelectValue placeholder="全部题库" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部题库 ({wrongQuestionsStats.length})</SelectItem>
                      {bankCounts.map(bank => (
                        <SelectItem key={bank.id} value={bank.id}>
                          {bank.name} ({bank.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* 题型筛选 */}
            <WrongBookTypeFilter 
              typeFilter={typeFilter}
              onTypeChange={setTypeFilter}
              typeCounts={typeCounts}
            />

            {/* 错题列表 - 分页加载，每页20题 */}
            {paginatedQuestions.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                该题型暂无错题
              </div>
            ) : (
              <div 
                ref={listContainerRef}
                className="rounded-xl space-y-3"
              >
                {paginatedQuestions.map((question) => {
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
                
                {/* 加载更多提示 */}
                <div className="py-4 text-center">
                  {isLoadingMore ? (
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span className="text-sm">加载中...</span>
                    </div>
                  ) : hasMore ? (
                    <div className="text-gray-400 text-sm">
                      已加载 {paginatedQuestions.length} / {typeCounts.all} 题
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm">
                      已加载全部 {paginatedQuestions.length} 题
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} onAuthChange={checkAuth} />
    </div>
  );
}

// ============ 子组件 ============

interface WrongBookStatsProps {
  wrongQuestions: Question[];
  filteredQuestions: Question[];
  onStartReview: (questions: Question[]) => void;
}

function WrongBookStats({ wrongQuestions, filteredQuestions, onStartReview }: WrongBookStatsProps) {
  const totalWrong = wrongQuestions.length;
  const masteredCount = wrongQuestions.filter(q => (wrongStreakStore.get(q.id) || 0) >= 3).length;
  const needReviewCount = totalWrong - masteredCount;
  const masteryRate = totalWrong > 0 ? Math.round((masteredCount / totalWrong) * 100) : 0;
  
  const records = recordStore.getAll();

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">错题本</h3>
          <p className="text-sm text-gray-500">共 <span className="font-semibold text-gray-900">{totalWrong}</span> 道错题待复习</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
          <BookOpen className="w-6 h-6 text-white" />
        </div>
      </div>
      
   
      
      {/* 功能入口 - 全部错题 & 最近错题 & 常错题 */}
      <div className="grid grid-cols-3 gap-3">
        <button 
          onClick={() => onStartReview(filteredQuestions)}
          disabled={filteredQuestions.length === 0}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-sm font-medium">全部错题</span>
        </button>
        
        <button 
          onClick={() => {
            const recentWrong = [...filteredQuestions]
              .sort((a, b) => {
                const getLastWrongTime = (q: Question) => {
                  const qRecords = records.filter(r => r.questionId === q.id && !r.isCorrect);
                  return qRecords.length > 0 ? Math.max(...qRecords.map(r => r.timestamp)) : 0;
                };
                return getLastWrongTime(b) - getLastWrongTime(a);
              });
            if (recentWrong.length > 0) onStartReview(recentWrong);
          }}
          disabled={filteredQuestions.length === 0}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-5 h-5" />
          <span className="text-sm font-medium">最近错题</span>
        </button>
        
        <button 
          onClick={() => {
            const frequentWrong = [...filteredQuestions]
              .sort((a, b) => {
                const getWrongCount = (q: Question) => {
                  return records.filter(r => r.questionId === q.id && !r.isCorrect).length;
                };
                return getWrongCount(b) - getWrongCount(a);
              });
            if (frequentWrong.length > 0) onStartReview(frequentWrong);
          }}
          disabled={filteredQuestions.length === 0}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50"
        >
          <Brain className="w-5 h-5" />
          <span className="text-sm font-medium">常错题</span>
        </button>
      </div>
    </div>
  );
}

interface WrongBookTypeFilterProps {
  typeFilter: QuestionType | 'all';
  onTypeChange: (type: QuestionType | 'all') => void;
  typeCounts: Record<string, number>;
}

function WrongBookTypeFilter({ typeFilter, onTypeChange, typeCounts }: WrongBookTypeFilterProps) {
  const types: (QuestionType | 'all')[] = ['all', 'single', 'multiple', 'true-false', 'fill-blank', 'comprehensive'];
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
      <p className="text-xs text-gray-400 mb-3">题型筛选</p>
      <div className="flex gap-2.5 flex-wrap">
        {types.map(t => {
          const count = typeCounts[t] || 0;
          if (t !== 'all' && count === 0) return null;
          const isActive = typeFilter === t;
          const label = t === 'all' ? '全部' : TYPE_LABELS[t];
          return (
            <button
              key={t}
              onClick={() => onTypeChange(t)}
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
  );
}


