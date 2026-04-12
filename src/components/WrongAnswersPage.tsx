'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Star, 
  Check, 
  X, 
  Brain,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  Search
} from 'lucide-react';
import { questionStore, recordStore, wrongStatsStore, generateId } from '@/lib/quiz-store';
import { Question, WrongQuestionStats } from '@/lib/types';

interface WrongAnswersPageProps {
  onBack: () => void;
}

const MEMORY_CONFIG = {
  forgot: { label: '未掌握', color: 'bg-red-500 text-white', icon: X },
  learning: { label: '学习中', color: 'bg-amber-500 text-white', icon: RefreshCw },
  mastered: { label: '已掌握', color: 'bg-emerald-500 text-white', icon: Check },
};

const ITEMS_PER_PAGE = 10;

export default function WrongAnswersPage({ onBack }: WrongAnswersPageProps) {
  const [wrongStats, setWrongStats] = useState<WrongQuestionStats[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'forgot' | 'learning' | 'mastered'>('all');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[] | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // 加载数据
  const loadData = useCallback(() => {
    const allQuestions = questionStore.getAll();
    const allRecords = recordStore.getAll();
    const allWrongStats = wrongStatsStore.getAll();
    
    // 从 recordStore 获取所有答错的题目ID
    const wrongQuestionIds = new Set<string>();
    allRecords.forEach(record => {
      if (!record.isCorrect) {
        wrongQuestionIds.add(record.questionId);
      }
    });
    
    // 合并数据
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 过滤和搜索
  const filteredStats = useMemo(() => {
    let result = wrongStats;
    
    // 按状态过滤
    if (filterStatus !== 'all') {
      result = result.filter(s => s.memoryLevel === filterStatus);
    }
    
    // 搜索
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      result = result.filter(s => {
        const q = questions.find(q => q.id === s.questionId);
        return q?.content.toLowerCase().includes(keyword);
      });
    }
    
    return result;
  }, [wrongStats, filterStatus, searchKeyword, questions]);

  // 分页
  const totalPages = Math.ceil(filteredStats.length / ITEMS_PER_PAGE);
  const paginatedStats = filteredStats.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // 统计
  const stats = useMemo(() => ({
    total: wrongStats.length,
    forgot: wrongStats.filter(s => s.memoryLevel === 'forgot').length,
    learning: wrongStats.filter(s => s.memoryLevel === 'learning').length,
    mastered: wrongStats.filter(s => s.memoryLevel === 'mastered').length,
  }), [wrongStats]);

  // 获取题目
  const getQuestion = (questionId: string) => questions.find(q => q.id === questionId);

  // 检查答案
  const checkAnswer = (question: Question, selected: string | string[] | null): boolean => {
    if (!selected) return false;
    if (Array.isArray(question.answer)) {
      if (Array.isArray(selected)) {
        return question.answer.length === selected.length &&
          question.answer.every(a => selected.includes(a));
      }
      return false;
    }
    if (Array.isArray(selected)) {
      return selected.length === 1 && selected[0] === question.answer;
    }
    return selected === question.answer;
  };

  // 提交答案
  const handleSubmit = () => {
    if (!reviewingId) return;
    const question = getQuestion(reviewingId);
    if (!question) return;

    const correct = checkAnswer(question, selectedAnswer);
    setIsCorrect(correct);

    // 记录并更新
    const record = {
      id: generateId(),
      questionId: question.id,
      isCorrect: correct,
      selectedAnswer: selectedAnswer || '',
      timestamp: Date.now(),
    };
    recordStore.add(record);
    wrongStatsStore.updateResult(question.id, correct, !correct ? selectedAnswer : undefined);
    loadData();
  };

  // 移除错题
  const handleRemove = (questionId: string) => {
    if (confirm('确定移除这道错题？')) {
      wrongStatsStore.reset(questionId);
      loadData();
    }
  };

  // 复习模式
  if (reviewingId) {
    const question = getQuestion(reviewingId);
    const stat = wrongStats.find(s => s.questionId === reviewingId);
    
    if (!question || !stat) {
      setReviewingId(null);
      return null;
    }

    return (
      <div className="min-h-screen bg-gray-50">
        {/* 顶部 */}
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => {
              setReviewingId(null);
              setShowAnswer(false);
              setSelectedAnswer(null);
              setIsCorrect(null);
            }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <p className="text-sm font-medium">复习错题</p>
              <p className="text-xs text-gray-500">
                错{stat.wrongCount}次 · 对{stat.correctCount}次
              </p>
            </div>
          </div>
          <Badge className={MEMORY_CONFIG[stat.memoryLevel].color}>
            {MEMORY_CONFIG[stat.memoryLevel].label}
          </Badge>
        </div>

        <div className="max-w-xl mx-auto p-4 space-y-4">
          {/* 题干 */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-base leading-relaxed">{question.content}</p>
          </div>

          {/* 选项 */}
          {!showAnswer && question.options && question.options.length > 0 && (
            <div className="space-y-2">
              {question.options.map((opt) => {
                const isSelected = Array.isArray(selectedAnswer) 
                  ? selectedAnswer.includes(opt.id)
                  : selectedAnswer === opt.id;

                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      if (question.type === 'multiple') {
                        const current = Array.isArray(selectedAnswer) ? selectedAnswer : [];
                        setSelectedAnswer(isSelected 
                          ? current.filter(id => id !== opt.id)
                          : [...current, opt.id]
                        );
                      } else {
                        setSelectedAnswer(opt.id);
                      }
                    }}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-blue-200'
                    }`}
                  >
                    <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center mr-2 text-sm font-medium ${
                      isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100'
                    }`}>
                      {opt.id.toUpperCase()}
                    </span>
                    {opt.text}
                  </button>
                );
              })}
            </div>
          )}

          {/* 答案揭示 */}
          {showAnswer && isCorrect !== null && (
            <div className="space-y-3">
              <div className={`p-4 rounded-lg ${isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2">
                  {isCorrect ? (
                    <>
                      <Check className="w-5 h-5 text-emerald-600" />
                      <span className="font-medium text-emerald-700">回答正确</span>
                    </>
                  ) : (
                    <>
                      <X className="w-5 h-5 text-red-600" />
                      <span className="font-medium text-red-700">回答错误</span>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">正确答案</p>
                <p className="font-semibold text-emerald-600">
                  {Array.isArray(question.answer) 
                    ? question.answer.map(a => a.toUpperCase()).join(', ')
                    : question.answer.toUpperCase()}
                </p>
              </div>

              {question.explanation && (
                <div className="bg-amber-50 rounded-lg p-4">
                  <p className="text-sm text-amber-800 leading-relaxed">{question.explanation}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button 
                  className="flex-1" 
                  variant={isCorrect ? 'outline' : 'default'}
                  onClick={handleSubmit}
                >
                  <Check className="w-4 h-4 mr-1" />
                  {isCorrect ? '已掌握' : '再记一下'}
                </Button>
                <Button variant="outline" onClick={() => handleRemove(question.id)}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  移除
                </Button>
              </div>
            </div>
          )}

          {/* 提交按钮 */}
          {!showAnswer && (
            <Button 
              className="w-full" 
              disabled={selectedAnswer === null}
              onClick={() => {
                handleSubmit();
                setShowAnswer(true);
              }}
            >
              确认答案
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 主列表
  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-semibold">错题本</h2>
        </div>
        <Badge variant="secondary" className="ml-auto">
          {stats.total} 道
        </Badge>
      </div>

      {stats.total === 0 ? (
        /* 空状态 */
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-orange-100 flex items-center justify-center">
              <Star className="w-6 h-6 text-orange-500" />
            </div>
            <p className="text-gray-500">暂无错题记录</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 统计行 */}
          <div className="flex gap-2 text-xs">
            <Badge variant={filterStatus === 'forgot' ? 'default' : 'outline'} 
              className={`cursor-pointer ${filterStatus === 'forgot' ? 'bg-red-500' : ''}`}
              onClick={() => { setFilterStatus('forgot'); setCurrentPage(1); }}>
              未掌握 {stats.forgot}
            </Badge>
            <Badge variant={filterStatus === 'learning' ? 'default' : 'outline'}
              className={`cursor-pointer ${filterStatus === 'learning' ? 'bg-amber-500' : ''}`}
              onClick={() => { setFilterStatus('learning'); setCurrentPage(1); }}>
              学习中 {stats.learning}
            </Badge>
            <Badge variant={filterStatus === 'mastered' ? 'default' : 'outline'}
              className={`cursor-pointer ${filterStatus === 'mastered' ? 'bg-emerald-500' : ''}`}
              onClick={() => { setFilterStatus('mastered'); setCurrentPage(1); }}>
              已掌握 {stats.mastered}
            </Badge>
          </div>

          {/* 搜索 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索错题..."
              value={searchKeyword}
              onChange={(e) => { setSearchKeyword(e.target.value); setCurrentPage(1); }}
              className="pl-9"
            />
          </div>

          {/* 列表 */}
          <div className="space-y-2">
            {paginatedStats.map((stat, idx) => {
              const question = getQuestion(stat.questionId);
              if (!question) return null;
              
              return (
                <Card 
                  key={stat.questionId}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    setReviewingId(stat.questionId);
                    setShowAnswer(false);
                    setSelectedAnswer(null);
                    setIsCorrect(null);
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <span className="text-sm text-gray-400 mt-0.5">
                        {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 line-clamp-2">{question.content}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <Badge className={`${MEMORY_CONFIG[stat.memoryLevel].color} text-xs`} variant="secondary">
                            {MEMORY_CONFIG[stat.memoryLevel].label}
                          </Badge>
                          <span>错{stat.wrongCount}</span>
                          <span>·</span>
                          <span>对{stat.correctCount}</span>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(stat.questionId);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">
                第 {currentPage} / {totalPages} 页，共 {filteredStats.length} 道
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
