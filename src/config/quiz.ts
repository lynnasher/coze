/**
 * 刷题应用配置常量
 */

// 淡雅色调（题库卡片背景渐变）
export const BANK_COLORS = {
  purple: 'from-slate-400 to-slate-500',
  green: 'from-stone-400 to-stone-500',
  blue: 'from-gray-400 to-gray-500',
  orange: 'from-zinc-400 to-zinc-500',
  pink: 'from-neutral-400 to-neutral-500',
  red: 'from-slate-500 to-stone-500',
} as const;

// 题型标签颜色
export const TYPE_COLORS = {
  single: 'bg-indigo-500',
  multiple: 'bg-purple-500',
  'true-false': 'bg-cyan-500',
  comprehensive: 'bg-rose-500',
  'fill-blank': 'bg-teal-500',
} as const;

// 题型名称
export const TYPE_NAMES = {
  single: '单选题',
  multiple: '多选题',
  'true-false': '判断题',
  comprehensive: '综合题',
  'fill-blank': '填空题',
} as const;

// 难度颜色
export const DIFFICULTY_COLORS = {
  easy: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  hard: 'bg-red-100 text-red-700 border-red-200',
} as const;

// 难度名称
export const DIFFICULTY_NAMES = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
} as const;

// 分类颜色映射
export const CATEGORY_COLORS = {
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  yellow: 'bg-amber-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  indigo: 'bg-indigo-500',
  cyan: 'bg-cyan-500',
} as const;

// 练习模式
export const PRACTICE_MODES = {
  sequential: { label: '顺序练习', value: 'sequential' },
  random: { label: '随机练习', value: 'random' },
  wrong: { label: '错题重练', value: 'wrong' },
} as const;

// 统计卡片配置
export const STATS_CARDS = {
  totalQuestions: { label: '总题数', icon: 'FileText', gradient: 'from-blue-500 to-indigo-500' },
  correctRate: { label: '正确率', icon: 'Trophy', gradient: 'from-emerald-500 to-teal-500' },
  streakDays: { label: '连续天数', icon: 'Flame', gradient: 'from-orange-500 to-amber-500' },
  todayProgress: { label: '今日进度', icon: 'Target', gradient: 'from-purple-500 to-pink-500' },
} as const;

// 缓存配置
export const CACHE_KEYS = {
  BANKS: 'quiz_banks',
  CATEGORIES: 'quiz_categories',
  PRACTICE_RECORDS: 'practice_records',
  WRONG_QUESTIONS: 'wrong_questions',
  STUDY_STREAK: 'study_streak',
  USER_PREFERENCES: 'user_preferences',
} as const;

// API 配置
export const API_CONFIG = {
  DEVICE_VALIDATION_INTERVAL: 30000, // 30秒
  SYNC_INTERVAL: 60000, // 1分钟
  CLOUD_SYNC_DEBOUNCE: 5000, // 5秒
} as const;

// 用户类型
export type ColorType = keyof typeof BANK_COLORS;
export type QuestionType = keyof typeof TYPE_NAMES;
export type DifficultyType = keyof typeof DIFFICULTY_NAMES;
