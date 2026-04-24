'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
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
  Settings,
  User,
  RefreshCw,
} from 'lucide-react';
import { questionStore, recordStore, bankStore, getWrongQuestionIds, wrongStreakStore, cloudSyncService, forceSync, forceSyncBeacon, getUserToken } from '@/lib/quiz-store';
import { Question, QuestionType } from '@/lib/types';
import { recalculateWrongData as recalculateWrongDataUtil } from '@/lib/stats-utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserStatus, AuthModal, getCurrentUser as getStoredUser } from '@/components/AuthModal';

const TYPE_LABELS: Record<QuestionType, string> = {
  'single': '单选',
  'multiple': '多选',
  'true-false': '判断',
  'fill-blank': '填空',
  'comprehensive': '综合',
};

const TYPE_COLORS: Record<QuestionType, { bg: string; text: string }> = {
  'single': { bg: 'bg-blue-500', text: 'text-blue-600' },
  'multiple': { bg: 'bg-violet-500', text: 'text-violet-600' },
  'true-false': { bg: 'bg-cyan-500', text: 'text-cyan-600' },
  'fill-blank': { bg: 'bg-emerald-500', text: 'text-emerald-600' },
  'comprehensive': { bg: 'bg-rose-500', text: 'text-rose-600' },
};

export default function WrongBookPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<QuestionType | 'all'>('all');
  const [bankFilter, setBankFilter] = useState<string | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  
  const [cloudQuestions, setCloudQuestions] = useState<Record<string, Question>>({});
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([]);
  const [cloudBanks, setCloudBanks] = useState<Record<string, { id: string; name: string }>>({});

  // 加载题库数据
  useEffect(() => {
    const loadBanks = async () => {
      try {
        const response = await fetch('/api/banks');
        if (response.ok) {
          const data = await response.json();
          if (data.banks) {
            setBanks(data.banks);
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
    recalculateWrongDataUtil(
      recordStore.getAll(),
      (records) => recordStore.save(records),
      (streaks) => wrongStreakStore.save(streaks),
      () => getWrongQuestionIds().length
    );
    refreshData();
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
  }, [syncFromCloud]);

  // 获取错题列表
  const wrongQuestions = useMemo(() => {
    const wrongIds = getWrongQuestionIds();
    const allQuestions = questionStore.getAll();
    
    return wrongIds.map(id => {
      const localQuestion = allQuestions.find(q => q.id === id);
      if (localQuestion) return localQuestion;
      return cloudQuestions[id];
    }).filter((q): q is Question => q !== undefined);
  }, [refreshKey, cloudQuestions]);

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
    const base = bankFilter === 'all' ? wrongQuestions : wrongQuestions.filter(q => q.bankId === bankFilter);
    const counts: Record<string, number> = { all: base.length };
    base.forEach(q => { counts[q.type] = (counts[q.type] || 0) + 1; });
    return counts;
  }, [wrongQuestions, bankFilter]);

  const bankCounts = useMemo(() => {
    const counts: { id: string; name: string; count: number }[] = [];
    const bankMap = new Map<string, number>();
    wrongQuestions.forEach(q => {
      if (q.bankId) {
        bankMap.set(q.bankId, (bankMap.get(q.bankId) || 0) + 1);
      }
    });
    
    bankMap.forEach((count, bankId) => {
      const bank = banks.find(b => b.id === bankId) || cloudBanks[bankId];
      counts.push({
        id: bankId,
        name: bank?.name || `未知题库(${bankId.slice(-6)})`,
        count,
      });
    });
    
    return counts.sort((a, b) => b.count - a.count);
  }, [wrongQuestions, banks, cloudBanks]);

  // 获取错题统计信息
  const allRecords = useMemo(() => recordStore.getAll(), [refreshKey]);

  const getWrongInfo = useCallback((questionId: string) => {
    const records = allRecords.filter(r => r.questionId === questionId);
    return { 
      wrongCount: records.filter(r => !r.isCorrect).length, 
      streak: wrongStreakStore.get(questionId) 
    };
  }, [allRecords]);

  // 开始复习 - 跳转到 practice 页面
  const startReview = useCallback((questions: Question[]) => {
    if (questions.length === 0) return;
    
    // 将错题ID列表存入 sessionStorage，供 practice 页面使用
    const questionIds = questions.map(q => q.id).join(',');
    sessionStorage.setItem('wrongbook_questions', questionIds);
    
    // 跳转到 practice 页面，传入错题模式参数
    router.push(`/practice?wrongbook=true&questions=${questionIds}`);
  }, [router]);

  // 计算统计数据
  const stats = useMemo(() => {
    const totalWrong = wrongQuestions.length;
    const masteredCount = wrongQuestions.filter(q => (wrongStreakStore.get(q.id) || 0) >= 3).length;
    const needReviewCount = totalWrong - masteredCount;
    const masteryRate = totalWrong > 0 ? Math.round((masteredCount / totalWrong) * 100) : 0;
    
    const today = new Date().toDateString();
    const todayWrong = recordStore.getAll().filter(r => {
      if (r.isCorrect) return false;
      const recordDate = new Date(r.timestamp).toDateString();
      return recordDate === today;
    }).length;

    return { totalWrong, masteredCount, needReviewCount, masteryRate, todayWrong };
  }, [wrongQuestions, refreshKey]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

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

        {/* 同步中 */}
        {currentUser && isSyncing && (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-5 h-5 animate-spin text-gray-400 mr-2" />
            <span className="text-gray-500 text-sm">同步中...</span>
          </div>
        )}

        {/* 无错题 */}
        {currentUser && !isSyncing && wrongQuestions.length === 0 && (
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
        {currentUser && !isSyncing && wrongQuestions.length > 0 && (
          <>
            {/* 数据仪表盘 */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">错题总数</p>
                  <p className="text-5xl font-bold text-gray-900">{stats.totalWrong}</p>
                  <div className="flex gap-4 mt-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs text-gray-500">已掌握 {stats.masteredCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-xs text-gray-500">待复习 {stats.needReviewCount}</span>
                    </div>
                  </div>
                </div>
                
                <div className="relative w-24 h-24">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="48" cy="48" r="40" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                    <circle 
                      cx="48" cy="48" r="40" fill="none" 
                      stroke="url(#gradient1)" strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${stats.masteryRate * 2.51} 251`}
                    />
                    <defs>
                      <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#34d399" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-gray-900">{stats.masteryRate}%</span>
                    <span className="text-xs text-gray-400">掌握率</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">{stats.todayWrong}</p>
                  <p className="text-xs text-gray-400">今日新增</p>
                </div>
                <div className="text-center border-x border-gray-100">
                  <p className="text-lg font-semibold text-gray-900">
                    {wrongQuestions.filter(q => (wrongStreakStore.get(q.id) || 0) > 0).length}
                  </p>
                  <p className="text-xs text-gray-400">正在攻克</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-emerald-600">{stats.masteredCount}</p>
                  <p className="text-xs text-gray-400">已消灭</p>
                </div>
              </div>
              
              <Button 
                onClick={() => startReview(filteredQuestions)} 
                disabled={filteredQuestions.length === 0}
                className="w-full h-12 mt-5 rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white font-medium"
              >
                开始复习
              </Button>
            </div>

            {/* 题库筛选 */}
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
      </main>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </div>
  );
}
