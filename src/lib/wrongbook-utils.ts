/**
 * 错题本工具函数
 * 提取错题本页面中的共享逻辑
 */

import type { Question } from './types';

// 题型标签映射
export const TYPE_LABELS: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  'true-false': '判断题',
  comprehensive: '综合题',
  'fill-blank': '填空题',
};

// 题型颜色映射
export const TYPE_COLORS: Record<string, string> = {
  single: 'bg-indigo-500',
  multiple: 'bg-purple-500',
  'true-false': 'bg-cyan-500',
  comprehensive: 'bg-rose-500',
  'fill-blank': 'bg-teal-500',
};

/**
 * 检查答案是否正确
 */
export function checkAnswer(
  question: Question,
  userAnswer: string | string[] | undefined
): boolean {
  if (!userAnswer || userAnswer === '' || (Array.isArray(userAnswer) && userAnswer.length === 0)) {
    return false;
  }

  const correctAnswer = question.answer;

  // 填空题直接比较
  if (question.type === 'fill-blank') {
    return String(userAnswer).trim() === String(correctAnswer).trim();
  }

  // 多选题处理
  if (Array.isArray(correctAnswer)) {
    const userAnswers = Array.isArray(userAnswer) 
      ? userAnswer.map(a => String(a).toLowerCase().trim())
      : [String(userAnswer).toLowerCase().trim()];
    const correctAnswers = correctAnswer.map(a => String(a).toLowerCase().trim());
    
    return userAnswers.length === correctAnswers.length &&
      userAnswers.every(a => correctAnswers.includes(a));
  }

  // 单选/判断题
  return String(userAnswer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
}

/**
 * 获取选项样式
 */
export function getOptionStyle(
  isSelected: boolean,
  isCorrect: boolean,
  showExplanation: boolean
): string {
  if (isSelected && showExplanation) {
    return isCorrect ? 'bg-emerald-50' : 'bg-red-50';
  }
  if (isSelected) return 'bg-indigo-50';
  if (showExplanation && isCorrect) return 'bg-emerald-50';
  return 'bg-slate-50/50';
}

/**
 * 获取选项标识样式
 */
export function getOptionBadgeStyle(
  isSelected: boolean,
  isCorrect: boolean,
  showExplanation: boolean
): string {
  if (isSelected && showExplanation) {
    return isCorrect 
      ? 'bg-emerald-500 text-white' 
      : 'bg-red-500 text-white';
  }
  if (isSelected) return 'bg-indigo-500 text-white';
  return 'bg-slate-200 text-slate-600';
}

/**
 * 检查选项是否选中
 */
export function isOptionSelected(
  optionId: string,
  userAnswer: string | string[] | undefined,
  isMulti: boolean
): boolean {
  if (isMulti) {
    return Array.isArray(userAnswer) && userAnswer.includes(optionId);
  }
  return userAnswer === optionId;
}

/**
 * 检查是否为正确答案
 */
export function isCorrectAnswer(
  optionId: string,
  correctAnswer: string | string[] | undefined
): boolean {
  if (!correctAnswer) return false;
  if (Array.isArray(correctAnswer)) {
    return correctAnswer.includes(optionId);
  }
  return correctAnswer === optionId;
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 格式化答案显示
 */
export function formatAnswer(answer: string | string[] | undefined): string {
  if (!answer) return '';
  if (Array.isArray(answer)) {
    return answer.join(', ').toUpperCase();
  }
  return String(answer).toUpperCase();
}

/**
 * 计算掌握进度
 */
export function calculateMasteryProgress(streak: number): number {
  return Math.min((streak / 3) * 100, 100);
}

/**
 * 获取掌握状态文本
 */
export function getMasteryStatus(streak: number): { text: string; color: string } {
  if (streak >= 3) {
    return { text: '已掌握', color: 'text-emerald-600' };
  } else if (streak === 2) {
    return { text: '即将掌握', color: 'text-amber-600' };
  } else if (streak === 1) {
    return { text: '练习中', color: 'text-orange-600' };
  }
  return { text: '需加强', color: 'text-red-600' };
}
