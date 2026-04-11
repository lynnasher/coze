// 题库类型定义

export type QuestionType = 'single' | 'multiple' | 'true-false' | 'fill-blank';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type PracticeMode = 'sequential' | 'random' | 'wrong';

export interface QuizOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  content: string;
  options?: QuizOption[];
  answer: string | string[];
  explanation?: string;
  tags: string[];
  difficulty: Difficulty;
  createdAt: number;
  bankId?: string; // 关联的题库ID
}

export interface PracticeRecord {
  id: string;
  questionId: string;
  isCorrect: boolean;
  selectedAnswer: string | string[];
  timestamp: number;
}

export interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  sourceFile?: string; // 来源文件名
  questionIds: string[];
  createdAt: number;
  updatedAt: number;
  totalQuestions?: number; // 缓存的题目数量
}

export interface QuizState {
  questions: Question[];
  currentIndex: number;
  answers: Record<string, string | string[]>;
  showResult: boolean;
  mode: PracticeMode;
  timeSpent: number;
  isComplete: boolean;
}

export interface Stats {
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  practiceHistory: PracticeRecord[];
  wrongQuestions: string[];
  streak: number;
}

export interface ParsedQuestion {
  type: QuestionType;
  content: string;
  options?: QuizOption[];
  answer: string | string[];
  explanation?: string;
  difficulty: Difficulty;
}
