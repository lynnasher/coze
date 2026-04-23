/**
 * Quiz Storage - 刷题数据持久化封装
 * 统一管理练习记录、错题本、学习进度等数据的存储
 */

import { StorageProvider, getStorage } from './storage-provider';
import { PracticeRecord, QuestionBank } from '@/lib/types';

const STORAGE_KEYS = {
  PRACTICE_RECORDS: 'practice_records',
  WRONG_QUESTIONS: 'wrong_questions',
  LEARNING_PROGRESS: 'learning_progress',
  STUDY_STREAK: 'study_streak',
  BANKS: 'banks',
  CATEGORIES: 'categories',
};

// ==================== 练习记录 ====================

export interface PracticeRecordData {
  id: string;
  questionId: string;
  bankId: string;
  isCorrect: boolean;
  selectedAnswer: string | string[];
  timestamp: number;
  consecutiveCorrect?: number; // 连续正确次数
}

export async function savePracticeRecord(record: PracticeRecordData): Promise<void> {
  const storage = getStorage<PracticeRecordData[]>();
  const records = await storage.get(STORAGE_KEYS.PRACTICE_RECORDS) || [];
  records.push(record);
  
  // 只保留最近 1000 条记录
  if (records.length > 1000) {
    records.shift();
  }
  
  await storage.set(STORAGE_KEYS.PRACTICE_RECORDS, records);
}

