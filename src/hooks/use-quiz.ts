'use client';

import { useState, useCallback, useEffect } from 'react';
import { Question, QuizState, PracticeMode, PracticeRecord } from '@/lib/types';
import { questionStore, recordStore, bankStore, wrongStreakStore, getWrongQuestionIds, generateId } from '@/lib/quiz-store';

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
      console.error('从数据库加载题目失败:', error);
    }
    return null;
  }, []);

  // 初始化加载题目
  useEffect(() => {
    console.log('useQuiz: 开始加载题目...');
    const loadQuestions = async () => {
      try {
        console.log('useQuiz: 调用 loadQuestionsFromDb...');
        // 先尝试从数据库加载
        const dbQuestions = await loadQuestionsFromDb();
        console.log('useQuiz: dbQuestions:', dbQuestions?.length);
        
        let questions = questionStore.getAll();
        console.log('useQuiz: local questions:', questions.length);
        
        // 如果数据库有题目，合并到 localStorage
        if (dbQuestions && dbQuestions.length > 0) {
          // 合并数据库题目和本地题目，去重
          const existingIds = new Set(questions.map(q => q.id));
          const newQuestions = dbQuestions.filter(q => !existingIds.has(q.id));
          if (newQuestions.length > 0) {
            questions = [...questions, ...newQuestions];
            questionStore.save(questions);
          }
        }
        
        if (questions.length === 0) {
          // 导入示例数据
          try {
            const { initSampleQuestions } = await import('@/lib/quiz-store');
            initSampleQuestions();
            questions = questionStore.getAll();
          } catch {
            // 忽略
          }
        }

        console.log('useQuiz: 最终题目数:', questions.length);
        setQuizState(prev => ({
          ...prev,
          questions,
        }));
        console.log('useQuiz: 设置 isLoading = false');
        setIsLoading(false);
      } catch (error) {
        console.error('加载题目失败:', error);
        setIsLoading(false);
      }
    };
    
    loadQuestions();
  }, [loadQuestionsFromDb]);

  // 开始练习
  const startQuiz = useCallback(async (mode: PracticeMode = 'sequential', bankId?: string | null) => {
    let questions: Question[] = [];
    
    if (bankId) {
      // 从数据库加载该题库的题目
      const dbQuestions = await loadQuestionsFromDb(bankId);
      if (dbQuestions && dbQuestions.length > 0) {
        questions = dbQuestions;
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

    setHasStarted(true); // 标记已开始练习
    setQuizState({
      questions,
      currentIndex: 0,
      answers: {},
      showResult: false,
      mode,
      timeSpent: 0,
      isComplete: false,
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
      if (prev.currentIndex < prev.questions.length - 1) {
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
      }
      
      return {
        ...prev,
        showResult: true,
      };
    });
  }, []);

  // 检查答案是否正确
  const checkAnswer = (question: Question, selectedAnswer: string | string[] | undefined): boolean => {
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
  };

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
    
    // 将所有未作答题目标记为错误
    quizState.questions.forEach((q, idx) => {
      if (!quizState.answers[q.id]) {
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
    
    setQuizState(prev => ({
      ...prev,
      isComplete: true,
      showResult: true,
    }));
  }, [quizState]);

  // 获取当前题目
  const currentQuestion = quizState.questions[quizState.currentIndex];
  const currentAnswer = currentQuestion ? quizState.answers[currentQuestion.id] : undefined;
  const isAnswerCorrect = currentQuestion ? checkAnswer(currentQuestion, currentAnswer) : false;

  // 计算统计信息
  const getStats = useCallback(() => {
    const records = recordStore.getAll();
    const correctCount = records.filter(r => r.isCorrect).length;
    const totalCount = records.length;
    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    
    return {
      correctCount,
      totalCount,
      accuracy,
      wrongCount: totalCount - correctCount,
      wrongQuestionIds: getWrongQuestionIds(),
    };
  }, []);

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
    getStats,
  };
}
