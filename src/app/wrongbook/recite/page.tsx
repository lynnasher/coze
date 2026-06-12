'use client';

import React, { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Question, QuestionType } from '@/lib/types';
import { questionStore, getWrongQuestionIds, wrongStreakStore, getUserToken, deletedQuestionStore } from '@/lib/quiz-store';
import { Button } from '@/components/ui/button';
import { RichTextWithBreaks } from '@/lib/rich-text';

const PAGE_SIZE = 20;

export default function WrongbookRecitePage() {
  return (
    <Suspense fallback={null}>
      <WrongbookReciteContent />
    </Suspense>
  );
}

function WrongbookReciteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeFilter = (searchParams.get('type') as QuestionType | null) || 'all';
  const bankFilter = searchParams.get('bank') || 'all';

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloudQuestions, setCloudQuestions] = useState<Record<string, Question>>({});
  const [currentPage, setCurrentPage] = useState(1);

  // 加载云端题目（与 wrongbook 一致的数据源）
  const fetchQuestionsFromCloud = useCallback(async (questionIds: string[]) => {
    if (questionIds.length === 0) return;
    const token = getUserToken();
    if (!token) return;

    try {
      const batchSize = 10;
      const batches: string[][] = [];
      for (let i = 0; i < questionIds.length; i += batchSize) {
        batches.push(questionIds.slice(i, i + batchSize));
      }

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

      const fetched: Record<string, Question> = {};
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.questions) {
          result.value.questions.forEach((q: Question) => {
            fetched[q.id] = q;
          });
        }
      });
      setCloudQuestions(prev => ({ ...prev, ...fetched }));
      return fetched;
    } catch {
      return {};
    }
  }, []);

  // 加载错题数据
  useEffect(() => {
    const loadWrongQuestions = async () => {
      try {
        const wrongIds = getWrongQuestionIds();
        const allQuestions = questionStore.getAll();

        // 收集本地所有题目（含综合题子题）
        const localQuestionsMap = new Map<string, Question>();
        for (const q of allQuestions) {
          localQuestionsMap.set(q.id, q);
          if (q.children) {
            q.children.forEach(c => {
              localQuestionsMap.set(c.id, {
                ...c,
                caseBackground: c.caseBackground || q.caseBackground,
              });
            });
          }
        }

        // 先从本地找
        const foundQuestions: Question[] = [];
        const missingIds: string[] = [];

        for (const id of wrongIds) {
          if (deletedQuestionStore.isDeleted(id)) continue;
          const localQ = localQuestionsMap.get(id);
          if (localQ) {
            foundQuestions.push(localQ);
          } else {
            missingIds.push(id);
          }
        }

        // 缺失的从云端获取
        if (missingIds.length > 0) {
          const fetched = await fetchQuestionsFromCloud(missingIds);
          for (const id of missingIds) {
            if (deletedQuestionStore.isDeleted(id)) continue;
            const cloudQ = fetched?.[id];
            if (cloudQ) {
              foundQuestions.push(cloudQ);
            }
          }
        }

        // 按题型排序
        const typeOrder = ['single', 'multiple', 'uncertain-choice', 'true-false', 'fill-blank', 'comprehensive'];
        foundQuestions.sort((a, b) => {
          const aOrder = typeOrder.indexOf(a.type);
          const bOrder = typeOrder.indexOf(b.type);
          return (aOrder === -1 ? 999 : aOrder) - (bOrder === -1 ? 999 : bOrder);
        });

        setQuestions(foundQuestions);
      } catch (error) {
        console.error('加载错题数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWrongQuestions();
  }, [fetchQuestionsFromCloud]);

  // 应用筛选
  const filteredQuestions = useMemo(() => {
    let result = questions;
    if (bankFilter !== 'all') {
      result = result.filter(q => q.bankId === bankFilter);
    }
    if (typeFilter !== 'all') {
      result = result.filter(q => q.type === typeFilter);
    }
    return result;
  }, [questions, typeFilter, bankFilter]);

  // 分页
  const totalPages = Math.ceil(filteredQuestions.length / PAGE_SIZE);
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredQuestions.slice(start, start + PAGE_SIZE);
  }, [filteredQuestions, currentPage]);

  // 筛选条件变化时回到第一页
  useEffect(() => { setCurrentPage(1); }, [typeFilter, bankFilter]);

  // 获取答案显示文本
  const getAnswerDisplay = useCallback((question: Question) => {
    const answer = question.answer;
    if (question.type === 'true-false') {
      const answerKey = (Array.isArray(answer) ? answer[0] : answer)?.toString().toUpperCase();
      const option = question.options?.find(o => o.id.toUpperCase() === answerKey);
      if (option) {
        const text = option.text.replace(/[。，、；：！？（）\.\,\;\:\!\?\(\)]/g, '').trim();
        return text === '正确' || text === '对' || text === '√' || text === '是' ? '正确' : '错误';
      }
      return answerKey;
    }
    if (question.type === 'fill-blank') {
      return Array.isArray(answer) ? answer.join('；') : answer;
    }
    if (Array.isArray(answer)) {
      return answer.map(a => a.toUpperCase()).join('、');
    }
    return answer?.toString().toUpperCase() || '';
  }, []);

  // 获取正确答案的选项ID集合
  const getCorrectOptionIds = useCallback((question: Question): Set<string> => {
    const answer = question.answer;
    const normalizeAnswer = (a: string | string[]): string[] => {
      if (Array.isArray(a)) return a.map(x => x.toString().trim());
      return a.split(',').map(x => x.trim());
    };
    const ids = normalizeAnswer(answer);
    return new Set(ids.map(a => a.toUpperCase()));
  }, []);

  // 按题型分组
  const groupedQuestions = useMemo(() => {
    const groups: Record<string, Question[]> = {};
    paginatedQuestions.forEach(q => {
      const typeKey = q.type;
      if (!groups[typeKey]) groups[typeKey] = [];
      groups[typeKey].push(q);
    });
    const typeOrder = ['single', 'multiple', 'true-false', 'fill-blank', 'comprehensive'];
    const sortedGroups: { type: string; typeName: string; questions: Question[] }[] = [];
    const typeNames: Record<string, string> = {
      'single': '单选题', 'multiple': '多选题', 'uncertain-choice': '不定项选择题',
      'true-false': '判断题', 'fill-blank': '填空题', 'comprehensive': '综合题'
    };
    typeOrder.forEach(type => {
      if (groups[type] && groups[type].length > 0) {
        sortedGroups.push({ type, typeName: typeNames[type] || type, questions: groups[type] });
      }
    });
    return sortedGroups;
  }, [paginatedQuestions]);

  const totalCount = filteredQuestions.length;
  const masteredCount = questions.filter(q => (wrongStreakStore.get(q.id) || 0) >= 3).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-3 text-gray-500 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[900px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/wrongbook')}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-gray-900">错题快速背题</h1>
              <p className="text-xs text-gray-500">
                {totalCount} 道错题 · 已掌握 {masteredCount} 题
                {(typeFilter !== 'all' || bankFilter !== 'all') && ' · 已筛选'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <BookOpen className="w-4 h-4" />
            <span>快速背题</span>
          </div>
        </div>
      </header>

      {/* 内容区 */}
      <main className="max-w-[900px] mx-auto px-4 py-6">
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="mt-4 text-gray-500">
              {questions.length === 0 ? '暂无错题，继续保持！' : '当前筛选条件下没有错题'}
            </p>
            <Button
              onClick={() => router.push('/wrongbook')}
              variant="outline"
              className="mt-4"
            >
              返回错题本
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedQuestions.map((group, groupIndex) => (
              <div key={group.type} className="space-y-4">
                {/* 题型分组标题 */}
                <div className="sticky top-14 z-10 bg-gray-50/95 backdrop-blur py-2 border-b border-gray-200">
                  <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      group.type === 'single' ? 'bg-indigo-100 text-indigo-700' :
                      group.type === 'multiple' ? 'bg-purple-100 text-purple-700' :
                      group.type === 'uncertain-choice' ? 'bg-pink-100 text-pink-700' :
                      group.type === 'true-false' ? 'bg-cyan-100 text-cyan-700' :
                      group.type === 'fill-blank' ? 'bg-teal-100 text-teal-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {group.typeName}
                    </span>
                    <span className="text-sm text-gray-500">{group.questions.length} 题</span>
                  </h2>
                </div>
                
                {/* 题目列表 */}
                <div className="space-y-6">
                  {(() => {
                    let globalIndex = (currentPage - 1) * PAGE_SIZE + 1;
                    for (let i = 0; i < groupIndex; i++) {
                      globalIndex += groupedQuestions[i].questions.reduce((acc, q) => {
                        if (q.type === 'comprehensive' && q.children) {
                          return acc + 1 + q.children.length;
                        }
                        return acc + 1;
                      }, 0);
                    }
                    
                    return group.questions.map((question) => {
                      const currentIndex = globalIndex;
                      if (question.type === 'comprehensive' && question.children) {
                        globalIndex += 1 + question.children.length;
                      } else {
                        globalIndex += 1;
                      }
                      
                      if (question.type === 'comprehensive') {
                        return (
                          <div key={question.id}>
                            <ReciteCard
                              question={question}
                              index={currentIndex}
                              correctOptionIds={getCorrectOptionIds(question)}
                              answerDisplay={getAnswerDisplay(question)}
                            />
                            {question.children && question.children.length > 0 && (
                              <div className="ml-6 mt-4 space-y-4">
                                {question.children.map((child, ci) => (
                                  <ReciteCard
                                    key={child.id}
                                    question={child}
                                    index={`${currentIndex}.${ci + 1}`}
                                    correctOptionIds={getCorrectOptionIds(child)}
                                    answerDisplay={getAnswerDisplay(child)}
                                    isChild
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }
                      
                      return (
                        <ReciteCard
                          key={question.id}
                          question={question}
                          index={currentIndex}
                          correctOptionIds={getCorrectOptionIds(question)}
                          answerDisplay={getAnswerDisplay(question)}
                        />
                      );
                    });
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              上一页
            </Button>
            <span className="text-sm text-gray-500 px-3">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              下一页
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* 底部 */}
        {filteredQuestions.length > 0 && (
          <div className="mt-12 pb-8 text-center">
            <p className="text-xs text-gray-400">— 温故而知新，可以为师矣 —</p>
          </div>
        )}
      </main>
    </div>
  );
}

// 题目卡片组件
function ReciteCard({
  question,
  index,
  correctOptionIds,
  answerDisplay,
  isChild = false,
}: {
  question: Question;
  index: number | string;
  correctOptionIds: Set<string>;
  answerDisplay: string;
  isChild?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${isChild ? 'ml-4' : ''}`}>
      <div className="p-5">
        {/* 题号 + 题干 */}
        <div className="flex items-start gap-2 mb-4">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex items-center justify-center mt-0.5">
            {index}
          </span>
          <div className="flex-1">
            <RichTextWithBreaks 
              content={question.content} 
              textClassName="text-base text-gray-900 leading-relaxed"
            />
          </div>
        </div>

        {/* 选项列表 */}
        {question.options && question.options.length > 0 && (
          <div className="space-y-2 mb-4">
            {question.options.map((option) => {
              const isCorrect = correctOptionIds.has(option.id.toUpperCase());
              return (
                <div
                  key={option.id}
                  className={`
                    flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors
                    ${isCorrect
                      ? 'bg-emerald-50 border-emerald-300'
                      : 'bg-gray-50 border-gray-100'
                    }
                  `}
                >
                  <span
                    className={`
                      flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center
                      ${isCorrect
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                      }
                    `}
                  >
                    {option.id.toUpperCase()}
                  </span>
                  <span
                    className={`
                      text-sm leading-relaxed pt-0.5
                      ${isCorrect ? 'text-emerald-800 font-medium' : 'text-gray-600'}
                    `}
                  >
                    <RichTextWithBreaks content={option.text} />
                  </span>
                  {isCorrect && (
                    <CheckCircle2 className="flex-shrink-0 w-4 h-4 text-emerald-500 mt-0.5 ml-auto" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 填空题答案 */}
        {question.type === 'fill-blank' && (
          <div className="mb-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-sm font-medium text-emerald-800">正确答案：</span>
                <span className="text-sm text-emerald-700">{answerDisplay}</span>
              </div>
            </div>
          </div>
        )}

        {/* 答案与解析 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-sm text-emerald-800 font-medium">答案：{answerDisplay}</span>
          </div>

          {question.explanation && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-4 h-4 mt-0.5 text-amber-600 font-bold text-xs flex items-center justify-center border border-amber-600 rounded-full">!</span>
                <div className="text-sm text-amber-800">
                  <RichTextWithBreaks content={question.explanation} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