export async function getPracticeRecords(
  questionId?: string,
  limit: number = 100
): Promise<PracticeRecordData[]> {
  const storage = getStorage<PracticeRecordData[]>();
  const records = await storage.get(STORAGE_KEYS.PRACTICE_RECORDS) || [];
  
  let filtered = records;
  if (questionId) {
    filtered = records.filter(r => r.questionId === questionId);
  }
  
  return filtered
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export async function getLatestPracticeRecord(
  questionId: string
): Promise<PracticeRecordData | null> {
  const records = await getPracticeRecords(questionId, 1);
  return records[0] || null;
}

// ==================== 错题本 ====================

export interface WrongQuestionData {
  questionId: string;
  bankId: string;
  wrongCount: number;
  lastWrongAt: number;
  consecutiveCorrect: number; // 连续正确次数
  isMastered: boolean; // 是否已掌握（连续正确3次）
}

export async function addWrongQuestion(
  questionId: string,
  bankId: string
): Promise<void> {
  const storage = getStorage<WrongQuestionData[]>();
  const wrongQuestions = await storage.get(STORAGE_KEYS.WRONG_QUESTIONS) || [];
  
  const existing = wrongQuestions.find(w => w.questionId === questionId);
  if (existing) {
    existing.wrongCount++;
    existing.lastWrongAt = Date.now();
    existing.consecutiveCorrect = 0;
    existing.isMastered = false;
  } else {
    wrongQuestions.push({
      questionId,
      bankId,
      wrongCount: 1,
      lastWrongAt: Date.now(),
      consecutiveCorrect: 0,
      isMastered: false,
    });
  }
  
  await storage.set(STORAGE_KEYS.WRONG_QUESTIONS, wrongQuestions);
}

export async function markQuestionCorrect(
  questionId: string
): Promise<void> {
  const storage = getStorage<WrongQuestionData[]>();
  const wrongQuestions = await storage.get(STORAGE_KEYS.WRONG_QUESTIONS) || [];
  
  const existing = wrongQuestions.find(w => w.questionId === questionId);
  if (existing) {
    existing.consecutiveCorrect++;
    // 连续正确3次，标记为已掌握
    if (existing.consecutiveCorrect >= 3) {
      existing.isMastered = true;
    }
    await storage.set(STORAGE_KEYS.WRONG_QUESTIONS, wrongQuestions);
  }
}

export async function getWrongQuestions(
  options: {
    bankId?: string;
    onlyUnmastered?: boolean;
    limit?: number;
  } = {}
): Promise<WrongQuestionData[]> {
  const storage = getStorage<WrongQuestionData[]>();
  let wrongQuestions = await storage.get(STORAGE_KEYS.WRONG_QUESTIONS) || [];
  
  if (options.bankId) {
    wrongQuestions = wrongQuestions.filter(w => w.bankId === options.bankId);
  }
  
  if (options.onlyUnmastered) {
    wrongQuestions = wrongQuestions.filter(w => !w.isMastered);
  }
  
  // 按错题次数和最近错误时间排序
  wrongQuestions.sort((a, b) => {
    if (a.wrongCount !== b.wrongCount) {
      return b.wrongCount - a.wrongCount;
    }
    return b.lastWrongAt - a.lastWrongAt;
  });
  
  if (options.limit) {
    wrongQuestions = wrongQuestions.slice(0, options.limit);
  }
  
  return wrongQuestions;
}

export async function removeWrongQuestion(questionId: string): Promise<void> {
  const storage = getStorage<WrongQuestionData[]>();
  const wrongQuestions = await storage.get(STORAGE_KEYS.WRONG_QUESTIONS) || [];
  const filtered = wrongQuestions.filter(w => w.questionId !== questionId);
  await storage.set(STORAGE_KEYS.WRONG_QUESTIONS, filtered);
}

// ==================== 学习进度 ====================

export interface LearningProgress {
  bankId: string;
  completedCount: number;
  totalCount: number;
  correctCount: number;
  lastStudyAt: number;
  accuracy: number;
}

export async function updateLearningProgress(
  bankId: string,
  stats: {
    totalCount: number;
    correctCount: number;
  }
): Promise<void> {
  const storage = getStorage<Record<string, LearningProgress>>();
  const progresses = await storage.get(STORAGE_KEYS.LEARNING_PROGRESS) || {};
  
  const existing = progresses[bankId];
  const completedCount = (existing?.completedCount || 0) + 1;
  
  progresses[bankId] = {
    bankId,
    completedCount,
    totalCount: stats.totalCount,
    correctCount: (existing?.correctCount || 0) + (stats.correctCount > 0 ? 1 : 0),
    lastStudyAt: Date.now(),
    accuracy: Math.round((completedCount / stats.totalCount) * 100),
  };
  
  await storage.set(STORAGE_KEYS.LEARNING_PROGRESS, progresses);
}

export async function getLearningProgress(bankId: string): Promise<LearningProgress | null> {
  const storage = getStorage<Record<string, LearningProgress>>();
  const progresses = await storage.get(STORAGE_KEYS.LEARNING_PROGRESS) || {};
  return progresses[bankId] || null;
}

export async function getAllLearningProgress(): Promise<LearningProgress[]> {
  const storage = getStorage<Record<string, LearningProgress>>();
  const progresses = await storage.get(STORAGE_KEYS.LEARNING_PROGRESS) || {};
  return Object.values(progresses).sort((a, b) => b.lastStudyAt - a.lastStudyAt);
}

// ==================== 连续学习天数 ====================

export interface StudyStreak {
  currentStreak: number;
  maxStreak: number;
  lastStudyDate: string; // YYYY-MM-DD
  weeklyProgress: boolean[]; // 本周7天的学习状态
}

export async function updateStudyStreak(): Promise<StudyStreak> {
  const storage = getStorage<StudyStreak>();
  const streak = await storage.get(STORAGE_KEYS.STUDY_STREAK) || {
    currentStreak: 0,
    maxStreak: 0,
    lastStudyDate: '',
    weeklyProgress: [false, false, false, false, false, false, false],
  };
  
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  // 如果今天已经学习过，直接返回
  if (streak.lastStudyDate === today) {
    return streak;
  }
  
  // 更新连续天数
  if (streak.lastStudyDate === yesterday) {
    streak.currentStreak++;
  } else if (streak.lastStudyDate !== today) {
    streak.currentStreak = 1;
  }
  
  // 更新最大连续天数
  if (streak.currentStreak > streak.maxStreak) {
    streak.maxStreak = streak.currentStreak;
  }
  
  streak.lastStudyDate = today;
  
  // 更新本周进度
  const dayOfWeek = new Date().getDay();
  const weekIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 周一为0
  streak.weeklyProgress[weekIndex] = true;
  
  await storage.set(STORAGE_KEYS.STUDY_STREAK, streak);
  return streak;
}

export async function getStudyStreak(): Promise<StudyStreak> {
  const storage = getStorage<StudyStreak>();
  return await storage.get(STORAGE_KEYS.STUDY_STREAK) || {
    currentStreak: 0,
    maxStreak: 0,
    lastStudyDate: '',
    weeklyProgress: [false, false, false, false, false, false, false],
  };
}

// ==================== 题库数据缓存 ====================

export async function cacheBanks(banks: QuestionBank[]): Promise<void> {
  const storage = getStorage<QuestionBank[]>();
  await storage.set(STORAGE_KEYS.BANKS, banks);
}

export async function getCachedBanks(): Promise<QuestionBank[]> {
  const storage = getStorage<QuestionBank[]>();
  return await storage.get(STORAGE_KEYS.BANKS) || [];
}

// ==================== 清理数据 ====================

export async function clearAllQuizData(): Promise<void> {
  const storage = getStorage();
  for (const key of Object.values(STORAGE_KEYS)) {
    await storage.remove(key);
  }
}
