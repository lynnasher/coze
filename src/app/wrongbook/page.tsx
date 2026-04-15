'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  BookOpen,
  Filter,
  RotateCcw,
  AlertCircle,
  Flame,
  Clock,
  Target,
  Star
} from 'lucide-react';
import { questionStore, recordStore, getWrongQuestionIds, generateId, wrongStreakStore } from '@/lib/quiz-store';
import { Question, QuestionType } from '@/lib/types';
import Link from 'next/link';

// 题型统计
interface QuestionTypeStat {
  type: QuestionType;
  label: string;
  count: number;
  color: string;
}

export default function WrongBookPage() {
  const [selectedType, setSelectedType] = useState<QuestionType | 'all'>('all');
  const [reviewMode, setReviewMode] = useState<'forgot' | 'byType' | 'all'>('forgot');
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewQuestions, setReviewQuestions] = useState<Question[]>([]);
  const [localAnswer, setLocalAnswer] = useState<string | string[] | undefined>(undefined);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(false);
  
  // 获取错题列表（只获取实际答过且答错的题目）
  const wrongQuestions = useMemo(() => {
    const records = recordStore.getAll();
    // 获取所有答过且答错的题目ID（排除空答题记录）
    const wrongQuestionIds = records
      .filter(r => {
        if (!r.isCorrect) {
          const answer = Array.isArray(r.selectedAnswer) ? r.selectedAnswer : String(r.selectedAnswer || '');
          return answer.length > 0;
        }
        return false;
      })
      .map(r => r.questionId);
    
    // 去重
    const uniqueIds = [...new Set(wrongQuestionIds)];
    
    // 过滤出在有效题库中的题目
    const allQuestions = questionStore.getAll();
    return uniqueIds
      .map(id => allQuestions.find(q => q.id === id))
      .filter((q): q is Question => q !== undefined);
  }, []);

  // 按题型分组统计
  const typeStats = useMemo((): QuestionTypeStat[] => {
    const stats: Record<string, { label: string; count: number; color: string }> = {
      'single': { label: '单选题', count: 0, color: 'bg-indigo-500' },
      'multiple': { label: '多选题', count: 0, color: 'bg-purple-500' },
      'true-false': { label: '判断题', count: 0, color: 'bg-cyan-500' },
      'fill-blank': { label: '填空题', count: 0, color: 'bg-teal-500' },
      'comprehensive': { label: '综合题', count: 0, color: 'bg-rose-500' },
    };
    
    wrongQuestions.forEach(q => {
      if (stats[q.type]) {
        stats[q.type].count++;
      }
    });
    
    return Object.entries(stats)
      .filter(([_, v]) => v.count > 0)
      .map(([key, v]) => ({
        type: key as QuestionType,
        label: v.label,
        count: v.count,
        color: v.color,
      }));
  }, [wrongQuestions]);

  // 根据筛选条件获取错题列表
  const filteredQuestions = useMemo(() => {
    let questions = [...wrongQuestions];
    
    // 按题型筛选
    if (selectedType !== 'all') {
      questions = questions.filter(q => q.type === selectedType);
    }
    
    // 按复习模式排序
    if (reviewMode === 'forgot') {
      // 优先显示错得多的、很久没复习的
      const streakStore = wrongStreakStore.getAll();
      questions.sort((a, b) => {
        const aStreak = streakStore[a.id] || 0;
        const bStreak = streakStore[b.id] || 0;
        const aRecords = recordStore.getAll().filter(r => r.questionId === a.id);
        const bRecords = recordStore.getAll().filter(r => r.questionId === b.id);
        const aWrong = aRecords.filter(r => !r.isCorrect).length;
        const bWrong = bRecords.filter(r => !r.isCorrect).length;
        const aLastWrong = aRecords.filter(r => !r.isCorrect).pop()?.timestamp || 0;
        const bLastWrong = bRecords.filter(r => !r.isCorrect).pop()?.timestamp || 0;
        
        // 优先级：错得多的 > 很久没对的
        if (Math.abs(aWrong - bWrong) > 1) return bWrong - aWrong;
        return aLastWrong - bLastWrong;
      });
    }
    
    return questions;
  }, [wrongQuestions, selectedType, reviewMode]);

  // 获取题目的错题信息
  const getWrongInfo = useCallback((questionId: string) => {
    const records = recordStore.getAll().filter(r => r.questionId === questionId);
    const wrongRecords = records.filter(r => !r.isCorrect);
    const correctRecords = records.filter(r => r.isCorrect);
    const streak = wrongStreakStore.getAll()[questionId] || 0;
    const lastWrong = wrongRecords.length > 0 ? wrongRecords[wrongRecords.length - 1].timestamp : 0;
    const daysAgo = Math.floor((Date.now() - lastWrong) / (1000 * 60 * 60 * 24));
    
    return {
      wrongCount: wrongRecords.length,
      correctCount: correctRecords.length,
      streak,
      lastWrong,
      daysAgo,
    };
  }, []);

  // 开始错题复习
  const startReview = useCallback((type?: QuestionType | 'all') => {
    let questions = [...wrongQuestions];
    
    if (type && type !== 'all') {
      questions = questions.filter(q => q.type === type);
    }
    
    if (questions.length === 0) return;
    
    setReviewQuestions(questions);
    setReviewIndex(0);
    setShowAnswer(false);
    setLocalAnswer(undefined);
    setIsReviewing(true);
  }, [wrongQuestions]);

  // 获取当前复习的题目
  const currentReviewQuestion = reviewQuestions[reviewIndex];

  // 处理答案选择
  const handleSelectAnswer = useCallback((answer: string) => {
    if (!currentReviewQuestion) return;
    setLocalAnswer(answer);
  }, [currentReviewQuestion]);

  // 检查答案是否正确
  const checkAnswer = useCallback((question: Question, answer: string | string[] | undefined): boolean => {
    if (!answer) return false;
    
    if (Array.isArray(question.answer)) {
      const userAnswers = Array.isArray(answer) ? answer : [answer];
      return userAnswers.length === question.answer.length && 
             userAnswers.every(a => question.answer.includes(a));
    }
    
    return answer === question.answer;
  }, []);

  // 提交答案
  const handleSubmitAnswer = useCallback(() => {
    if (currentReviewQuestion && localAnswer !== undefined) {
      const correct = checkAnswer(currentReviewQuestion, localAnswer);
      setIsAnswerCorrect(correct);
      setShowAnswer(true);
      
      // 记录答题结果
      const record = {
        id: generateId(),
        questionId: currentReviewQuestion.id,
        isCorrect: correct,
        selectedAnswer: localAnswer,
        timestamp: Date.now(),
      };
      recordStore.add(record);
      
      // 更新连续正确次数
      if (correct) {
        wrongStreakStore.increment(currentReviewQuestion.id);
        
        // 如果连续答对3次，从错题本移除
        const newStreak = wrongStreakStore.get(currentReviewQuestion.id);
        if (newStreak >= 3) {
          // 移除该题目的错题记录
          const records = recordStore.getAll().filter(r => !(r.questionId === currentReviewQuestion.id && !r.isCorrect));
          recordStore.save(records);
          wrongStreakStore.remove(currentReviewQuestion.id);
        }
      } else {
        // 答错了，重置连续正确次数
        wrongStreakStore.reset(currentReviewQuestion.id);
      }
    }
  }, [currentReviewQuestion, localAnswer, checkAnswer]);

  // 下一题
  const handleNext = useCallback(() => {
    if (reviewIndex < reviewQuestions.length - 1) {
      setReviewIndex(reviewIndex + 1);
      setShowAnswer(false);
      setLocalAnswer(undefined);
      setIsAnswerCorrect(false);
    } else {
      // 复习完成
      setIsReviewing(false);
    }
  }, [reviewIndex, reviewQuestions.length]);

  // 获取选项字母
  const getOptionLabel = (index: number) => {
    return String.fromCharCode(65 + index);
  };

  // 标记已掌握（直接移出错题本）
  const markAsMastered = useCallback((questionId: string) => {
    // 清空该题目的所有错题记录
    const records = recordStore.getAll().filter(r => !(r.questionId === questionId && !r.isCorrect));
    recordStore.save(records);
    // 清空该题目的连续正确次数
    wrongStreakStore.remove(questionId);
    // 刷新页面
    window.location.reload();
  }, []);

  // 题型标签颜色
  const getTypeColor = (type: QuestionType) => {
    const colors: Record<QuestionType, string> = {
      'single': 'bg-indigo-500',
      'multiple': 'bg-purple-500',
      'true-false': 'bg-cyan-500',
      'fill-blank': 'bg-teal-500',
      'comprehensive': 'bg-rose-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  const getTypeLabel = (type: QuestionType) => {
    const labels: Record<QuestionType, string> = {
      'single': '单选',
      'multiple': '多选',
      'true-false': '判断',
      'fill-blank': '填空',
      'comprehensive': '综合',
    };
    return labels[type] || type;
  };

  // 复习模式（答题页面）
  if (isReviewing && currentReviewQuestion) {
    const wrongInfo = getWrongInfo(currentReviewQuestion.id);
    
    return (
      <div className="min-h-screen bg-slate-50">
        {/* 顶部导航 */}
        <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsReviewing(false)}
              className="text-gray-600"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              退出
            </Button>
            <span className="text-sm text-gray-500">
              {reviewIndex + 1} / {reviewQuestions.length}
            </span>
            <div className={`px-2 py-0.5 rounded text-xs font-medium text-white ${getTypeColor(currentReviewQuestion.type)}`}>
              {getTypeLabel(currentReviewQuestion.type)}
            </div>
          </div>
          
          {/* 进度条 */}
          <div className="h-1 bg-gray-100">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
              style={{ width: `${((reviewIndex + 1) / reviewQuestions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* 错题信息 */}
          <div className="bg-amber-50 rounded-xl p-3 mb-4 flex items-center gap-3 text-sm text-amber-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>错题次数: <strong>{wrongInfo.wrongCount}</strong> 次 | 
                  掌握度: <strong>{wrongInfo.streak}/3</strong> 次连续正确后移出
            </span>
          </div>

          {/* 题目卡片 */}
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              {/* 题干 */}
              <div className="text-lg text-gray-800 leading-relaxed mb-6">
                {currentReviewQuestion.content}
              </div>

              {/* 选项 */}
              {currentReviewQuestion.options && currentReviewQuestion.options.length > 0 && (
                <div className="space-y-3 mb-6">
                  {currentReviewQuestion.options.map((option, index) => {
                    const isSelected = localAnswer === option.id;
                    const isCorrectOption = currentReviewQuestion.answer === option.id || 
                      (Array.isArray(currentReviewQuestion.answer) && currentReviewQuestion.answer.includes(option.id));
                    
                    return (
                      <div
                        key={option.id}
                        onClick={() => !showAnswer && handleSelectAnswer(option.id)}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          isSelected && !showAnswer
                            ? 'border-indigo-500 bg-indigo-50'
                            : showAnswer && isCorrectOption
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        } ${showAnswer && isSelected && !isCorrectOption ? 'border-red-500 bg-red-50' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            isSelected && !showAnswer
                              ? 'bg-indigo-500 text-white'
                              : showAnswer && isCorrectOption
                              ? 'bg-emerald-500 text-white'
                              : isSelected && !isCorrectOption
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {getOptionLabel(index)}
                          </span>
                          <span className="flex-1 text-gray-700">{option.text}</span>
                          {showAnswer && isCorrectOption && (
                            <Check className="w-5 h-5 text-emerald-500" />
                          )}
                          {showAnswer && isSelected && !isCorrectOption && (
                            <X className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 填空题答案输入 */}
              {(!currentReviewQuestion.options || currentReviewQuestion.options.length === 0) && (
                <div className="mb-6">
                  <Input
                    placeholder="输入你的答案"
                    value={(localAnswer as string) || ''}
                    onChange={(e) => !showAnswer && handleSelectAnswer(e.target.value)}
                    disabled={showAnswer}
                    className="text-lg"
                  />
                </div>
              )}

              {/* 答案和解析 */}
              {showAnswer && (
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-emerald-500" />
                    <span className="font-semibold text-emerald-700">正确答案</span>
                  </div>
                  <p className="text-gray-800 mb-4">
                    {Array.isArray(currentReviewQuestion.answer) 
                      ? currentReviewQuestion.answer.join(', ')
                      : currentReviewQuestion.answer}
                  </p>
                  
                  {currentReviewQuestion.explanation && (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-5 h-5 text-amber-500" />
                        <span className="font-semibold text-amber-700">解析</span>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {currentReviewQuestion.explanation}
                      </p>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="mt-6 space-y-3">
            {!showAnswer ? (
              <Button
                onClick={handleSubmitAnswer}
                disabled={localAnswer === undefined}
                className="w-full h-12 text-base bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
              >
                提交答案
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleNext}
                  className="w-full h-12 text-base bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                >
                  {reviewIndex < reviewQuestions.length - 1 ? '下一题' : '完成复习'}
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => markAsMastered(currentReviewQuestion.id)}
                    className="flex-1"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    标记已掌握
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 错题本列表页面
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* 头部 */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-gray-600">
              <ChevronLeft className="w-4 h-4 mr-1" />
              返回
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-orange-500" />
            智能错题本
          </h1>
        </div>

        {wrongQuestions.length === 0 ? (
          /* 空状态 */
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">太棒了！暂无错题</h2>
            <p className="text-gray-400">继续保持，做题全对不是梦</p>
            <Link href="/">
              <Button className="mt-6 bg-gradient-to-r from-indigo-500 to-purple-500">
                去刷题
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* 统计概览 */}
            <Card className="border-0 shadow-lg rounded-2xl mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">题型分布</h2>
                  <span className="text-sm text-gray-500">共 {wrongQuestions.length} 题</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setSelectedType('all')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      selectedType === 'all'
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    全部 {wrongQuestions.length}
                  </button>
                  {typeStats.map(stat => (
                    <button
                      key={stat.type}
                      onClick={() => setSelectedType(stat.type)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium text-white transition-all ${stat.color} ${
                        selectedType === stat.type ? 'ring-2 ring-offset-2 ring-gray-800' : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      {stat.label} {stat.count}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 复习模式选择 */}
            <Card className="border-0 shadow-lg rounded-2xl mb-4">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">复习模式</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setReviewMode('forgot')}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      reviewMode === 'forgot'
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-indigo-500" />
                      <span className="text-sm font-medium">优先复习</span>
                    </div>
                    <p className="text-xs text-gray-400">遗忘久的优先</p>
                  </button>
                  <button
                    onClick={() => setReviewMode('byType')}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      reviewMode === 'byType'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Filter className="w-4 h-4 text-purple-500" />
                      <span className="text-sm font-medium">按题型</span>
                    </div>
                    <p className="text-xs text-gray-400">单选→多选→判断</p>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* 开始复习按钮 */}
            <Button
              onClick={() => startReview(selectedType)}
              className="w-full h-12 text-base mb-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              开始复习 ({filteredQuestions.length}题)
            </Button>

            {/* 错题列表 */}
            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">错题详情</h3>
                <div className="space-y-3">
                  {filteredQuestions.slice(0, 10).map((question, index) => {
                    const info = getWrongInfo(question.id);
                    return (
                      <div
                        key={question.id}
                        className="p-4 bg-gray-50 rounded-xl border border-gray-100"
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-500 flex-shrink-0">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${getTypeColor(question.type)}`}>
                                {getTypeLabel(question.type)}
                              </span>
                              <span className="text-xs text-gray-400">
                                错 {info.wrongCount} 次
                              </span>
                              <span className="text-xs text-gray-400">
                                连续对 {info.streak}/3
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                              {question.content}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setReviewQuestions([question]);
                                setReviewIndex(0);
                                setShowAnswer(false);
                                setLocalAnswer(undefined);
                                setIsAnswerCorrect(false);
                                setIsReviewing(true);
                              }}
                              className="text-xs h-7"
                            >
                              复习此题
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {filteredQuestions.length > 10 && (
                  <p className="text-center text-sm text-gray-400 mt-3">
                    还有 {filteredQuestions.length - 10} 道错题，点击上方「开始复习」查看全部
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 提示 */}
            <div className="mt-4 p-3 bg-amber-50 rounded-xl text-sm text-amber-700">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>做对同一道题 <strong>3次</strong> 将自动移出错题本，你也可以手动标记「已掌握」立即移出。</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
