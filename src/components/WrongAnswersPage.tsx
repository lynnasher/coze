'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Star, 
  Check, 
  X, 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  Search,
  Brain,
  Trophy,
  BookOpen,
  FileText,
  Sparkles
} from 'lucide-react';
import { questionStore, recordStore, wrongStatsStore, generateId } from '@/lib/quiz-store';
import { Question, WrongQuestionStats } from '@/lib/types';

interface WrongAnswersPageProps {
  onBack: () => void;
}

const ITEMS_PER_PAGE = 8;

export default function WrongAnswersPage({ onBack }: WrongAnswersPageProps) {
  const [wrongStats, setWrongStats] = useState<WrongQuestionStats[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'forgot' | 'learning' | 'mastered'>('all');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[] | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // 加载数据
  const loadData = useCallback(() => {
    const allQuestions = questionStore.getAll();
    const allRecords = recordStore.getAll();
    const allWrongStats = wrongStatsStore.getAll();
    
    const wrongQuestionIds = new Set<string>();
    allRecords.forEach(record => {
      if (!record.isCorrect) wrongQuestionIds.add(record.questionId);
    });
    
    const mergedStats: WrongQuestionStats[] = Array.from(wrongQuestionIds).map(questionId => {
      const existingStat = allWrongStats.find(s => s.questionId === questionId);
      const questionRecords = allRecords.filter(r => r.questionId === questionId);
      const wrongCount = questionRecords.filter(r => !r.isCorrect).length;
      const correctCount = questionRecords.filter(r => r.isCorrect).length;
      const lastWrongRecord = questionRecords.filter(r => !r.isCorrect).pop();
      
      return existingStat || {
        questionId,
        wrongCount,
        correctCount,
        memoryLevel: 'forgot',
        lastReviewed: lastWrongRecord?.timestamp || Date.now(),
        nextReview: Date.now(),
        lastWrongAnswer: lastWrongRecord?.selectedAnswer || '',
      };
    });
    
    setQuestions(allQuestions);
    setWrongStats(mergedStats);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 过滤
  const filteredStats = useMemo(() => {
    let result = wrongStats;
    if (filterStatus !== 'all') result = result.filter(s => s.memoryLevel === filterStatus);
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase();
      result = result.filter(s => questions.find(q => q.id === s.questionId)?.content.toLowerCase().includes(kw));
    }
    return result;
  }, [wrongStats, filterStatus, searchKeyword, questions]);

  const totalPages = Math.ceil(filteredStats.length / ITEMS_PER_PAGE);
  const paginatedStats = filteredStats.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // 统计
  const stats = useMemo(() => ({
    total: wrongStats.length,
    forgot: wrongStats.filter(s => s.memoryLevel === 'forgot').length,
    learning: wrongStats.filter(s => s.memoryLevel === 'learning').length,
    mastered: wrongStats.filter(s => s.memoryLevel === 'mastered').length,
  }), [wrongStats]);

  const getQuestion = (id: string) => questions.find(q => q.id === id);

  // 答题
  const checkAnswer = (q: Question, ans: string | string[] | null): boolean => {
    if (!ans) return false;
    if (Array.isArray(q.answer)) {
      if (!Array.isArray(ans)) return false;
      return q.answer.length === ans.length && q.answer.every(a => ans.includes(a));
    }
    if (Array.isArray(ans)) return ans.length === 1 && ans[0] === q.answer;
    return ans === q.answer;
  };

  const handleSubmit = () => {
    if (!reviewingId) return;
    const q = getQuestion(reviewingId);
    if (!q) return;
    const correct = checkAnswer(q, selectedAnswer);
    setIsCorrect(correct);
    setShowResult(true);
    recordStore.add({ id: generateId(), questionId: q.id, isCorrect: correct, selectedAnswer: selectedAnswer || '', timestamp: Date.now() });
    wrongStatsStore.updateResult(q.id, correct, !correct && selectedAnswer !== null ? selectedAnswer : undefined);
    loadData();
  };

  const handleFeedback = (keep: boolean) => {
    if (!reviewingId) return;
    const q = getQuestion(reviewingId);
    if (!q) return;
    if (keep) {
      wrongStatsStore.updateResult(q.id, true, undefined);
    } else {
      wrongStatsStore.reset(q.id);
    }
    loadData();
    setReviewingId(null);
    setSelectedAnswer(null);
    setShowResult(false);
    setIsCorrect(null);
  };

  // 渲染选项样式
  const getOptionStyle = (isSelected: boolean, isCorrectAnswer: boolean, showResult: boolean) => {
    if (showResult) {
      if (isSelected && isCorrectAnswer) return 'border-emerald-400 bg-emerald-50 shadow-md';
      if (isSelected && !isCorrectAnswer) return 'border-red-400 bg-red-50 shadow-md';
      if (isCorrectAnswer) return 'border-emerald-300 bg-emerald-25';
    }
    if (isSelected) return 'border-orange-400 bg-orange-50 shadow-lg shadow-orange-100';
    return 'border-gray-200 bg-white hover:border-orange-200 hover:shadow-md';
  };

  // 复习界面
  if (reviewingId) {
    const q = getQuestion(reviewingId);
    const stat = wrongStats.find(s => s.questionId === reviewingId);
    if (!q || !stat) { setReviewingId(null); return null; }

    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-white">
        {/* 顶部导航 */}
        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 text-white px-4 py-4 sticky top-0 z-20 rounded-b-3xl shadow-xl">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setReviewingId(null); setShowResult(false); setSelectedAnswer(null); setIsCorrect(null); }}
              className="text-white hover:bg-white/20 rounded-xl px-3"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="text-center flex-1">
              <h2 className="text-base font-semibold">错题复习</h2>
            </div>
            <Badge className={isCorrect === true ? 'bg-emerald-500' : isCorrect === false ? 'bg-red-500' : 'bg-white/30 text-white'}>
              {isCorrect === true ? '正确' : isCorrect === false ? '错误' : '答题中'}
            </Badge>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
          {/* 状态标签 */}
          <div className="flex items-center justify-center gap-3">
            <Badge className={`px-4 py-1.5 rounded-full text-sm font-medium ${
              stat.memoryLevel === 'mastered' ? 'bg-emerald-100 text-emerald-700' :
              stat.memoryLevel === 'learning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            }`}>
              {stat.memoryLevel === 'mastered' ? '✓ 已掌握' : stat.memoryLevel === 'learning' ? '学习中' : '未掌握'}
            </Badge>
            <span className="text-sm text-gray-400">错{stat.wrongCount} · 对{stat.correctCount}</span>
          </div>

          {/* 题目 */}
          <div className="bg-white rounded-2xl p-5 shadow-lg shadow-gray-100">
            <p className="text-lg leading-relaxed text-gray-800 font-medium">{q.content}</p>
          </div>

          {/* 选项 */}
          {!showResult && q.options && q.options.length > 0 && (
            <div className="space-y-3">
              {q.options.map((opt) => {
                const sel = Array.isArray(selectedAnswer) ? selectedAnswer.includes(opt.id) : selectedAnswer === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => {
                      if (q.type === 'multiple') {
                        setSelectedAnswer(sel ? (selectedAnswer as string[]).filter(id => id !== opt.id) : [...(Array.isArray(selectedAnswer) ? selectedAnswer : []), opt.id]);
                      } else {
                        setSelectedAnswer(opt.id);
                      }
                    }}
                    className={`flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${getOptionStyle(sel, false, false)}`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 font-bold text-lg transition-colors ${
                      sel ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {sel ? <Check className="w-6 h-6" /> : opt.id.toUpperCase()}
                    </div>
                    <span className="flex-1 text-base font-medium">{opt.text}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 结果 */}
          {showResult && (
            <div className="space-y-4">
              <div className={`rounded-2xl p-5 ${isCorrect ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200' : 'bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isCorrect ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    {isCorrect ? <Check className="w-8 h-8 text-white" /> : <X className="w-8 h-8 text-white" />}
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold ${isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                      {isCorrect ? '太棒了！' : '再接再厉！'}
                    </h3>
                    <p className="text-sm text-gray-500">{isCorrect ? '继续保持，好记性！' : '别灰心，继续努力！'}</p>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">正确答案</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {Array.isArray(q.answer) ? q.answer.map(a => a.toUpperCase()).join(', ') : q.answer.toUpperCase()}
                  </p>
                </div>

                {q.explanation && (
                  <div className="bg-amber-50 rounded-xl p-4 mt-3 border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-5 h-5 text-amber-600" />
                      <span className="font-semibold text-sm text-amber-800">解析</span>
                    </div>
                    <p className="text-sm text-amber-900 leading-relaxed">{q.explanation}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button 
                  className={`flex-1 h-12 rounded-xl text-base font-semibold ${isCorrect ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600' : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600'} text-white shadow-lg`}
                  onClick={() => handleFeedback(true)}
                >
                  <Check className="w-5 h-5 mr-2" />
                  {isCorrect ? '继续努力' : '记住了'}
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 h-12 rounded-xl text-base border-2"
                  onClick={() => handleFeedback(false)}
                >
                  <Trash2 className="w-5 h-5 mr-2" />
                  移除
                </Button>
              </div>
            </div>
          )}

          {/* 提交 */}
          {!showResult && (
            <Button 
              className="w-full h-14 rounded-2xl text-lg font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-200 disabled:opacity-50"
              disabled={selectedAnswer === null}
              onClick={handleSubmit}
            >
              检查答案
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 主列表
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-white">
      {/* 顶部导航 */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 text-white px-4 py-4 sticky top-0 z-20 rounded-b-3xl shadow-xl">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-white hover:bg-white/20 rounded-xl px-3"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <img 
              src="https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2Fimage.png&nonce=bc2e0f4c-de39-48cf-9d38-20a43bfc7403&project_id=7627388236024889398&sign=825d4212b0c347b0fa3190a3c738f8d9a0e3439cb0e9b73425ec607230854602" 
              alt="Logo" 
              className="w-8 h-8 rounded-xl object-contain"
            />
            <div>
              <h1 className="text-base font-bold">错题本</h1>
              <p className="text-xs text-white/70">共 {stats.total} 道错题</p>
            </div>
          </div>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* 搜索 */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="搜索错题..."
            value={searchKeyword}
            onChange={(e) => { setSearchKeyword(e.target.value); setCurrentPage(1); }}
            className="pl-12 h-12 rounded-xl bg-white border-gray-200 focus:ring-2 focus:ring-orange-200 shadow-sm"
          />
        </div>

        {stats.total === 0 ? (
          /* 空状态 */
          <Card className="border-0 shadow-lg rounded-2xl">
            <CardContent className="pt-10 pb-10 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center">
                <Trophy className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">太棒了！</h2>
              <p className="text-gray-500">暂无错题，继续保持！</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 统计卡片 */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-red-100 to-pink-100 flex items-center justify-center">
                    <X className="w-6 h-6 text-red-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{stats.forgot}</p>
                  <p className="text-xs text-gray-400">未掌握</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-amber-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{stats.learning}</p>
                  <p className="text-xs text-gray-400">学习中</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{stats.mastered}</p>
                  <p className="text-xs text-gray-400">已掌握</p>
                </CardContent>
              </Card>
            </div>

            {/* 筛选标签 */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { key: 'all', label: '全部', count: stats.total, color: 'from-gray-500 to-gray-600' },
                { key: 'forgot', label: '未掌握', count: stats.forgot, color: 'from-red-500 to-pink-500' },
                { key: 'learning', label: '学习中', count: stats.learning, color: 'from-amber-500 to-orange-500' },
                { key: 'mastered', label: '已掌握', count: stats.mastered, color: 'from-emerald-500 to-teal-500' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setFilterStatus(tab.key as typeof filterStatus); setCurrentPage(1); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    filterStatus === tab.key 
                      ? `bg-gradient-to-r ${tab.color} text-white shadow-lg` 
                      : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm border border-gray-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <Badge variant="secondary" className={`ml-1 rounded-full text-xs ${filterStatus === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {tab.count}
                  </Badge>
                </button>
              ))}
            </div>

            {/* 列表 */}
            <div className="space-y-3">
              {paginatedStats.map((stat, idx) => {
                const q = getQuestion(stat.questionId);
                if (!q) return null;
                const num = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                
                return (
                  <Card
                    key={stat.questionId}
                    className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all cursor-pointer group"
                    onClick={() => { setReviewingId(stat.questionId); setShowResult(false); setSelectedAnswer(null); setIsCorrect(null); }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* 序号 */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0 ${
                          stat.memoryLevel === 'mastered' ? 'bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600' :
                          stat.memoryLevel === 'learning' ? 'bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600' : 'bg-gradient-to-br from-red-100 to-pink-100 text-red-600'
                        }`}>
                          {num}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 line-clamp-2 leading-relaxed mb-2">{q.content}</p>
                          <div className="flex items-center gap-2">
                            <Badge className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              stat.memoryLevel === 'mastered' ? 'bg-emerald-100 text-emerald-700' :
                              stat.memoryLevel === 'learning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {stat.memoryLevel === 'mastered' ? '✓ 已掌握' : stat.memoryLevel === 'learning' ? '学习中' : '未掌握'}
                            </Badge>
                            <span className="text-xs text-gray-400">
                              错{stat.wrongCount} · 对{stat.correctCount}
                            </span>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl hover:bg-red-50 flex-shrink-0"
                          onClick={(e) => { e.stopPropagation(); wrongStatsStore.reset(stat.questionId); loadData(); }}
                        >
                          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between py-4">
                <p className="text-sm text-gray-500">
                  第 {currentPage} / {totalPages} 页
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-gray-200"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-gray-200"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    下一页
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
