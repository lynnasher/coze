'use client';

import { useState, useCallback, useEffect } from 'react';
import { Question, QuizState, PracticeMode, PracticeRecord } from '@/lib/types';
import { questionStore, recordStore, generateId } from '@/lib/quiz-store';

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

  // 初始化加载题目
  useEffect(() => {
    const questions = questionStore.getAll();
    if (questions.length === 0) {
      // 导入示例数据
      import('@/lib/quiz-store').then(({ initSampleQuestions }) => {
        initSampleQuestions();
        setQuizState(prev => ({
          ...prev,
          questions: questionStore.getAll(),
          isComplete: false,
        }));
      });
    } else {
      setQuizState(prev => ({
        ...prev,
        questions,
      }));
    }
    setIsLoading(false);
  }, []);

  // 开始练习
  const startQuiz = useCallback((mode: PracticeMode = 'sequential') => {
    let questions = questionStore.getAll();
    
    if (mode === 'random') {
      questions = [...questions].sort(() => Math.random() - 0.5);
    } else if (mode === 'wrong') {
      const wrongIds = recordStore.getWrongQuestionIds();
      if (wrongIds.length > 0) {
        questions = questions.filter(q => wrongIds.includes(q.id));
      }
      if (questions.length === 0) {
        questions = questionStore.getAll();
      }
    }

    setQuizState({
      questions,
      currentIndex: 0,
      answers: {},
      showResult: false,
      mode,
      timeSpent: 0,
      isComplete: false,
    });
  }, []);

  // 选择答案
  const selectAnswer = useCallback((questionId: string, answer: string | string[]) => {
    setQuizState(prev => ({
      ...prev,
      answers: {
        ...prev.answers,
        [questionId]: answer,
      },
    }));
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
    setQuizState(prev => ({
      ...prev,
      showResult: true,
    }));

    // 记录答题结果
    const currentQuestion = quizState.questions[quizState.currentIndex];
    if (currentQuestion) {
      const selectedAnswer = quizState.answers[currentQuestion.id];
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
  }, [quizState]);

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
      wrongQuestionIds: recordStore.getWrongQuestionIds(),
    };
  }, []);

  return {
    quizState,
    currentQuestion,
    currentAnswer,
    isAnswerCorrect,
    isLoading,
    startQuiz,
    selectAnswer,
    nextQuestion,
    prevQuestion,
    submitAnswer,
    goToQuestion,
    restartQuiz,
    getStats,
  };
}
