'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Question, QuizState, PracticeMode, PracticeRecord } from '@/lib/types';
import { questionStore, recordStore, bankStore, wrongStreakStore, getWrongQuestionIds, generateId, recentPracticeStore, RecentPractice, preloadQuestions, clearPreloadCache, cloudSyncService, getCurrentUserId, queueRecordForSync, queueStreakForSync, forceSync, forceSyncBeacon, calculateStats } from '@/lib/quiz-store';

// localStorage key for quiz state persistence (持久化，浏览器关闭后仍存在)
const QUIZ_PROGRESS_KEY = 'quiz_progress';

// 只保存关键进度信息，避免超过 localStorage 5MB 限制
export interface QuizProgress {
  bankId?: string;
  mode: PracticeMode;
  currentIndex: number;
  answers: Record<string, string | string[]>;
  timeSpent: number;
  questionIds: string[];
  bankName?: string;
  categoryId?: string;
  categoryName?: string;
  timestamp: number;
}

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

  const [hasStarted, setHasStarted] = useState(false); // 追踪是否已开始练习
  const preloadIndexRef = useRef(-1); // 记录已预加载到的位置
  const isMountedRef = useRef(true); // 跟踪组件是否已挂载

  // 组件挂载/卸载跟踪
  useEffect(() => {
    isMountedRef.current = true;

    // 页面卸载前强制同步（防止数据丢失）
    const handleBeforeUnload = () => {
      if (cloudSyncService.hasPendingSync()) {
        // 使用 sendBeacon 确保 beforeunload 期间请求能发出
        forceSyncBeacon();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // 组件卸载时强制同步
      if (cloudSyncService.hasPendingSync()) {
        forceSync();
      }
    };
  }, []);

  // 保存做题状态到 localStorage（持久化，浏览器关闭后仍可恢复）
  useEffect(() => {
    if (hasStarted && quizState.questions.length > 0 && !quizState.isComplete) {
      const progress: QuizProgress = {
        bankId: quizState.bankId,
        mode: quizState.mode,
        currentIndex: quizState.currentIndex,
        answers: quizState.answers,
        timeSpent: quizState.timeSpent,
        questionIds: quizState.questions.map(q => q.id),
        bankName: quizState.bankName,
        categoryId: quizState.categoryId,
        categoryName: quizState.categoryName,
        timestamp: Date.now(),
      };
      try {
        localStorage.setItem(QUIZ_PROGRESS_KEY, JSON.stringify(progress));
      } catch {
        // 忽略存储错误（如存储空间不足）
      }
    }
  }, [quizState, hasStarted]);

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
  // 注意：题目加载由 startQuiz 统一管理，不在这里初始化

  // 检查是否有可恢复的做题进度
  const checkProgress = useCallback((mode: PracticeMode, bankId?: string | null): QuizProgress | null => {
    try {
      const saved = localStorage.getItem(QUIZ_PROGRESS_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved) as QuizProgress;
      const isSameBank = parsed.bankId === bankId;
      const isSameMode = parsed.mode === mode;
      const hasQuestions = parsed.questionIds && parsed.questionIds.length > 0;
      if (isSameBank && isSameMode && hasQuestions) {
        return parsed;
      }
    } catch {
      // 解析失败
    }
    return null;
  }, []);

  // 恢复做题进度
  const resumeQuiz = useCallback((progress: QuizProgress, loadedQuestions?: Question[]) => {
    setQuizState(prev => ({
      ...prev,
      questions: loadedQuestions || prev.questions,
      currentIndex: progress.currentIndex,
      answers: progress.answers,
      mode: progress.mode,
      timeSpent: progress.timeSpent,
      isComplete: false,
      bankId: progress.bankId,
      bankName: progress.bankName,
      categoryId: progress.categoryId,
      categoryName: progress.categoryName,
    }));
    setHasStarted(true);
    preloadIndexRef.current = -1;
    if (progress.bankId) {
      const existingRecord = recentPracticeStore.getByBankId(progress.bankId);
      if (existingRecord) {
        recentPracticeStore.update({
          ...existingRecord,
          currentIndex: progress.currentIndex,
          lastPracticeAt: Date.now(),
        });
      }
    }
  }, []);

  // 清除做题进度
  const clearProgress = useCallback(() => {
    try {
      localStorage.removeItem(QUIZ_PROGRESS_KEY);
    } catch {}
  }, []);

  // 开始练习
  const startQuiz = useCallback(async (mode: PracticeMode = 'sequential', bankId?: string | null, options?: { clearSaved?: boolean; initialProgress?: QuizProgress }) => {
    const clearSaved = options?.clearSaved ?? true;
    const initialProgress = options?.initialProgress;
    
    // 清除之前的进度（恢复时不清除）
    if (clearSaved) {
      clearProgress();
    }

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

    // 使用初始进度或默认值
    setQuizState({
      questions,
      currentIndex: initialProgress?.currentIndex ?? 0,
      answers: initialProgress?.answers ?? {},
      showResult: false,
      mode,
      timeSpent: initialProgress?.timeSpent ?? 0,
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
        
        // 标记需要同步到云端（使用增量同步队列）
        const userId = getCurrentUserId();
        if (userId) {
          syncToCloud = true;
          syncUserId = userId;
          // 使用增量同步队列而不是全量同步
          queueRecordForSync(record);
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
    
    // 更新错题连续正确次数
    const currentQ = quizState.questions[quizState.currentIndex];
    if (currentQ) {
      const selectedAns = quizState.answers[currentQ.id];
      // 内联答案检查逻辑（checkAnswer 此时还未声明）
      let wasCorrect = false;
      if (selectedAns !== undefined) {
        if (Array.isArray(currentQ.answer)) {
          wasCorrect = Array.isArray(selectedAns) && 
            currentQ.answer.length === selectedAns.length && 
            currentQ.answer.every((a: string) => selectedAns.includes(a));
        } else {
          wasCorrect = !Array.isArray(selectedAns) && selectedAns === currentQ.answer;
        }
      }
      
      if (wasCorrect) {
        // 答对：检查是否是错题本中的题目
        const wrongIds = getWrongQuestionIds();
        if (wrongIds.includes(currentQ.id)) {
          wrongStreakStore.increment(currentQ.id);
          const newStreak = wrongStreakStore.get(currentQ.id);
          // 同步 streak 到队列
          if (syncUserId) {
            queueStreakForSync(currentQ.id, newStreak);
          }
          if (newStreak >= 3) {
            // 连续答对3次，从错题本中移除：删除该题目的错误记录
            const records = recordStore.getAll().filter(r => !(r.questionId === currentQ.id && !r.isCorrect));
            recordStore.save(records);
            wrongStreakStore.remove(currentQ.id);
            // 同步 streak 移除（设置为0）
            if (syncUserId) {
              queueStreakForSync(currentQ.id, 0);
            }
          }
        }
      } else {
        // 答错：重置该题的连续正确次数
        wrongStreakStore.reset(currentQ.id);
        // 同步 streak 重置
        if (syncUserId) {
          queueStreakForSync(currentQ.id, 0);
        }
      }
    }
    
    // 防抖同步到云端（使用增量同步队列，3秒后自动同步）
    // 不再需要立即同步，queueRecordForSync 和 queueStreakForSync 已经触发了防抖同步
  }, [quizState]);

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
  const resetQuiz = useCallback((clearSavedProgress = true) => {
    clearPreloadCache(); // 清除预加载缓存
    preloadIndexRef.current = -1; // 重置预加载位置

    // 仅当明确指定时才清除 localStorage 中的进度
    // 用户做到一半退出时，不清除进度以便下次恢复
    if (clearSavedProgress) {
      try {
        localStorage.removeItem(QUIZ_PROGRESS_KEY);
      } catch {}
    }

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

    // 清除 sessionStorage（已完成练习）
    try {
      sessionStorage.removeItem(QUIZ_SESSION_KEY);
    } catch {}

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
    const fullStats = calculateStats();
    
    return {
      ...fullStats,
      totalCount: fullStats.correctCount + fullStats.wrongCount,
      wrongQuestionIds: fullStats.wrongQuestions,
      masteredCount: fullStats.correctCount,
    };
  }, [quizState.currentIndex, quizState.answers]); // 依赖当前状态，确保及时更新

  return {
    quizState,
    currentQuestion,
    currentAnswer,
    isAnswerCorrect,
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
    checkProgress,
    resumeQuiz,
    clearProgress,
  };
}
