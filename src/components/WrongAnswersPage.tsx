'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Star, 
  BookOpen, 
  Check, 
  X, 
  Brain, 
  Clock, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Target,
  Flame,
  Zap
} from 'lucide-react';
import { questionStore, recordStore, wrongStatsStore, generateId } from '@/lib/quiz-store';
import { Question, WrongQuestionStats, PracticeRecord } from '@/lib/types';

interface WrongAnswersPageProps {
  onBack: () => void;
}

const MEMORY_CONFIG = {
  forgot: { label: '未掌握', color: 'bg-red-100 text-red-700 border-red-200', icon: X, progress: 0 },
  learning: { label: '学习中', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: RefreshCw, progress: 50 },
  mastered: { label: '已掌握', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Check, progress: 100 },
};

export default function WrongAnswersPage({ onBack }: WrongAnswersPageProps) {
  const [wrongStats, setWrongStats] = useState<WrongQuestionStats[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[] | null>(null);

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
    
    // 合并数据：从 recordStore 获取错题列表，从 wrongStatsStore 获取记忆状态
    const mergedStats: WrongQuestionStats[] = Array.from(wrongQuestionIds).map(questionId => {
      // 查找已有的记忆状态
      const existingStat = allWrongStats.find(s => s.questionId === questionId);
      
      // 计算该题的错误次数和正确次数
      const questionRecords = allRecords.filter(r => r.questionId === questionId);
      const wrongCount = questionRecords.filter(r => !r.isCorrect).length;
      const correctCount = questionRecords.filter(r => r.isCorrect).length;
      const lastWrongRecord = questionRecords.filter(r => !r.isCorrect).pop();
      
      return existingStat || {
        questionId,
        wrongCount,
        correctCount,
        memoryLevel: 'forgot' as const,
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

  // 当前时间（用于判断是否需要复习）- 使用 useMemo 避免 ESLint 警告
  const now = useMemo(() => Date.now(), []);

  // 获取错题对应的题目
  const getWrongQuestion = (stat: WrongQuestionStats): Question | undefined => {
    return questions.find(q => q.id === stat.questionId);
  };

  // 获取统计摘要
  const summary = {
    total: wrongStats.length,
    forgot: wrongStats.filter(s => s.memoryLevel === 'forgot').length,
    learning: wrongStats.filter(s => s.memoryLevel === 'learning').length,
    mastered: wrongStats.filter(s => s.memoryLevel === 'mastered').length,
    dueReview: wrongStats.filter(s => s.nextReview <= now).length,
  };

  // 记忆掌握率
  const masteryRate = summary.total > 0 
    ? Math.round((summary.mastered / summary.total) * 100) 
    : 0;

  // 筛选错题
  const filterStats = (stats: WrongQuestionStats[], filter: string): WrongQuestionStats[] => {
    switch (filter) {
      case 'review':
        return stats.filter(s => s.nextReview <= now);
      case 'forgot':
        return stats.filter(s => s.memoryLevel === 'forgot');
      case 'learning':
        return stats.filter(s => s.memoryLevel === 'learning');
      case 'mastered':
        return stats.filter(s => s.memoryLevel === 'mastered');
      default:
        return stats;
    }
  };

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

  // 处理答题结果
  const handleAnswer = (isCorrect: boolean) => {
    if (!reviewingId) return;
    
    // 记录答题
    const question = questions.find(q => q.id === reviewingId);
    if (question) {
      const record: PracticeRecord = {
        id: generateId(),
        questionId: question.id,
        isCorrect,
        selectedAnswer: selectedAnswer || '',
        timestamp: Date.now(),
      };
      recordStore.add(record);
      
      // 更新错题记忆状态
      wrongStatsStore.updateResult(
        question.id, 
        isCorrect, 
        !isCorrect ? selectedAnswer : undefined
      );
    }
    
    loadData();
    setShowAnswer(false);
    setSelectedAnswer(null);
    setReviewingId(null);
  };

  // 渲染单个错题卡片
  const renderWrongCard = (stat: WrongQuestionStats) => {
    const question = getWrongQuestion(stat);
    if (!question) return null;

    const config = MEMORY_CONFIG[stat.memoryLevel];
    const MemoryIcon = config.icon;

    return (
      <Card 
        key={stat.questionId}
        className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:border-blue-200"
        onClick={() => {
          setReviewingId(stat.questionId);
          setShowAnswer(false);
          setSelectedAnswer(null);
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* 标签行 */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge className={config.color} variant="outline">
                  <MemoryIcon className="w-3 h-3 mr-1" />
                  {config.label}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {question.type === 'single' ? '单选' :
                   question.type === 'multiple' ? '多选' :
                   question.type === 'true-false' ? '判断' : '填空'}
                </Badge>
                <span className="text-xs text-gray-400">
                  错{stat.wrongCount}次·对{stat.correctCount}次
                </span>
              </div>
              
              {/* 题目内容 */}
              <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                {question.content}
              </p>
              
              {/* 进度条 */}
              <div className="flex items-center gap-2">
                <Progress 
                  value={config.progress} 
                  className="flex-1 h-1.5"
                />
                <span className="text-xs text-gray-400">
                  {config.progress}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // 渲染复习模式
  const renderReviewMode = () => {
    const question = questions.find(q => q.id === reviewingId);
    const stat = wrongStats.find(s => s.questionId === reviewingId);
    if (!question || !stat) return null;

    const isCorrect = selectedAnswer !== null && checkAnswer(question, selectedAnswer);

    return (
      <div className="fixed inset-0 bg-white z-50 overflow-auto">
        {/* 顶部导航 */}
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => {
              setReviewingId(null);
              setShowAnswer(false);
              setSelectedAnswer(null);
            }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="font-semibold">复习错题</h2>
              <p className="text-xs text-gray-500">
                错{stat.wrongCount}次 · 对{stat.correctCount}次
              </p>
            </div>
          </div>
          <Badge className={MEMORY_CONFIG[stat.memoryLevel].color}>
            {MEMORY_CONFIG[stat.memoryLevel].label}
          </Badge>
        </div>

        <div className="max-w-2xl mx-auto p-4 space-y-4">
          {/* 题目内容 */}
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <p className="text-lg font-medium leading-relaxed">
                {question.content}
              </p>
            </CardContent>
          </Card>

          {/* 选项 */}
          {question.options && question.options.length > 0 && !showAnswer && (
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
                        if (isSelected) {
                          setSelectedAnswer(current.filter(id => id !== opt.id));
                        } else {
                          setSelectedAnswer([...current, opt.id]);
                        }
                      } else {
                        setSelectedAnswer(opt.id);
                      }
                    }}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {opt.id.toUpperCase()}
                      </span>
                      <span className="flex-1">{opt.text}</span>
                      {isSelected && <Check className="w-5 h-5 text-blue-500" />}
                    </div>
                  </button>
                );
              })}
              <p className="text-xs text-gray-400 text-center py-2">
                {question.type === 'multiple' ? '点击选择多个答案' : '点击选择答案'}
              </p>
            </div>
          )}

          {/* 操作按钮 */}
          {!showAnswer && (
            <div className="flex gap-3 pt-4">
              <Button 
                className="flex-1" 
                disabled={selectedAnswer === null}
                onClick={() => setShowAnswer(true)}
              >
                确认答案
              </Button>
            </div>
          )}

          {/* 答案揭示 */}
          {showAnswer && (
            <div className="space-y-4">
              {/* 正确/错误提示 */}
              <div className={`p-4 rounded-xl ${isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-3">
                  {isCorrect ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-emerald-700">回答正确</h3>
                        <p className="text-sm text-emerald-600">
                          继续保持，下次遇到也能答对！
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
                        <X className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-red-700">回答错误</h3>
                        <p className="text-sm text-red-600">
                          记得加强这个知识点的记忆
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 正确答案 */}
              <Card className="border-l-4 border-l-emerald-500">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-emerald-500" />
                    <span className="font-medium text-emerald-700">正确答案</span>
                  </div>
                  <p className="text-lg font-semibold">
                    {Array.isArray(question.answer) 
                      ? question.answer.map(a => a.toUpperCase()).join(', ')
                      : question.answer.toUpperCase()}
                  </p>
                  {question.options && (
                    <p className="text-sm text-gray-600 mt-2">
                      {question.options.find(o => o.id === question.answer)?.text || ''}
                      {Array.isArray(question.answer) && question.answer.map(a => {
                        const opt = question.options?.find(o => o.id === a);
                        return opt ? `${opt.text} ` : '';
                      })}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* 解析 */}
              {question.explanation && (
                <Card className="border-l-4 border-l-amber-500">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-5 h-5 text-amber-500" />
                      <span className="font-medium text-amber-700">解析</span>
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                      {question.explanation}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* 记忆反馈 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  这道题下次什么时候复习？
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={isCorrect ? 'outline' : 'default'}
                    size="sm"
                    className={isCorrect ? 'bg-emerald-500 text-white hover:bg-emerald-600' : ''}
                    onClick={() => handleAnswer(true)}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    记住了
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={isCorrect ? '' : 'bg-amber-500 text-white hover:bg-amber-600'}
                    onClick={() => handleAnswer(false)}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    再记一下
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      wrongStatsStore.reset(question.id);
                      loadData();
                      setReviewingId(null);
                      setShowAnswer(false);
                      setSelectedAnswer(null);
                    }}
                  >
                    <X className="w-4 h-4 mr-1" />
                    移除
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 复习模式
  if (reviewingId) {
    return renderReviewMode();
  }

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Star className="w-6 h-6 text-orange-500" />
          错题本
          {summary.total > 0 && (
            <Badge variant="secondary" className="ml-2">
              {summary.total} 道
            </Badge>
          )}
        </h2>
      </div>

      {summary.total === 0 ? (
        /* 空状态 */
        <Card className="border-2 border-dashed">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 flex items-center justify-center">
              <Star className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              暂无错题
            </h3>
            <p className="text-gray-500">
              做错的题目会自动记录到这里，加油！
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.total}</p>
                    <p className="text-xs text-gray-500">错题总数</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.dueReview}</p>
                    <p className="text-xs text-gray-500">待复习</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Target className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{masteryRate}%</p>
                    <p className="text-xs text-gray-500">掌握率</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Flame className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.mastered}</p>
                    <p className="text-xs text-gray-500">已掌握</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 整体进度 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">整体掌握进度</span>
                <span className="text-sm text-gray-500">{masteryRate}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${masteryRate}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>未掌握 {summary.forgot}</span>
                <span>学习中 {summary.learning}</span>
                <span>已掌握 {summary.mastered}</span>
              </div>
            </CardContent>
          </Card>

          {/* 错题列表 */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all" className="text-xs">
                全部 {summary.total}
              </TabsTrigger>
              <TabsTrigger value="review" className="text-xs">
                待复习 {summary.dueReview}
              </TabsTrigger>
              <TabsTrigger value="forgot" className="text-xs">
                未掌握 {summary.forgot}
              </TabsTrigger>
              <TabsTrigger value="learning" className="text-xs">
                学习中 {summary.learning}
              </TabsTrigger>
              <TabsTrigger value="mastered" className="text-xs">
                已掌握 {summary.mastered}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {filterStats(wrongStats, activeTab).length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    暂无相关错题
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filterStats(wrongStats, activeTab).map(stat => renderWrongCard(stat))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
