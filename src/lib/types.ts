// 题库类型定义

export type QuestionType = 'single' | 'multiple' | 'true-false' | 'fill-blank' | 'comprehensive';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type PracticeMode = 'sequential' | 'random' | 'wrong' | 'wrongbook';

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
  children?: Question[]; // 综合题的子题目
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
  categoryId?: string; // 分类ID
  questionIds: string[];
  createdAt: number;
  updatedAt: number;
  totalQuestions?: number; // 缓存的题目数量
}

export interface Category {
  id: string;
  name: string;
  color: string;
  order: number;
  parentId?: string; // 父分类ID，如果为空则是顶级分类
  createdAt?: number;
}

export interface QuizState {
  questions: Question[];
  currentIndex: number;
  answers: Record<string, string | string[]>;
  showResult: boolean;
  mode: PracticeMode;
  timeSpent: number;
  isComplete: boolean;
  bankId?: string;     // 当前练习的题库ID
  bankName?: string;   // 当前练习的题库名称
  categoryId?: string; // 当前练习的分类ID
  categoryName?: string; // 当前练习的分类名称
}

export interface CategoryStat {
  categoryId: string;
  categoryName: string;
  totalCount: number;
  correctCount: number;
  accuracy: number;
  color?: string;
}

export interface DailyStat {
  date: string; // YYYY-MM-DD
  count: number;
  correctCount: number;
}

export interface LearningStreak {
  currentStreak: number; // 当前连续学习天数
  longestStreak: number; // 最长连续学习天数
  lastStudyDate: string | null; // 最后学习日期 YYYY-MM-DD
  weeklyGoal: number; // 周目标（天）
  weeklyProgress: number; // 本周进度（天）
}

export interface Stats {
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  practiceHistory: PracticeRecord[];
  wrongQuestions: string[];
  streak: number; // 连续正确次数
  // 新增统计维度
  learningStreak: LearningStreak; // 学习连续天数
  categoryStats: CategoryStat[]; // 分类统计
  dailyStats: DailyStat[]; // 每日统计（近30天）
  totalTimeSpent: number; // 总学习时长（分钟）
  avgQuestionsPerDay: number; // 日均做题数
}

export interface ParsedQuestion {
  type: QuestionType;
  content: string;
  options?: QuizOption[];
  answer: string | string[];
  explanation?: string;
  difficulty: Difficulty;
}

// 用户相关类型
export interface User {
  id: string;
  phone: string;        // 手机号（唯一标识）
  nickname?: string;    // 昵称
  avatar?: string;      // 头像 URL
  password: string;     // 密码（加密存储）
  createdAt: number;
  lastLoginAt?: number;
  role: 'user' | 'admin';  // 用户角色
  status: 'active' | 'banned';  // 账号状态
  activatedCategories?: string[];  // 用户激活的分类ID列表
}

// 用户会话
export interface UserSession {
  userId: string;
  token: string;
  expiresAt: number;
}
