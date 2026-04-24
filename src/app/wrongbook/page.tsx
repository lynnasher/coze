'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Check, BookOpen, User } from 'lucide-react';
import { questionStore, getWrongQuestionIds, wrongStreakStore } from '@/lib/quiz-store';
import { Question, QuestionType } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserStatus, AuthModal, getCurrentUser } from '@/components/AuthModal';

const TYPE_LABELS: Record<QuestionType | 'all', string> = {
  'all': '全部', 'single': '单选', 'multiple': '多选',
  'true-false': '判断', 'fill-blank': '填空', 'comprehensive': '综合'
};

const TYPE_COLORS: Record<QuestionType, string> = {
  'single': 'bg-blue-500', 'multiple': 'bg-violet-500',
  'true-false': 'bg-cyan-500', 'fill-blank': 'bg-emerald-500', 'comprehensive': 'bg-rose-500'
};

const TYPE_FILTER: (QuestionType | 'all')[] = ['all', 'single', 'multiple', 'true-false', 'fill-blank', 'comprehensive'];

export default function WrongBookPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<QuestionType | 'all'>('all');
  const [bankFilter, setBankFilter] = useState<string | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    setMounted(true);
  }, []);

  // 错题列表
  const wrongQuestions = useMemo(() => {
    const wrongIds = getWrongQuestionIds();
    const allQuestions = questionStore.getAll();
    return wrongIds.map(id => allQuestions.find(q => q.id === id)).filter((q): q is Question => q !== undefined);
  }, [mounted]);

  const filteredQuestions = useMemo(() => {
    return wrongQuestions.filter(q => {
      if (typeFilter !== 'all' && q.type !== typeFilter) return false;
      if (bankFilter !== 'all' && q.bankId !== bankFilter) return false;
      return true;
    });
  }, [wrongQuestions, typeFilter, bankFilter]);

  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredQuestions.slice(start, start + PAGE_SIZE);
  }, [filteredQuestions, currentPage]);

  const totalPages = Math.ceil(filteredQuestions.length / PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [typeFilter, bankFilter]);

  // 统计数据
  const stats = useMemo(() => {
    const total = wrongQuestions.length;
    const mastered = wrongQuestions.filter(q => (wrongStreakStore.get(q.id) || 0) >= 3).length;
    return {
      total, mastered, needReview: total - mastered,
      masteryRate: total > 0 ? Math.round((mastered / total) * 100) : 0
    };
  }, [wrongQuestions]);

  // 题型统计
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: filteredQuestions.length };
    filteredQuestions.forEach(q => { counts[q.type] = (counts[q.type] || 0) + 1; });
    return counts;
  }, [filteredQuestions]);

  // 题库统计
  const bankOptions = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    wrongQuestions.forEach(q => {
      if (!q.bankId) return;
      const existing = map.get(q.bankId);
      if (existing) existing.count++;
      else map.set(q.bankId, { name: q.bankName || `题库${q.bankId.slice(-4)}`, count: 1 });
    });
    return Array.from(map.entries()).map(([id, { name, count }]) => ({ id, name, count }));
  }, [wrongQuestions]);

  const startReview = (questions: Question[]) => {
    if (questions.length === 0) return;
    const ids = questions.map(q => q.id).join(',');
    sessionStorage.setItem('wrongbook_questions', ids);
    router.push(`/practice?wrongbook=true&questions=${ids}`);
  };

  if (!mounted) return null;

  // 未登录
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center">
              <User className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">请先登录</h2>
            <p className="text-gray-400 text-sm mb-6">登录后查看错题本</p>
            <Button onClick={() => setAuthModalOpen(true)} className="bg-gray-900 hover:bg-gray-800 h-11 px-8 rounded-xl">
              去登录
            </Button>
          </div>
        </main>
        <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
      </div>
    );
  }

  // 无错题
  if (wrongQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center">
              <Check className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">太棒了！暂无错题</h2>
            <p className="text-gray-400 text-sm mb-6">继续保持，做题全对不是梦</p>
            <Link href="/">
              <Button className="bg-gray-900 hover:bg-gray-800 h-11 px-8 rounded-xl">去刷题</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header />

      <main className="max-w-[970px] mx-auto px-4 py-5">
        {/* 统计卡片 */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-4xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500 mt-1">错题总数</p>
              <div className="flex gap-3 mt-2 text-xs">
                <span className="text-emerald-600">已掌握 {stats.mastered}</span>
                <span className="text-amber-600">待复习 {stats.needReview}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-gray-900">{stats.masteryRate}%</p>
              <p className="text-sm text-gray-500">掌握率</p>
            </div>
          </div>
          <Button 
            onClick={() => startReview(filteredQuestions)} 
            disabled={filteredQuestions.length === 0}
            className="w-full h-12 mt-4 rounded-2xl bg-gray-900 hover:bg-gray-800 text-white font-medium"
          >
            开始复习 ({filteredQuestions.length}题)
          </Button>
        </div>

        {/* 题库筛选 */}
        {bankOptions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 mb-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <FilterBtn active={bankFilter === 'all'} onClick={() => setBankFilter('all')}>
                全部 ({wrongQuestions.length})
              </FilterBtn>
              {bankOptions.map(bank => (
                <FilterBtn key={bank.id} active={bankFilter === bank.id} onClick={() => setBankFilter(bank.id)}>
                  {bank.name} ({bank.count})
                </FilterBtn>
              ))}
            </div>
          </div>
        )}

        {/* 题型筛选 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 mb-4">
          <div className="flex gap-2 flex-wrap">
            {TYPE_FILTER.map(t => {
              const count = typeCounts[t] || 0;
              if (t !== 'all' && count === 0) return null;
              return (
                <FilterBtn key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
                  {TYPE_LABELS[t]} {count}
                </FilterBtn>
              );
            })}
          </div>
        </div>

        {/* 错题列表 */}
        <div className="space-y-2">
          {paginatedQuestions.map(q => {
            const streak = wrongStreakStore.get(q.id) || 0;
            return (
              <div key={q.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 px-2 py-1 rounded-full text-[11px] font-semibold text-white ${TYPE_COLORS[q.type]}`}>
                    {TYPE_LABELS[q.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-gray-800 line-clamp-2">{q.content}</p>
                    {streak > 0 && (
                      <p className="text-xs text-emerald-600 mt-1">连续答对 {streak} 次</p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => startReview([q])} className="shrink-0 rounded-xl">
                    复习
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button variant="ghost" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-sm text-gray-600">{currentPage} / {totalPages}</span>
            <Button variant="ghost" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        )}
      </main>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </div>
  );
}

// 子组件
function Header() {
  return (
    <header className="bg-white/80 backdrop-blur-xl border-b sticky top-0 z-50">
      <div className="max-w-[970px] mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900">智能刷题</span>
        </Link>
        <UserStatus />
      </div>
    </header>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
        active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}
