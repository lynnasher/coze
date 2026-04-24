/**
 * Zustand Quiz Store - 刷题状态管理
 * 替代原有的 React Context + useState 方案
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Question, PracticeRecord, PracticeMode, QuizState } from '@/lib/types';

// ==================== 类型定义 ====================

interface QuizStoreState extends QuizState {
  // 加载状态
  isLoading: boolean;
  hasStarted: boolean;
  
  // 错误状态
  error: string | null;
  
  // 预加载状态
  preloadIndex: number;
}

interface QuizStoreActions {
  // 练习控制
  startQuiz: (questions: Question[], mode: PracticeMode) => void;
  selectAnswer: (questionId: string, answer: string | string[]) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  goToQuestion: (index: number) => void;
  submitAnswer: () => void;
  finishQuiz: () => void;
  restartQuiz: () => void;
  resetQuiz: () => void;
  
  // 状态更新
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHasStarted: (started: boolean) => void;
  incrementTime: () => void;
  updatePreloadIndex: (index: number) => void;
  
  // 计算属性获取器
  getCurrentQuestion: () => Question | null;
  getCurrentAnswer: () => string | string[] | undefined;
  getIsAnswerCorrect: () => boolean;
  getProgress: () => { current: number; total: number; percent: number };
  getStats: () => { correct: number; wrong: number; unanswered: number; accuracy: number };
}

export type QuizStore = QuizStoreState & QuizStoreActions;

// ==================== 初始状态 ====================

const initialState: Omit<QuizStoreState, keyof QuizStoreActions> = {
  questions: [],
  currentIndex: 0,
  answers: {},
  showResult: false,
  mode: 'sequential',
  timeSpent: 0,
  isComplete: false,
  isLoading: true,
  hasStarted: false,
  error: null,
  preloadIndex: -1,
};

// ==================== Store 创建 ====================

export const useQuizStore = create<QuizStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ==================== 练习控制 ====================
      
      startQuiz: (questions, mode) => {
        // 根据模式处理题目顺序
        let processedQuestions = [...questions];
        if (mode === 'random') {
          processedQuestions = shuffleArray(processedQuestions);
        } else if (mode === 'wrong') {
          // 错题模式：筛选出错题
          // 这里需要从外部传入错题ID列表
        }

        set({
          questions: processedQuestions,
          currentIndex: 0,
          answers: {},
          showResult: false,
          mode,
          timeSpent: 0,
          isComplete: false,
          hasStarted: true,
          isLoading: false,
          preloadIndex: -1,
          error: null,
        });
      },

      selectAnswer: (questionId, answer) => {
        set((state) => ({
          answers: {
            ...state.answers,
            [questionId]: answer,
          },
        }));
      },

      nextQuestion: () => {
        set((state) => {
          if (state.currentIndex >= state.questions.length - 1) {
            return state;
          }
          return { currentIndex: state.currentIndex + 1 };
        });
      },

      prevQuestion: () => {
        set((state) => {
          if (state.currentIndex <= 0) {
            return state;
          }
          return { currentIndex: state.currentIndex - 1 };
        });
      },

      goToQuestion: (index) => {
        set((state) => {
          if (index < 0 || index >= state.questions.length) {
            return state;
          }
          return { currentIndex: index };
        });
      },

      submitAnswer: () => {
        // 标记答案已提交（可以扩展为记录到历史）
        // 当前实现保持与原有逻辑一致
      },

      finishQuiz: () => {
        set({ 
          isComplete: true, 
          showResult: true,
          hasStarted: false,
        });
      },

      restartQuiz: () => {
        set((state) => ({
          currentIndex: 0,
          answers: {},
          showResult: false,
          timeSpent: 0,
          isComplete: false,
          hasStarted: true,
          preloadIndex: -1,
        }));
      },

      resetQuiz: () => {
        set({
          ...initialState,
          isLoading: false,
        });
      },

      // ==================== 状态更新 ====================
      
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setHasStarted: (started) => set({ hasStarted: started }),
      
      incrementTime: () => {
        set((state) => ({
          timeSpent: state.timeSpent + 1,
        }));
      },

      updatePreloadIndex: (index) => {
        set({ preloadIndex: index });
      },

      // ==================== 计算属性获取器 ====================
      
      getCurrentQuestion: () => {
        const state = get();
        if (state.questions.length === 0) return null;
        return state.questions[state.currentIndex] || null;
      },

      getCurrentAnswer: () => {
        const state = get();
        const currentQuestion = state.getCurrentQuestion();
        if (!currentQuestion) return undefined;
        return state.answers[currentQuestion.id];
      },

      getIsAnswerCorrect: () => {
        const state = get();
        const currentQuestion = state.getCurrentQuestion();
        const currentAnswer = state.getCurrentAnswer();
        
        if (!currentQuestion || !currentAnswer) return false;
        
        const correctAnswer = currentQuestion.answer;
        if (Array.isArray(correctAnswer)) {
          return Array.isArray(currentAnswer) && 
            correctAnswer.every(a => currentAnswer.includes(a)) &&
            currentAnswer.every(a => correctAnswer.includes(a));
        }
        return String(currentAnswer).toLowerCase() === String(correctAnswer).toLowerCase();
      },

      getProgress: () => {
        const state = get();
        const total = state.questions.length;
        const current = state.currentIndex + 1;
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        return { current, total, percent };
      },

      getStats: () => {
        const state = get();
        let correct = 0;
        let wrong = 0;
        let unanswered = 0;

        state.questions.forEach((q) => {
          const answer = state.answers[q.id];
          const isUnanswered = 
            answer === undefined || 
            answer === '' || 
            (Array.isArray(answer) && answer.length === 0);

          if (isUnanswered) {
            unanswered++;
          } else {
            const correctAnswer = q.answer;
            let isCorrect = false;

            if (q.type === 'fill-blank') {
              isCorrect = String(answer) === String(correctAnswer);
            } else if (Array.isArray(correctAnswer)) {
              const userAnswer = Array.isArray(answer) 
                ? answer.sort() 
                : [String(answer).toLowerCase()];
              const sortedCorrect = correctAnswer.map(a => String(a).toLowerCase()).sort();
              isCorrect = userAnswer.length === sortedCorrect.length && 
                userAnswer.every((a, i) => a === sortedCorrect[i]);
            } else {
              isCorrect = String(answer).toLowerCase() === String(correctAnswer).toLowerCase();
            }

            if (isCorrect) correct++;
            else wrong++;
          }
        });

        const totalAnswered = correct + wrong;
        const accuracy = totalAnswered > 0 ? Math.round((correct / totalAnswered) * 100) : 0;

        return { correct, wrong, unanswered, accuracy };
      },
    }),
    {
      name: 'quiz-store',
      storage: createJSONStorage(() => localStorage),
      // 只持久化关键数据
      partialize: (state) => ({
        answers: state.answers,
        timeSpent: state.timeSpent,
        mode: state.mode,
      }),
    }
  )
);

// ==================== 辅助函数 ====================

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ==================== Selector Hooks ====================

// 性能优化的 selector hooks
export const useCurrentQuestion = () => 
  useQuizStore((state) => state.getCurrentQuestion());

export const useCurrentAnswer = () => 
  useQuizStore((state) => state.getCurrentAnswer());

export const useProgress = () => 
  useQuizStore((state) => state.getProgress());

export const useQuizStats = () => 
  useQuizStore((state) => state.getStats());
