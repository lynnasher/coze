/**
 * 后台管理模块类型定义
 */

// 题库
export interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  questionIds: string[];
  createdAt: number;
  categoryId?: string;
  questionCount?: number;
  correctRate?: number;
  sourceFile?: string;
  status?: string;
}

// 分类
export interface Category {
  id: string;
  name: string;
  color: string;
  order: number;
  parentId?: string;
  createdAt?: number;
  depth?: number;
}

// 统计
export interface AdminStats {
  totalBanks: number;
  totalQuestions: number;
}

// 题目
export interface Question {
  id: string;
  parentId?: string;
  type: 'single' | 'multiple' | 'true-false' | 'fill-blank' | 'comprehensive';
  content: string;
  options?: { id: string; text: string }[];
  answer: string | string[];
  explanation?: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: number;
  bankId?: string;
  caseBackground?: string;
  caseContext?: string;
  status?: string;
}

// 分类颜色选项
export const categoryColors = [
  { value: 'blue', label: '蓝色' },
  { value: 'green', label: '绿色' },
  { value: 'red', label: '红色' },
  { value: 'yellow', label: '黄色' },
  { value: 'purple', label: '紫色' },
  { value: 'pink', label: '粉色' },
  { value: 'indigo', label: '靛蓝' },
  { value: 'cyan', label: '青色' },
];

// 存储 Keys
export const STORAGE_KEYS = {
  QUESTIONS: 'quiz_questions',
  BANKS: 'quiz_banks',
  CATEGORIES: 'quiz_categories',
};
