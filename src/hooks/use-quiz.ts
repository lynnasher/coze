'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Question, QuizState, PracticeMode, PracticeRecord } from '@/lib/types';
import { questionStore, recordStore, bankStore, wrongStreakStore, getWrongQuestionIds, generateId, recentPracticeStore, RecentPractice, preloadQuestions, clearPreloadCache, cloudSyncService, getCurrentUserId } from '@/lib/quiz-store';

export function useQuiz() {
  const [quizState, setQuizState] = useState<QuizState>({
    questions: [],
    currentIndex: 0,
    answers: {},
    showResult: false,
    mode: 'sequential',
    timeSpent: 0,
    isComplete: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [hasStarted, setHasStarted] = useState(false); // 追踪是否已开始练习
  const preloadIndexRef = useRef(-1); // 记录已预加载到的位置
  const isMountedRef = useRef(true); // 跟踪组件是否已挂载

  // 组件挂载/卸载跟踪
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 预加载题目（当 currentIndex 变化时，提前加载后续题目）
  useEffect(() => {
    if (!hasStarted || quizState.questions.length === 0) return;
    
    const currentIdx = quizState.currentIndex;
    const totalQuestions = quizState.questions.length;
    
    // 只预加载还没预加载过的题目
    if (currentIdx <= preloadIndexRef.current) return;
    
    // 预加载当前题之后的 2 道题目
    const toPreload: string[] = [];
    for (let i = currentIdx + 1; i <= Math.min(currentIdx + 2, totalQuestions - 1); i++) {
      const q = quizState.questions[i];
      if (q) toPreload.push(q.id);
    }
    
    if (toPreload.length > 0) {
      preloadIndexRef.current = currentIdx;
      preloadQuestions(toPreload);
    }
  }, [hasStarted, quizState.currentIndex, quizState.questions]);

  // 从数据库加载题目
  const loadQuestionsFromDb = useCallback(async (bankId?: string) => {
    try {
      // 处理分类ID（cat_xxx格式）
      if (bankId?.startsWith('cat_')) {
        const categoryId = bankId.replace('cat_', '');
        const url = `/api/questions?categoryId=${categoryId}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          return data.questions as Question[];
        }
        return null;
      }
      
      const url = bankId ? `/api/questions?bankId=${bankId}` : '/api/questions';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return data.questions as Question[];
      }
    } catch (error) {
      // 忽略错误
    }
    return null;
  }, []);

  // 初始化加载题目 - 仅用于首页展示，不加载题目详情
  // 题目加载由 startQuiz 统一管理
  useEffect(() => {
    // 初始化时不加载任何题目，题目加载由 startQuiz 统一管理
    // 避免在用户开始练习某个题库后，初始化 effect 加载所有题目覆盖掉
    setIsLoading(false);
  }, []); // 空依赖，确保只执行一次

  // 开始练习
  const startQuiz = useCallback(async (mode: PracticeMode = 'sequential', bankId?: string | null) => {
    // 立即设置 hasStarted 为 true，避免页面闪烁
    setHasStarted(true);
    
    let questions: Question[] = [];
    const currentBankId = bankId;
    let currentBankName = '全部题目';
    let currentCategoryId: string | undefined;
    let currentCategoryName: string | undefined;
    
    // 如果有题库ID，获取题库名称
    if (bankId) {
      // 检查是否是分类ID格式
      if (bankId.startsWith('cat_')) {
        currentCategoryId = bankId.replace('cat_', '');
        // 尝试获取分类名称（通过 API 或本地存储）
        try {
          const storedCategories = localStorage.getItem('quiz_categories');
          if (storedCategories) {
            const cats = JSON.parse(storedCategories);
            const cat = cats.find((c: { id: string }) => c.id === currentCategoryId);
            if (cat) {
              currentCategoryName = cat.name;
            }
          }
        } catch {}
        currentBankName = currentCategoryName || '分类练习';
      } else {
        // 尝试从数据库获取题库名称
        try {
          const response = await fetch(`/api/banks/${bankId}`);
          if (response.ok) {
            const data = await response.json();
            currentBankName = data.bank?.name || '题库练习';
          }
        } catch {}
        
        // 如果 API 失败，尝试从本地存储获取
        if (currentBankName === '题库练习') {
          const bank = bankStore.getById(bankId);
          if (bank) {
            currentBankName = bank.name;
          }
        }
      }
    }
    
    if (bankId) {
      // 从数据库加载该题库的题目
      const dbQuestions = await loadQuestionsFromDb(bankId);
      if (dbQuestions && dbQuestions.length > 0) {
        questions = dbQuestions;
        // 保存题目到本地存储，以便错题本等模块能正确匹配题目ID
        const existingQuestions = questionStore.getAll();
        const existingIds = new Set(existingQuestions.map(q => q.id));
        const newQuestions = questions.filter(q => !existingIds.has(q.id));
        if (newQuestions.length > 0) {
          questionStore.addMultiple(newQuestions);
        }
      }
      
      // 如果数据库没有，再从 localStorage 获取
      if (questions.length === 0) {
        const localQuestions = questionStore.getAll();
        const bank = bankStore.getById(bankId);
        if (bank && bank.questionIds.length > 0) {
          questions = localQuestions.filter(q => bank.questionIds.includes(q.id));
        } else {
          questions = localQuestions.filter(q => q.bankId === bankId);
        }
      }
    } else {
      questions = questionStore.getAll();
    }
    
    if (mode === 'random') {
      questions = [...questions].sort(() => Math.random() - 0.5);
    } else if (mode === 'wrong') {
      // 使用新的 getWrongQuestionIds 函数，只获取需要继续练习的错题
      const wrongIds = getWrongQuestionIds();
      if (wrongIds.length > 0) {
        // 错题重练也要考虑题库筛选
        questions = questions.filter(q => wrongIds.includes(q.id));
      }
      if (questions.length === 0) {
        // 如果没有错题，显示提示（不切换到全部题目模式）
        questions = [];
      }
    }

    // 保存最近练习记录
    if (currentBankId && questions.length > 0) {
      const existingRecord = recentPracticeStore.getByBankId(currentBankId);
      recentPracticeStore.update({
        bankId: currentBankId,
        bankName: currentBankName,
        categoryId: currentCategoryId,
        categoryName: currentCategoryName,
        mode,
        totalCount: questions.length,
        currentIndex: 0,
        answeredCount: existingRecord?.answeredCount || 0,
        correctCount: existingRecord?.correctCount || 0,
        wrongCount: existingRecord?.wrongCount || 0,
        startedAt: existingRecord?.startedAt || Date.now(),
        lastPracticeAt: Date.now(),
        isCompleted: false,
      });
    }

    setQuizState({
      questions,
      currentIndex: 0,
      answers: {},
      showResult: false,
      mode,
      timeSpent: 0,
      isComplete: false,
      bankId: currentBankId || undefined,
      bankName: currentBankName || undefined,
      categoryId: currentCategoryId,
      categoryName: currentCategoryName,
    });
  }, [loadQuestionsFromDb]);

  // 选择答案（不自动提交）
  const selectAnswer = useCallback((questionId: string, answer: string | string[]) => {
    setQuizState(prev => {
      const newAnswers = {
        ...prev.answers,
        [questionId]: answer,
      };
      // 只更新答案，不自动显示结果
      // 用户需要点击"查看答案"按钮才会显示结果
      return {
        ...prev,
        answers: newAnswers,
      };
    });
  }, []);

  // 下一题
  const nextQuestion = useCallback(() => {
    setQuizState(prev => {
      const isLastQuestion = prev.currentIndex >= prev.questions.length - 1;
      
      // 更新最近练习记录
      if (prev.bankId && !isLastQuestion) {
        const existingRecord = recentPracticeStore.getByBankId(prev.bankId);
        if (existingRecord) {
          recentPracticeStore.update({
            ...existingRecord,
            currentIndex: prev.currentIndex + 1,
            lastPracticeAt: Date.now(),
          });
        }
      }
      
      if (!isLastQuestion) {
        return {
          ...prev,
          currentIndex: prev.currentIndex + 1,
          showResult: false,
        };
      }
      return {
        ...prev,
        isComplete: true,
      };
    });
  }, []);

  // 上一题
  const prevQuestion = useCallback(() => {
    setQuizState(prev => {
      if (prev.currentIndex > 0) {
        return {
          ...prev,
          currentIndex: prev.currentIndex - 1,
          showResult: false,
        };
      }
      return prev;
    });
  }, []);

  // 提交答案
  const submitAnswer = useCallback(() => {
    let syncToCloud = false;
    let syncUserId: string | null = null;
    let syncRecords: PracticeRecord[] = [];
    let syncStreaks: Record<string, number> = {};
    
    setQuizState(prev => {
      const currentQuestion = prev.questions[prev.currentIndex];
      if (currentQuestion) {
        const selectedAnswer = prev.answers[currentQuestion.id];
        const isCorrect = checkAnswer(currentQuestion, selectedAnswer);
        
        const record: PracticeRecord = {
          id: generateId(),
          questionId: currentQuestion.id,
          isCorrect,
          selectedAnswer: selectedAnswer || '',
          timestamp: Date.now(),
        };
        
        recordStore.add(record);
        
        // 标记需要同步到云端
        const userId = getCurrentUserId();
        if (userId) {
          syncToCloud = true;
          syncUserId = userId;
          syncRecords = recordStore.getAll();
          syncStreaks = wrongStreakStore.getAll();
        }
        
        // 更新最近练习记录
        if (prev.bankId) {
          const existingRecord = recentPracticeStore.getByBankId(prev.bankId);
          if (existingRecord) {
            // 计算当前已答数量和正确数量
            let answeredCount = existingRecord.answeredCount;
            let correctCount = existingRecord.correctCount;
            
            // 检查之前是否已经答过这道题
            const alreadyAnswered = existingRecord.answeredCount > prev.currentIndex;
            
            if (!alreadyAnswered) {
              answeredCount++;
              if (isCorrect) {
                correctCount++;
              }
            }
            
            recentPracticeStore.update({
              ...existingRecord,
              totalCount: prev.questions.length,
              answeredCount,
              correctCount,
              wrongCount: answeredCount - correctCount,
              lastPracticeAt: Date.now(),
              isCompleted: prev.currentIndex === prev.questions.length - 1,
            });
          }
        }
      }
      
      return {
        ...prev,
        showResult: true,
      };
    });
    
    // 实时同步到云端（每次答题后立即同步，合并请求避免竞态覆盖）
    if (syncToCloud && syncUserId) {
      cloudSyncService.saveRecordsAndStreaks(syncUserId, syncRecords, syncStreaks);
    }
  }, []);

  // 检查答案是否正确 - 使用 useCallback 避免重复创建
  const checkAnswer = useCallback((question: Question, selectedAnswer: string | string[] | undefined): boolean => {
    if (!selectedAnswer) return false;
    
    if (Array.isArray(question.answer)) {
      if (Array.isArray(selectedAnswer)) {
        return (
          question.answer.length === selectedAnswer.length &&
          question.answer.every(a => selectedAnswer.includes(a))
        );
      }
      return false;
    }
    
    if (Array.isArray(selectedAnswer)) {
      return selectedAnswer.length === 1 && selectedAnswer[0] === question.answer;
    }
    
    return selectedAnswer === question.answer;
  }, []);

  // 跳转到指定题目
  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < quizState.questions.length) {
      setQuizState(prev => ({
        ...prev,
        currentIndex: index,
        showResult: false,
      }));
    }
  }, [quizState.questions.length]);

  // 重新开始
  const restartQuiz = useCallback(() => {
    startQuiz(quizState.mode);
  }, [quizState.mode, startQuiz]);

  // 重置练习状态（返回首页时调用）
  const resetQuiz = useCallback(() => {
    clearPreloadCache(); // 清除预加载缓存
    preloadIndexRef.current = -1; // 重置预加载位置
    setQuizState({
      questions: [],
      currentIndex: 0,
      answers: {},
      showResult: false,
      mode: 'sequential',
      timeSpent: 0,
      isComplete: false,
    });
    setHasStarted(false);
  }, []);

  // 直接完成练习（提交试卷）
  const finishQuiz = useCallback(() => {
    // 记录当前题目答案（如果已选但未提交）
    const currentQ = quizState.questions[quizState.currentIndex];
    if (currentQ && quizState.answers[currentQ.id] && !quizState.showResult) {
      const selectedAnswer = quizState.answers[currentQ.id];
      const isCorrect = checkAnswer(currentQ, selectedAnswer);
      
      const record: PracticeRecord = {
        id: generateId(),
        questionId: currentQ.id,
        isCorrect,
        selectedAnswer: selectedAnswer || '',
        timestamp: Date.now(),
      };
      
      recordStore.add(record);
    }
    
    // 计算所有题目的答题统计
    let correctCount = 0;
    let answeredCount = 0;
    quizState.questions.forEach((q) => {
      if (quizState.answers[q.id]) {
        answeredCount++;
        if (checkAnswer(q, quizState.answers[q.id])) {
          correctCount++;
        } else {
          // 记录错误答案
          const record: PracticeRecord = {
            id: generateId(),
            questionId: q.id,
            isCorrect: false,
            selectedAnswer: quizState.answers[q.id] || '',
            timestamp: Date.now(),
          };
          recordStore.add(record);
        }
      } else {
        // 未作答的题目记录为错误
        const record: PracticeRecord = {
          id: generateId(),
          questionId: q.id,
          isCorrect: false,
          selectedAnswer: '',
          timestamp: Date.now(),
        };
        recordStore.add(record);
      }
    });
    
    // 更新最近练习记录
    if (quizState.bankId) {
      const existingRecord = recentPracticeStore.getByBankId(quizState.bankId);
      if (existingRecord) {
        recentPracticeStore.update({
          ...existingRecord,
          totalCount: quizState.questions.length,
          answeredCount: answeredCount,
          correctCount: correctCount,
          wrongCount: answeredCount - correctCount,
          lastPracticeAt: Date.now(),
          isCompleted: true,
        });
      }
    }
    
    setQuizState(prev => ({
      ...prev,
      isComplete: true,
      showResult: true,
    }));
    
    // 交卷后同步数据到云端（检查组件是否已挂载）
    if (isMountedRef.current) {
      const userId = getCurrentUserId();
      if (userId) {
        const records = recordStore.getAll();
        const streaks = wrongStreakStore.getAll();
        cloudSyncService.saveRecords(userId, records);
        cloudSyncService.saveStreaks(userId, streaks);
        if (quizState.bankId) {
          const recent = recentPracticeStore.getByBankId(quizState.bankId);
          if (recent) {
            cloudSyncService.saveRecentPractice(userId, recent);
          }
        }
      }
    }
  }, [quizState]);

  // 获取当前题目
  const currentQuestion = quizState.questions[quizState.currentIndex];
  const currentAnswer = currentQuestion ? quizState.answers[currentQuestion.id] : undefined;
  const isAnswerCorrect = currentQuestion ? checkAnswer(currentQuestion, currentAnswer) : false;

  // 计算统计信息 - 使用 useMemo 避免重复计算
  const stats = useMemo(() => {
    const records = recordStore.getAll();
    
    // 只统计用户实际作答过的题目（排除空答题记录）
    const answeredRecords = records.filter(r => {
      if (!r.selectedAnswer) return false;
      const answer = Array.isArray(r.selectedAnswer) ? r.selectedAnswer : String(r.selectedAnswer);
      return answer.length > 0;
    });
    
    const correctCount = answeredRecords.filter(r => r.isCorrect).length;
    const totalCount = answeredRecords.length;
    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    
    // 已掌握题数：做对过的题目去重数量
    const correctQuestionIds = new Set(
      answeredRecords.filter(r => r.isCorrect).map(r => r.questionId)
    );
    const masteredCount = correctQuestionIds.size;
    
    return {
      correctCount,
      totalCount,
      accuracy,
      wrongCount: totalCount - correctCount,
      wrongQuestionIds: getWrongQuestionIds(),
      masteredCount,
    };
  }, [quizState.currentIndex, quizState.answers]); // 依赖当前状态，确保及时更新

  return {
    quizState,
    currentQuestion,
    currentAnswer,
    isAnswerCorrect,
    isLoading,
    hasStarted,
    setHasStarted,
    startQuiz,
    selectAnswer,
    nextQuestion,
    prevQuestion,
    submitAnswer,
    finishQuiz,
    goToQuestion,
    restartQuiz,
    resetQuiz,
    stats,
  };
}
