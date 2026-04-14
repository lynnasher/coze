// 题库类型定义

export type QuestionType = 'single' | 'multiple' | 'true-false' | 'fill-blank' | 'comprehensive';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type PracticeMode = 'sequential' | 'random' | 'wrong';

export interface QuizOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  parentId?: string; // 父题目ID（综合案例题的子题目）
  type: QuestionType;
  content: string;
  options?: QuizOption[];
  answer: string | string[];
  explanation?: string;
  tags: string[];
  difficulty: Difficulty;
  createdAt: number;
  bankId?: string; // 关联的题库ID
  // 综合案例题相关字段
  caseBackground?: string; // 案例背景（综合题大题描述）
  caseContext?: string; // 案例上下文/材料
}

export interface PracticeRecord {
  id: string;
  questionId: string;
  isCorrect: boolean;
  selectedAnswer: string | string[];
  timestamp: number;
}

// 错题记忆状态
export type MemoryLevel = 'forgot' | 'learning' | 'mastered';

export interface WrongQuestionStats {
  questionId: string;
  wrongCount: number;      // 错误次数
  correctCount: number;    // 正确次数
  memoryLevel: MemoryLevel; // 记忆状态
  lastReviewed: number;    // 上次复习时间
  nextReview: number;      // 下次复习时间（基于间隔重复）
  lastWrongAnswer: string | string[]; // 上次错误答案
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
