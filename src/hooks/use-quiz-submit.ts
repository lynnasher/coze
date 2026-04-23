/**
 * useQuizSubmit - 答题提交 Hook
 * 处理答案选择、提交、统计等逻辑
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { Question, PracticeRecord } from '@/lib/types';

interface UseQuizSubmitOptions {
  questions: Question[];
}

interface ResultStats {
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  accuracy: number;
}

interface UseQuizSubmitReturn {
  // 答案状态
  answers: Record<string, string | string[]>;
  
  // 操作方法
  selectAnswer: (questionId: string, answer: string | string[]) => void;
  checkAnswer: (questionId: string) => boolean;
  
  // 统计方法
  getStats: () => ResultStats;
  getQuestionStatus: (questionId: string) => 'correct' | 'wrong' | 'unanswered' | 'pending';
  
  // 结果统计
  resultStats: ResultStats;
  
  // 检查题目是否已答
  isAnswered: (questionId: string) => boolean;
  
  // 重置答案
  resetAnswers: () => void;
}

export function useQuizSubmit(options: UseQuizSubmitOptions): UseQuizSubmitReturn {
  const { questions } = options;
  
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  
  // 选择答案
  const selectAnswer = useCallback((questionId: string, answer: string | string[]) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
  }, []);
  
  // 检查答案是否正确
  const checkAnswer = useCallback((questionId: string): boolean => {
    const question = questions.find(q => q.id === questionId);
    const userAnswer = answers[questionId];
    
    if (!question || userAnswer === undefined) return false;
    
    const correctAnswer = question.answer;
    
    if (Array.isArray(correctAnswer)) {
      // 多选题
      if (Array.isArray(userAnswer)) {
        return userAnswer.length === correctAnswer.length &&
          userAnswer.every(a => correctAnswer.includes(a));
      }
      return false;
    } else {
      // 单选题、判断题、填空题
      if (question.type === 'fill-blank') {
        // 填空题精确匹配
        return String(userAnswer).trim() === String(correctAnswer).trim();
      }
      return String(userAnswer).toLowerCase() === String(correctAnswer).toLowerCase();
    }
  }, [questions, answers]);
  
  // 计算统计数据
  const resultStats = useMemo((): ResultStats => {
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    
    questions.forEach(q => {
      const answer = answers[q.id];
      const isUnanswered = 
        answer === undefined || 
        answer === '' || 
        (Array.isArray(answer) && answer.length === 0);
      
      if (isUnanswered) {
        unanswered++;
      } else {
        const correctAnswer = q.answer;
        let isCorrect = false;
        
        if (Array.isArray(correctAnswer)) {
          if (Array.isArray(answer)) {
            isCorrect = answer.length === correctAnswer.length &&
              answer.every(a => correctAnswer.includes(a));
          }
        } else {
          if (q.type === 'fill-blank') {
            isCorrect = String(answer).trim() === String(correctAnswer).trim();
          } else {
            isCorrect = String(answer).toLowerCase() === String(correctAnswer).toLowerCase();
          }
        }
        
        if (isCorrect) correct++;
        else wrong++;
      }
    });
    
    const total = questions.length;
    const totalAnswered = correct + wrong;
    const accuracy = totalAnswered > 0 ? Math.round((correct / totalAnswered) * 100) : 0;
    
    return { total, correct, wrong, unanswered, accuracy };
  }, [questions, answers]);
  
  // 获取题目状态
  const getQuestionStatus = useCallback((
    questionId: string
  ): 'correct' | 'wrong' | 'unanswered' | 'pending' => {
    const answer = answers[questionId];
    const isUnanswered = 
      answer === undefined || 
      answer === '' || 
      (Array.isArray(answer) && answer.length === 0);
    
    if (isUnanswered) return 'unanswered';
    
    const question = questions.find(q => q.id === questionId);
    if (!question) return 'pending';
    
    const correctAnswer = question.answer;
    let isCorrect = false;
    
    if (Array.isArray(correctAnswer)) {
      if (Array.isArray(answer)) {
        isCorrect = answer.length === correctAnswer.length &&
          answer.every(a => correctAnswer.includes(a));
      }
    } else {
      if (question.type === 'fill-blank') {
        isCorrect = String(answer).trim() === String(correctAnswer).trim();
      } else {
        isCorrect = String(answer).toLowerCase() === String(correctAnswer).toLowerCase();
      }
    }
    
    return isCorrect ? 'correct' : 'wrong';
  }, [questions, answers]);
  
  // 检查题目是否已答
  const isAnswered = useCallback((questionId: string): boolean => {
    const answer = answers[questionId];
    return answer !== undefined && 
           answer !== '' && 
           !(Array.isArray(answer) && answer.length === 0);
  }, [answers]);
  
  // 重置答案
  const resetAnswers = useCallback(() => {
    setAnswers({});
  }, []);
  
  return {
    answers,
    selectAnswer,
    checkAnswer,
    getStats: () => resultStats,
    getQuestionStatus,
    resultStats,
    isAnswered,
    resetAnswers,
  };
}
