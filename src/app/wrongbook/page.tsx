'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft,
  BookOpen,
  Trash2,
  RotateCcw,
  Check,
  ChevronRight,
  Filter,
  Loader2,
  RefreshCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QuestionBank, Category, Question } from '@/lib/types';
import { recordStore, getWrongQuestionIds, questionStore, wrongStreakStore } from '@/lib/quiz-store';
import { useUserStore } from '@/lib/store';
import { RichTextWithBreaks } from '@/lib/rich-text';

interface WrongQuestion extends Question {
  wrongCount: number;
  lastWrongAt: number;
}

export default function WrongBookPage() {
  const { hasHydrated } = useUserStore();
  const [questions, setQuestions] = useState<WrongQuestion[]>([]);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<WrongQuestion | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [filterBankId, setFilterBankId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'time' | 'count'>('time');

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [banksRes, categoriesRes] = await Promise.all([
        fetch('/api/banks'),
        fetch('/api/categories'),
      ]);

      let loadedBanks: QuestionBank[] = [];
      if (banksRes.ok) {
        const banksData = await banksRes.json();
        loadedBanks = banksData.banks || [];
        setBanks(loadedBanks);
      }

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.categories || []);
      }

      // 加载错题
      const allRecords = recordStore.getAll();
      const wrongIds = getWrongQuestionIds();
      const wrongStreakData = wrongStreakStore.getAll();

      const allQuestions = questionStore.getAll();
      const wrongQuestions: WrongQuestion[] = wrongIds
        .map(id => {
          const q = allQuestions.find(q => q.id === id);
          if (!q) return null;
          const wrongCount = wrongStreakData[id] || 0;
          const wrongRecords = allRecords.filter((r: { questionId: string; isCorrect: boolean }) => r.questionId === id && !r.isCorrect);
          return {
            ...q,
            wrongCount: wrongCount > 0 ? wrongCount : wrongRecords.length || 1,
            lastWrongAt: wrongRecords[wrongRecords.length - 1]?.timestamp || Date.now(),
          };
        })
        .filter((q): q is WrongQuestion => q !== null);

      setQuestions(wrongQuestions);
    } catch (error) {
      console.error('加载错题本失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 筛选和排序错题
  const filteredQuestions = useMemo(() => {
    let filtered = [...questions];

    // 按题库筛选
    if (filterBankId !== 'all') {
      filtered = filtered.filter(q => q.bankId === filterBankId);
    }

    // 排序
    filtered.sort((a, b) => {
      if (sortBy === 'time') {
        return b.lastWrongAt - a.lastWrongAt;
      }
      return b.wrongCount - a.wrongCount;
    });

    return filtered;
  }, [questions, filterBankId, sortBy]);

  // 移除错题
  const handleRemove = (questionId: string) => {
    wrongStreakStore.remove(questionId);
    setQuestions(prev => prev.filter(q => q.id !== questionId));
    if (selectedQuestion?.id === questionId) {
      setSelectedQuestion(null);
    }
  };

  // 重置错题记录
  const handleReset = () => {
    if (confirm('确定要清空所有错题记录吗？')) {
      wrongStreakStore.clear();
      setQuestions([]);
    }
  };

  // 获取题库名称
  const getBankName = (bankId?: string) => {
    if (!bankId) return '未知题库';
    return banks.find(b => b.id === bankId)?.name || '未知题库';
  };

  if (isLoading || !hasHydrated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[970px] mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl">
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
                </Button>
              </Link>
              <h1 className="text-base font-semibold text-slate-700">错题本</h1>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleReset}
              className="text-red-500 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              清空
            </Button>
          </div>
        </div>
      </header>

      {/* 筛选栏 */}
      <div className="max-w-[970px] mx-auto px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Select value={filterBankId} onValueChange={setFilterBankId}>
            <SelectTrigger className="w-auto min-w-[120px] h-9 bg-white border-slate-200 rounded-xl">
              <Filter className="w-4 h-4 mr-1.5 text-slate-400" />
              <SelectValue placeholder="筛选题库" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部题库</SelectItem>
              {banks.map(bank => (
                <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as 'time' | 'count')}>
            <TabsList className="bg-white border border-slate-200 h-9">
              <TabsTrigger value="time" className="text-xs rounded-lg">最近错题</TabsTrigger>
              <TabsTrigger value="count" className="text-xs rounded-lg">错误次数</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* 错题列表 */}
      <main className="max-w-[970px] mx-auto px-4 pb-6">
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-base font-medium text-slate-700 mb-1">太棒了！</h3>
            <p className="text-sm text-slate-400">目前没有错题，继续保持！</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredQuestions.map((question) => (
              <Card 
                key={question.id} 
                className="border-0 shadow-sm rounded-xl bg-white cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setSelectedQuestion(question);
                  setShowAnswer(false);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-600 border-0">
                          错 {question.wrongCount} 次
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {getBankName(question.bankId)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 line-clamp-2">
                        <RichTextWithBreaks content={question.content} />
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* 题目详情弹窗 */}
      <Dialog open={!!selectedQuestion} onOpenChange={() => setSelectedQuestion(null)}>
        <DialogContent className="max-w-[600px] max-h-[80vh] overflow-y-auto p-0 gap-0">
          {selectedQuestion && (
            <>
              <DialogHeader className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={`
                      ${selectedQuestion.type === 'single' ? 'bg-indigo-50 text-indigo-600' : ''}
                      ${selectedQuestion.type === 'multiple' ? 'bg-purple-50 text-purple-600' : ''}
                      ${selectedQuestion.type === 'true-false' ? 'bg-cyan-50 text-cyan-600' : ''}
                      ${selectedQuestion.type === 'fill-blank' ? 'bg-teal-50 text-teal-600' : ''}
                      border-0
                    `}>
                      {selectedQuestion.type === 'single' && '单选'}
                      {selectedQuestion.type === 'multiple' && '多选'}
                      {selectedQuestion.type === 'true-false' && '判断'}
                      {selectedQuestion.type === 'fill-blank' && '填空'}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {getBankName(selectedQuestion.bankId)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(selectedQuestion.id)}
                    className="text-red-500 hover:text-red-600 h-8"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </DialogHeader>

              <div className="p-4 space-y-4">
                {/* 题目内容 */}
                <div className="text-slate-800 leading-relaxed">
                  <RichTextWithBreaks content={selectedQuestion.content} />
                </div>

                {/* 选项 */}
                {selectedQuestion.options && selectedQuestion.options.length > 0 && (
                  <div className="space-y-2">
                    {selectedQuestion.options.map((opt) => (
                      <div
                        key={opt.id}
                        className={`p-3 rounded-xl border ${
                          selectedQuestion.answer === opt.id ||
                          (Array.isArray(selectedQuestion.answer) && selectedQuestion.answer.includes(opt.id))
                            ? 'bg-green-50 border-green-200'
                            : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                            selectedQuestion.answer === opt.id ||
                            (Array.isArray(selectedQuestion.answer) && selectedQuestion.answer.includes(opt.id))
                              ? 'bg-green-500 text-white'
                              : 'bg-white text-slate-600'
                          }`}>
                            {opt.id}
                          </span>
                          <span className="text-sm text-slate-700">
                            <RichTextWithBreaks content={opt.text} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 答案和解析 */}
                {showAnswer ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-amber-700">答案：</span>
                      <span className="text-sm font-medium text-amber-800">
                        {Array.isArray(selectedQuestion.answer) 
                          ? selectedQuestion.answer.join(', ') 
                          : selectedQuestion.answer}
                      </span>
                    </div>
                    {selectedQuestion.explanation && (
                      <div>
                        <span className="text-xs font-medium text-amber-700">解析：</span>
                        <p className="text-sm text-amber-800 mt-1">
                          <RichTextWithBreaks content={selectedQuestion.explanation} />
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    onClick={() => setShowAnswer(true)}
                    className="w-full bg-indigo-500 hover:bg-indigo-600 rounded-xl"
                  >
                    查看答案
                  </Button>
                )}
              </div>

              {/* 底部操作 */}
              <div className="p-4 border-t border-slate-100 flex gap-2">
                <Link 
                  href={`/practice?bankId=${selectedQuestion.bankId}&mode=wrong`}
                  className="flex-1"
                >
                  <Button className="w-full bg-indigo-500 hover:bg-indigo-600 rounded-xl">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    去重练
                  </Button>
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
