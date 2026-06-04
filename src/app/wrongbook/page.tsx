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
import { Textarea } from '@/components/ui/textarea';
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
  Brain,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { questionStore, recordStore, bankStore, getWrongQuestionIds, wrongStreakStore, generateId, cloudSyncService, queueRecordForSync, queueStreakForSync, forceSync, forceSyncBeacon, getUserToken, deletedQuestionStore, withSyncLock } from '@/lib/quiz-store';
import { Question, PracticeRecord, QuestionType } from '@/lib/types';
import { recalculateWrongData as recalculateWrongDataUtil } from '@/lib/stats-utils';
import { checkAnswer as sharedCheckAnswer } from '@/lib/import-utils';
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
  const [bankFilter, setBankFilter] = useState<string | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  
  // 云端题目数据缓存（用于解决不同设备间题目数据不一致问题）
  const [cloudQuestions, setCloudQuestions] = useState<Record<string, Question>>({});
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
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
            // 同时保存到 bankStore
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

  // 监听题库删除事件，自动刷新数据
  useEffect(() => {
    const handleBankDeleted = (e: CustomEvent<{ questionIds: string[] }>) => {
      // 清除本地相关数据
      const { recordStore, wrongStreakStore, questionStore, deletedQuestionStore } = 
        require('@/lib/quiz-store') as typeof import('@/lib/quiz-store');
      deletedQuestionStore.add(e.detail.questionIds);
      recordStore.removeByQuestionIds(e.detail.questionIds);
      wrongStreakStore.removeByQuestionIds(e.detail.questionIds);
      questionStore.removeByQuestionIds(e.detail.questionIds);
      // 刷新页面数据
      refreshData();
    };
    
    window.addEventListener('bankDeleted', handleBankDeleted as EventListener);
    return () => {
      window.removeEventListener('bankDeleted', handleBankDeleted as EventListener);
    };
  }, [refreshData]);

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

  // 使用 ref 持有 fetchQuestionsFromCloud，避免 TDZ 问题
  const fetchQuestionsFromCloudRef = useRef<((ids: string[]) => Promise<void>) | null>(null);

  const syncFromCloud = useCallback(async (skipPush: boolean = false) => {
    const user = getStoredUser();
    if (!user) return;
    setIsSyncing(true);
    try {
      // 使用同步锁，避免与 flushSyncQueue 等并发导致数据覆盖
      await withSyncLock(async () => {
        // 先 pull 云端数据
        const cloudData = await cloudSyncService.pullData(user.id);
        if (cloudData) {
          // 过滤掉已删除的题目相关数据
          const validRecords = cloudData.records.filter(r => !deletedQuestionStore.isDeleted(r.questionId));
          const validStreaks: Record<string, number> = {};
          Object.entries(cloudData.streaks).forEach(([questionId, streak]) => {
            if (!deletedQuestionStore.isDeleted(questionId)) {
              validStreaks[questionId] = streak;
            }
          });
          
          // 合并策略：云端数据优先（同ID以云端为准），但保留本地特有的新记录
          // 这确保不同设备看到一致的错题记录，同时不丢失本地尚未同步的做题数据
          const existingRecords = recordStore.getAll();
          const cloudRecordIds = new Set(validRecords.map(r => r.id));
          const localOnlyRecords = existingRecords.filter(r => !cloudRecordIds.has(r.id));
          recordStore.save([...validRecords, ...localOnlyRecords]);

          // streaks 同理：云端优先，本地新增保留
          const existingStreaks = wrongStreakStore.getAll();
          const mergedStreaks = { ...validStreaks };
          for (const [qId, streak] of Object.entries(existingStreaks)) {
            if (!(qId in mergedStreaks)) {
              mergedStreaks[qId] = streak;
            }
          }
          wrongStreakStore.save(mergedStreaks);
          
          // 获取云端记录中的题目ID，并尝试从云端获取缺失的题目
          const cloudQuestionIds = [...new Set(validRecords.map(r => r.questionId))];
          const localQuestions = questionStore.getAll();
          const localQuestionIds = new Set(localQuestions.map(q => q.id));
          const missingQuestionIds = cloudQuestionIds.filter(id => !localQuestionIds.has(id));
          
          if (missingQuestionIds.length > 0 && fetchQuestionsFromCloudRef.current) {
            // 通过 ref 调用，避免依赖数组中的 TDZ 问题
            // 在 try 块中 await 完成，确保 finally 中 recalculateWrongData 时
            // cloudQuestions 已经更新，避免错题列表分步显示
            await fetchQuestionsFromCloudRef.current(missingQuestionIds);
          }
        }
      });
      // 再按需 push 本地数据
      if (!skipPush) {
        // 上传前先基于记录重新计算 streaks，保证 streaks 与记录一致
        const records = recordStore.getAll();
        const computedStreaks: Record<string, number> = {};
        // 按 questionId 分组，按时间排序，计算连续正确次数
        const questionsByGroup: Record<string, PracticeRecord[]> = {};
        records.forEach(r => {
          if (!questionsByGroup[r.questionId]) questionsByGroup[r.questionId] = [];
          questionsByGroup[r.questionId].push(r);
        });
        Object.entries(questionsByGroup).forEach(([qId, qRecords]) => {
          // 按时间降序排列（最新的在前）
          qRecords.sort((a, b) => b.timestamp - a.timestamp);
          let streak = 0;
          for (const r of qRecords) {
            if (r.isCorrect) streak++;
            else streak = 0;
          }
          if (streak > 0) computedStreaks[qId] = streak;
        });
        wrongStreakStore.save(computedStreaks);
        await cloudSyncService.saveRecordsAndStreaks(user.id, records, computedStreaks);
      }
    } finally {
      setIsSyncing(false);
      recalculateWrongData();
    }
  }, [recalculateWrongData]); // eslint-disable-line react-hooks/exhaustive-deps

  // 监听登录/登出事件，自动刷新数据
  useEffect(() => {
    const handleUserAuthChange = () => {
      const user = getStoredUser();
      setCurrentUser(user);
      if (user) {
        // 先标记同步中，避免在异步同步完成前显示"暂无错题"
        setIsSyncing(true);
        syncFromCloud(true).finally(() => recalculateWrongData());
      } else {
        refreshData();
      }
    };
    
    window.addEventListener('user-auth-change', handleUserAuthChange);
    
    return () => {
      window.removeEventListener('user-auth-change', handleUserAuthChange);
    };
  }, [syncFromCloud, recalculateWrongData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);
    // 立即渲染（先展示本地已有数据），同步在后台执行
    setMounted(true);
    if (user) {
      syncFromCloud(true).finally(() => recalculateWrongData());
    }
    
    // 页面卸载前强制同步（使用 sendBeacon 防止数据丢失）
    const handleBeforeUnload = () => {
      if (cloudSyncService.hasPendingSync()) {
        // 使用 sendBeacon 确保 beforeunload 期间请求能发出
        forceSyncBeacon();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // 组件卸载时强制同步
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
    
    setIsLoadingQuestions(true);
    try {
      // 分批并发获取，每批50个
      const batchSize = 50;
      const fetchedQuestions: Record<string, Question> = {};
      
      const batches: string[][] = [];
      for (let i = 0; i < questionIds.length; i += batchSize) {
        batches.push(questionIds.slice(i, i + batchSize));
      }
      
      // 所有 batch 并发请求
      const results = await Promise.allSettled(
        batches.map(batch =>
          fetch('/api/questions/batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ ids: batch }),
          }).then(res => res.json())
        )
      );
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.questions) {
          result.value.questions.forEach((q: Question) => {
            fetchedQuestions[q.id] = q;
          });
        }
      });
      
      setCloudQuestions(prev => ({ ...prev, ...fetchedQuestions }));
    } finally {
      setIsLoadingQuestions(false);
    }
  }, []);

  // 同步 ref，使 syncFromCloud 可以通过 ref 调用 fetchQuestionsFromCloud
  useEffect(() => {
    fetchQuestionsFromCloudRef.current = fetchQuestionsFromCloud;
  }, [fetchQuestionsFromCloud]);

  // 记录缺失的题目ID用于调试
  const wrongQuestions = useMemo(() => {
    const wrongIds = getWrongQuestionIds();
    const allQuestions = questionStore.getAll();
    
    const foundQuestions: Question[] = [];
    
    wrongIds.forEach(id => {
      // 优先从本地顶层列表查找
      const localQuestion = allQuestions.find(q => q.id === id);
      if (localQuestion) {
        foundQuestions.push(localQuestion);
        return;
      }
      
      // 搜索综合题的子题，并附加父题的案例背景
      let foundChild: Question | undefined;
      for (const parent of allQuestions) {
        if (parent.children) {
          const child = parent.children.find(c => c.id === id);
          if (child) {
            // 将父题的案例背景附加到子题（如果子题没有自己的案例背景）
            foundChild = {
              ...child,
              caseBackground: child.caseBackground || parent.caseBackground,
            };
            break;
          }
        }
      }
      if (foundChild) {
        foundQuestions.push(foundChild);
        return;
      }
      
      // 本地没有则从云端缓存查找（但跳过已删除的题目）
      if (!deletedQuestionStore.isDeleted(id)) {
        const cloudQuestion = cloudQuestions[id];
        if (cloudQuestion) {
          foundQuestions.push(cloudQuestion);
          return;
        }
      }
    });
    
    return foundQuestions;
  }, [refreshKey, cloudQuestions]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // 检测缺失的题目并从云端获取
  useEffect(() => {
    const wrongIds = getWrongQuestionIds();
    const allQuestions = questionStore.getAll();
    const localIds = new Set(allQuestions.map(q => q.id));
    // 同时收集所有子题ID
    allQuestions.forEach(q => {
      if (q.children) {
        q.children.forEach(c => localIds.add(c.id));
      }
    });
    const missingIds = wrongIds.filter(id => !localIds.has(id) && !cloudQuestions[id]);
    
    if (missingIds.length > 0) {
      fetchQuestionsFromCloud(missingIds);
    }
  }, [refreshKey, cloudQuestions, fetchQuestionsFromCloud]); 

  const filteredQuestions = useMemo(() => {
    let result = wrongQuestions;
    if (bankFilter !== 'all') {
      result = result.filter(q => q.bankId === bankFilter);
    }
    if (typeFilter !== 'all') {
      result = result.filter(q => q.type === typeFilter);
    }
    return result;
  }, [wrongQuestions, typeFilter, bankFilter]);

  const totalPages = Math.ceil(filteredQuestions.length / PAGE_SIZE);
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredQuestions.slice(start, start + PAGE_SIZE);
  }, [filteredQuestions, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [typeFilter, bankFilter]);

  const typeCounts = useMemo(() => {
    // 根据当前题库筛选计算题型数量
    const base = bankFilter === 'all' ? wrongQuestions : wrongQuestions.filter(q => q.bankId === bankFilter);
    const counts: Record<string, number> = { all: base.length };
    base.forEach(q => { counts[q.type] = (counts[q.type] || 0) + 1; });
    return counts;
  }, [wrongQuestions, bankFilter]);

  // 按题库分类统计
  const bankCounts = useMemo(() => {
    const counts: { id: string; name: string; count: number }[] = [];
    
    // 先收集所有有错题的题库
    const bankMap = new Map<string, number>();
    wrongQuestions.forEach(q => {
      if (q.bankId) {
        bankMap.set(q.bankId, (bankMap.get(q.bankId) || 0) + 1);
      }
    });
    
    // 匹配题库名称，过滤已删除的题库
    bankMap.forEach((count, bankId) => {
      const bank = banks.find(b => b.id === bankId);
      if (bank) {
        counts.push({
          id: bankId,
          name: bank.name,
          count,
        });
      }
    });
    
    // 按错题数量降序排列
    return counts.sort((a, b) => b.count - a.count);
  }, [wrongQuestions, banks]);
  
  // 一次读取全部记录，避免 getWrongInfo 中每道题重复读取 localStorage
  const allRecords = useMemo(() => recordStore.getAll(), [refreshKey]);

  const getWrongInfo = useCallback((questionId: string) => {
    const records = allRecords.filter(r => r.questionId === questionId);
    return { 
      wrongCount: records.filter(r => !r.isCorrect).length, 
      streak: wrongStreakStore.get(questionId) 
    };
  }, [allRecords]);

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
      
      const user = getStoredUser();
      
      if (correct) {
        wrongStreakStore.increment(currentReviewQuestion.id);
        const newStreak = wrongStreakStore.get(currentReviewQuestion.id);
        // 使用增量同步队列
        if (user) {
          queueStreakForSync(currentReviewQuestion.id, newStreak);
        }
        if (newStreak >= 3) {
          recordStore.save(recordStore.getAll().filter(r => !(r.questionId === currentReviewQuestion.id && !r.isCorrect)));
          wrongStreakStore.remove(currentReviewQuestion.id);
          // 同步 streak 移除
          if (user) {
            queueStreakForSync(currentReviewQuestion.id, 0);
          }
        }
      } else {
        wrongStreakStore.reset(currentReviewQuestion.id);
        // 同步 streak 重置
        if (user) {
          queueStreakForSync(currentReviewQuestion.id, 0);
        }
      }
      
      // 使用增量同步队列（防抖同步，3秒后自动同步）
      if (user) {
        queueRecordForSync(record);
      }
      
      // 刷新错题列表，确保 streak 达到 3 的题目被移除
      refreshData();
    }
  }, [currentReviewQuestion, localAnswer, refreshData]);

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
      // 使用增量同步队列（标记 streak 为 0 表示移除）
      queueStreakForSync(questionId, 0);
    }
    // 立即刷新错题列表，移除已掌握的题目
    refreshData();
    // 自动跳到下一题，如果没有下一题则返回错题本
    if (reviewIndex < reviewQuestions.length - 1) {
      setReviewIndex(reviewIndex + 1);
      setShowExplanation(false);
      setLocalAnswer(undefined);
      setIsAnswerCorrect(false);
    } else {
      setIsReviewing(false);
    }
  }, [reviewIndex, reviewQuestions.length, refreshData]);

  // 使用共享的答案检查方法
  const checkAnswerInline = sharedCheckAnswer;

  const getOptionLabel = (index: number) => String.fromCharCode(65 + index);

  // ============ 复习模式 - 沉浸式做题体验 ============
  if (isReviewing && currentReviewQuestion) {
    const wrongInfo = getWrongInfo(currentReviewQuestion.id);

    return (
      <div className="min-h-screen bg-slate-50">
        {/* 固定顶部栏 - 横向铺满 */}
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

        {/* 占位高度，防止内容被固定导航遮挡 */}
        <div className="h-14" />

        {/* 进度条 */}
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
        <div className="pb-28 px-4 sm:px-6">
          <div className="max-w-[970px] mx-auto py-3">
            {/* 题目卡片 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              {/* 题干头部 */}
              <div className="px-5 py-3 border-b border-slate-50 bg-gradient-to-r from-slate-50 to-white">
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
                <div className="mx-5 mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <div className="text-xs text-indigo-700 leading-relaxed">
                    <RichTextWithBreaks content={currentReviewQuestion.caseBackground} textClassName="whitespace-pre-wrap" />
                  </div>
                </div>
              )}

              {/* 题目内容 */}
              <div className="px-5 py-4">
                <div className="text-base font-medium text-slate-800 leading-relaxed">
                  <RichTextWithBreaks content={currentReviewQuestion.content || ''} textClassName="whitespace-pre-wrap" />
                </div>
              </div>

              {/* 分隔线 */}
              <div className="mx-5 h-px bg-slate-100" />

              {/* 选项区域 */}
              <div className="px-5 pb-5">
                {/* 填空题输入框 */}
                {currentReviewQuestion.type === 'fill-blank' ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="输入你的答案..."
                      value={(localAnswer as string) || ''}
                      onChange={(e) => setLocalAnswer(e.target.value)}
                      disabled={showExplanation}
                      className="min-h-[80px] rounded-xl border-2 border-slate-200 focus:border-blue-300 bg-white text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentReviewQuestion.options?.map((option, index) => {
                      const isMulti = currentReviewQuestion.type === 'multiple';
                      // 标准化为小写比较（处理大小写不一致）
                      const optionIdLower = option.id.toLowerCase();
                      const normalizeAnswer = (ans: string | string[] | undefined): string[] => {
                        if (!ans) return [];
                        if (Array.isArray(ans)) return ans.map(a => a.toLowerCase());
                        return [ans.toLowerCase()];
                      };
                      const isSelected = isMulti
                        ? Array.isArray(localAnswer) && localAnswer.map(a => a.toLowerCase()).includes(optionIdLower)
                        : typeof localAnswer === 'string' && localAnswer.toLowerCase() === optionIdLower;
                      const correctAnswer = currentReviewQuestion.answer;
                      // 处理答案格式：数组、字符串（单选）、多选字符串（如"CD"）
                      const isCorrectAnswer = (() => {
                        if (Array.isArray(correctAnswer)) {
                          return correctAnswer.map(a => a.toLowerCase()).includes(optionIdLower);
                        }
                        if (typeof correctAnswer === 'string') {
                          const answerLower = correctAnswer.toLowerCase();
                          // 多选题答案可能是"CD"这种格式，需要按字符拆分匹配
                          if (isMulti && answerLower.length > 1) {
                            return answerLower.includes(optionIdLower);
                          }
                          return answerLower === optionIdLower;
                        }
                        return false;
                      })();

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
                )}
              </div>

              {/* 答案与解析 */}
              {showExplanation && (
                <div className="px-5 pb-5 space-y-3">
                  <div className={`rounded-xl p-4 ${isAnswerCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
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
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
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
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b sticky top-0 z-50">
        <div className="max-w-[970px] mx-auto px-4 h-14 flex items-center justify-between">
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

      <main className="max-w-[970px] mx-auto px-4 py-5">
        {/* 未登录 */}
        {!currentUser && (
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

        {/* 同步中轻提示条（不阻塞内容展示） */}
            {isSyncing && wrongQuestions.length > 0 && (
              <div className="flex items-center justify-center gap-2 py-3 mb-4 bg-indigo-50 rounded-xl text-indigo-600 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>正在同步最新数据...</span>
              </div>
            )}

            {/* 有错题 */}
            {currentUser && wrongQuestions.length > 0 && (
          <>
            {/* ========== 错题本卡片方案选择 ========== */}
            {(() => {
              // 计算统计数据
              const totalWrong = wrongQuestions.length;
              const masteredCount = wrongQuestions.filter(q => (wrongStreakStore.get(q.id) || 0) >= 3).length;
              const needReviewCount = totalWrong - masteredCount;
              const masteryRate = totalWrong > 0 ? Math.round((masteredCount / totalWrong) * 100) : 0;
              
              // 计算今日新增错题
              const today = new Date().toDateString();
              const todayWrong = recordStore.getAll().filter(r => {
                if (r.isCorrect) return false;
                const recordDate = new Date(r.timestamp).toDateString();
                return recordDate === today;
              }).length;

              // ===== 方案一：数据仪表盘风格 =====
              const Scheme1 = () => (
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-4">
                  <div className="flex items-center gap-4">
                    {/* 左侧：错题总数 */}
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-1">错题总数</p>
                      <p className="text-5xl font-bold text-gray-900">{totalWrong}</p>
                      <div className="flex gap-4 mt-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs text-gray-500">已掌握 {masteredCount}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="text-xs text-gray-500">待复习 {needReviewCount}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* 右侧：环形进度 */}
                    <div className="relative w-24 h-24">
                      <svg className="w-full h-full -rotate-90">
                        <circle cx="48" cy="48" r="40" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                        <circle 
                          cx="48" cy="48" r="40" fill="none" 
                          stroke="url(#gradient1)" strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${masteryRate * 2.51} 251`}
                        />
                        <defs>
                          <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#34d399" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-bold text-gray-900">{masteryRate}%</span>
                        <span className="text-xs text-gray-400">掌握率</span>
                      </div>
                    </div>
                  </div>
                 
                      
                  {/* 开始复习按钮 */}
                  <Button 
                    onClick={() => startReview(filteredQuestions)} 
                    disabled={filteredQuestions.length === 0}
                    className="w-full h-12 mt-5 rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white font-medium"
                  >
                    开始复习
                  </Button>
                </div>
              );


  
              // 默认使用方案一（功能入口风格），可以通过修改这里切换
              return <Scheme1 />;
            })()}

            {/* 题库分类筛选 - 下拉选择 */}
            {bankCounts.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 whitespace-nowrap">题库:</span>
                  <Select value={bankFilter} onValueChange={setBankFilter}>
                    <SelectTrigger className="h-8 text-sm flex-1">
                      <SelectValue placeholder="全部题库" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部题库 ({wrongQuestions.length})</SelectItem>
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
              <p className="text-xs text-gray-400 mb-3">题型筛选</p>
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

        {/* 无错题或加载中 */}
        {currentUser && wrongQuestions.length === 0 && (
          <div className="text-center py-16">
            {isSyncing ? (
              <div className="w-full max-w-2xl mx-auto space-y-4">
                {/* 骨架屏：顶部进度栏 */}
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="w-1/3 h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full animate-pulse" />
                </div>
                {/* 骨架屏：题目卡片 */}
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 animate-pulse">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-16 h-5 bg-gray-200 rounded-full" />
                      <div className="w-24 h-5 bg-gray-200 rounded-full" />
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="w-full h-4 bg-gray-200 rounded" />
                      <div className="w-3/4 h-4 bg-gray-200 rounded" />
                    </div>
                    <div className="space-y-2">
                      {[1, 2, 3, 4].map(j => (
                        <div key={j} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
                          <div className="w-5 h-5 bg-gray-200 rounded-full" />
                          <div className="flex-1 h-3 bg-gray-200 rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <Check className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">太棒了！暂无错题</h2>
                <p className="text-gray-400 text-sm mb-6">继续保持，做题全对不是梦</p>
                <Link href="/?tab=library">
                  <Button className="bg-gray-900 hover:bg-gray-800 h-11 px-8 rounded-xl">去刷题</Button>
                </Link>
              </>
            )}
          </div>
        )}

      </main>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} onAuthChange={checkAuth} />
    </div>
  );
}
