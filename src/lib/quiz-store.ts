import { Question, PracticeRecord, QuestionBank, Stats, WrongQuestionStats, MemoryLevel, Category } from './types';

// 统一存储 Keys - 前后台共用
const STORAGE_KEYS = {
  QUESTIONS: 'quiz_questions',
  RECORDS: 'quiz_records',
  BANKS: 'quiz_banks',
  STATS: 'quiz_stats',
  WRONG_STATS: 'quiz_wrong_stats', // 错题记忆状态
  WRONG_STREAK: 'quiz_wrong_streak', // 错题连续正确次数
  CATEGORIES: 'quiz_categories',
  RECENT_PRACTICE: 'quiz_recent_practice', // 最近练习记录
};

// 获取当前用户 ID（从 localStorage 的 token 中解析）
export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('user_token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token));
    return payload.userId || null;
  } catch {
    return null;
  }
}

// ==================== API 数据缓存层 ====================
// 缓存有效期配置（毫秒）
export const CACHE_TTL = {
  BANKS: 5 * 60 * 1000,      // 题库列表缓存 5 分钟
  CATEGORIES: 5 * 60 * 1000, // 分类缓存 5 分钟
  QUESTIONS: 2 * 60 * 1000,  // 题目缓存 2 分钟
  USER: 1 * 60 * 1000,       // 用户信息缓存 1 分钟
};

// 缓存 key 生成器
export const getCacheKey = (prefix: string, id?: string): string => {
  return id ? `${prefix}_${id}` : prefix;
};

// 带缓存的 fetch 封装
export async function cachedFetch<T>(
  url: string,
  cacheKey: string,
  ttlMs: number = CACHE_TTL.QUESTIONS
): Promise<{ data: T | null; fromCache: boolean }> {
  // 检查缓存
  const cached = cacheStore.get<T>(cacheKey);
  if (cached) {
    return { data: cached, fromCache: true };
  }
  
  // 发起请求
  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      // 存入缓存
      cacheStore.set(cacheKey, data, ttlMs);
      return { data, fromCache: false };
    }
  } catch (error) {
    // 请求失败
  }
  
  return { data: null, fromCache: false };
}

// ==================== API 请求去重 ====================
const pendingRequests = new Map<string, Promise<unknown>>();

export async function deduplicatedFetch<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
  // 如果已有相同 key 的请求正在进行，返回该请求的 Promise
  const existing = pendingRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  
  // 创建新请求
  const requestPromise = fetchFn().finally(() => {
    // 请求完成后移除
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, requestPromise);
  return requestPromise;
}

// 带超时控制的 fetch 封装（默认 10 秒超时）
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 缓存失效
export function invalidateCache(keys: string[]): void {
  keys.forEach(key => cacheStore.remove(key));
}

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheStore {
  get<T>(key: string): T | null;
  set<T>(key: string, data: T, ttlMs?: number): void;
  remove(key: string): void;
  clear(): void;
}

// 内存缓存（页面刷新后失效，但同会话内可复用）
const memoryCache = new Map<string, CacheItem<unknown>>();
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 内存缓存 5 分钟

export const cacheStore: CacheStore = {
  get<T>(key: string): T | null {
    // 先检查内存缓存
    const memItem = memoryCache.get(key);
    if (memItem && memItem.expiresAt > Date.now()) {
      return memItem.data as T;
    }
    
    // 再检查 localStorage
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(`cache_${key}`);
      if (data) {
        const item = JSON.parse(data) as CacheItem<T>;
        if (item.expiresAt > Date.now()) {
          // 回填内存缓存
          memoryCache.set(key, item);
          return item.data;
        } else {
          localStorage.removeItem(`cache_${key}`);
        }
      }
    } catch {}
    return null;
  },

  set<T>(key: string, data: T, ttlMs: number = MEMORY_CACHE_TTL): void {
    const now = Date.now();
    const item: CacheItem<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttlMs,
    };
    
    // 设置内存缓存
    memoryCache.set(key, item);
    
    // 设置 localStorage 缓存
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`cache_${key}`, JSON.stringify(item));
      } catch (e) {
        // 缓存写入失败
      }
    }
  },

  remove(key: string): void {
    memoryCache.delete(key);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`cache_${key}`);
    }
  },

  clear(): void {
    memoryCache.clear();
    if (typeof window !== 'undefined') {
      Object.keys(localStorage)
        .filter(k => k.startsWith('cache_'))
        .forEach(k => localStorage.removeItem(k));
    }
  },
};

// ==================== 题目预加载管理 ====================
interface PreloadState {
  questions: Map<string, Question>; // 预加载的题目
  lastPreloadIndex: number;          // 上次预加载到的位置
}

const preloadState: PreloadState = {
  questions: new Map(),
  lastPreloadIndex: -1,
};

// 预加载题目（批量获取）
export const preloadQuestions = async (questionIds: string[]): Promise<void> => {
  const uncachedIds = questionIds.filter(id => !preloadState.questions.has(id));
  if (uncachedIds.length === 0) return;
  
  try {
    const response = await fetch('/api/questions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: uncachedIds }),
    });
    if (response.ok) {
      const data = await response.json();
      data.questions?.forEach((q: Question) => {
        preloadState.questions.set(q.id, q);
      });
    }
  } catch (e) {
    // 预加载失败
  }
};

// 获取预加载的题目
export const getPreloadedQuestion = (id: string): Question | undefined => {
  return preloadState.questions.get(id);
};

// 清除预加载缓存
export const clearPreloadCache = (): void => {
  preloadState.questions.clear();
  preloadState.lastPreloadIndex = -1;
};

// ==================== 防抖工具 ====================
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ==================== 题目管理 ====================
export const questionStore = {
  getAll: (): Question[] => {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  save: (questions: Question[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    } catch (e) {
      console.error('保存失败:', e);
    }
  },

  add: (question: Question) => {
    const questions = questionStore.getAll();
    questions.push(question);
    questionStore.save(questions);
    return question;
  },

  addMultiple: (newQuestions: Question[]) => {
    const questions = questionStore.getAll();
    questions.push(...newQuestions);
    questionStore.save(questions);
    return questions;
  },

  remove: (id: string) => {
    const questions = questionStore.getAll().filter(q => q.id !== id);
    questionStore.save(questions);
    return questions;
  },

  getById: (id: string): Question | undefined => {
    return questionStore.getAll().find(q => q.id === id);
  },

  update: (question: Question): Question => {
    const questions = questionStore.getAll();
    const index = questions.findIndex(q => q.id === question.id);
    if (index !== -1) {
      questions[index] = question;
      questionStore.save(questions);
    }
    return question;
  },

  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.QUESTIONS);
  },
};

// 练习记录管理
export const recordStore = {
  getAll: (): PracticeRecord[] => {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  save: (records: PracticeRecord[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
    } catch (e) {
      console.error('保存失败:', e);
    }
  },

  add: (record: PracticeRecord) => {
    const records = recordStore.getAll();
    records.push(record);
    recordStore.save(records);
    return record;
  },

  getByQuestionId: (questionId: string): PracticeRecord[] => {
    return recordStore.getAll().filter(r => r.questionId === questionId);
  },

  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.RECORDS);
  },
};

// 错题连续正确次数管理
export const wrongStreakStore = {
  // 获取所有错题的连续正确次数
  getAll: (): Record<string, number> => {
    if (typeof window === 'undefined') return {};
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WRONG_STREAK);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  // 保存所有错题的连续正确次数
  save: (streaks: Record<string, number>) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.WRONG_STREAK, JSON.stringify(streaks));
    } catch (e) {
      console.error('保存错题连续正确次数失败:', e);
    }
  },

  // 获取某道题的连续正确次数
  get: (questionId: string): number => {
    return wrongStreakStore.getAll()[questionId] || 0;
  },

  // 增加某道题的连续正确次数（答对）
  increment: (questionId: string): number => {
    const streaks = wrongStreakStore.getAll();
    streaks[questionId] = (streaks[questionId] || 0) + 1;
    wrongStreakStore.save(streaks);
    return streaks[questionId];
  },

  // 重置某道题的连续正确次数（答错）
  reset: (questionId: string) => {
    const streaks = wrongStreakStore.getAll();
    delete streaks[questionId];
    wrongStreakStore.save(streaks);
  },

  // 删除某道题的记录（移出错题本）
  remove: (questionId: string) => {
    wrongStreakStore.reset(questionId);
  },

  // 清空所有
  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.WRONG_STREAK);
  },
};

// 修改 getWrongQuestionIds 函数：只返回真正答错过的题目（排除空答题记录），且连续正确次数未达3次
export const getWrongQuestionIds = (): string[] => {
  const records = recordStore.getAll();
  const streaks = wrongStreakStore.getAll();
  
  // 收集所有答错过的题目ID（只统计真正作答过的题目，排除空答题记录）
  const wrongQuestions = new Set<string>();
  records.forEach(record => {
    // 排除空答题记录（没有实际作答过的题目）
    if (!record.selectedAnswer) return;
    const answer = Array.isArray(record.selectedAnswer) ? record.selectedAnswer : String(record.selectedAnswer);
    if (answer.length === 0) return;
    
    if (!record.isCorrect) {
      wrongQuestions.add(record.questionId);
    }
  });
  
  // 返回错题中连续正确次数未达3次的题目
  return Array.from(wrongQuestions).filter(qId => (streaks[qId] || 0) < 3);
};

// 题库管理
export const bankStore = {
  getAll: (): QuestionBank[] => {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BANKS);
      const banks = data ? JSON.parse(data) : [];
      // 更新每个题库的题目数量
      return banks.map((bank: QuestionBank) => ({
        ...bank,
        totalQuestions: bank.questionIds.length,
      }));
    } catch {
      return [];
    }
  },

  save: (banks: QuestionBank[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.BANKS, JSON.stringify(banks));
    } catch (e) {
      console.error('保存失败:', e);
    }
  },

  getById: (id: string): QuestionBank | undefined => {
    return bankStore.getAll().find(b => b.id === id);
  },

  create: (name: string, sourceFile?: string): QuestionBank => {
    const bank: QuestionBank = {
      id: generateId(),
      name,
      sourceFile,
      questionIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalQuestions: 0,
    };
    const banks = bankStore.getAll();
    banks.push(bank);
    bankStore.save(banks);
    return bank;
  },

  // 创建题库（使用指定的ID）
  createWithId: (id: string, name: string, sourceFile?: string): QuestionBank => {
    const bank: QuestionBank = {
      id,
      name,
      sourceFile,
      questionIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalQuestions: 0,
    };
    const banks = bankStore.getAll();
    banks.push(bank);
    bankStore.save(banks);
    return bank;
  },

  // 更新题库
  update: (bank: QuestionBank): QuestionBank => {
    const banks = bankStore.getAll();
    const bankIndex = banks.findIndex(b => b.id === bank.id);
    if (bankIndex === -1) {
      // 如果不存在则添加
      banks.push({ ...bank, updatedAt: Date.now() });
    } else {
      banks[bankIndex] = { ...bank, updatedAt: Date.now() };
    }
    bankStore.save(banks);
    return bank;
  },

  addQuestions: (bankId: string, questionIds: string[]): QuestionBank | undefined => {
    const banks = bankStore.getAll();
    const bankIndex = banks.findIndex(b => b.id === bankId);
    if (bankIndex === -1) return undefined;
    
    // 添加题目ID，去重
    const existingIds = new Set(banks[bankIndex].questionIds);
    questionIds.forEach(id => existingIds.add(id));
    
    banks[bankIndex] = {
      ...banks[bankIndex],
      questionIds: Array.from(existingIds),
      updatedAt: Date.now(),
      totalQuestions: Array.from(existingIds).length,
    };
    bankStore.save(banks);
    return banks[bankIndex];
  },

  remove: (id: string) => {
    // 删除题库时同时删除关联的题目
    const bank = bankStore.getById(id);
    if (bank) {
      const questions = questionStore.getAll();
      const filteredQuestions = questions.filter(q => !bank.questionIds.includes(q.id));
      questionStore.save(filteredQuestions);
    }
    const banks = bankStore.getAll().filter(b => b.id !== id);
    bankStore.save(banks);
    return banks;
  },

  removeQuestions: (bankId: string, questionIds: string[]) => {
    const banks = bankStore.getAll();
    const bankIndex = banks.findIndex(b => b.id === bankId);
    if (bankIndex === -1) return undefined;
    
    const questionIdSet = new Set(questionIds);
    const remainingIds = banks[bankIndex].questionIds.filter(id => !questionIdSet.has(id));
    
    // 同时删除题目
    const questions = questionStore.getAll();
    const filteredQuestions = questions.filter(q => !questionIdSet.has(q.id));
    questionStore.save(filteredQuestions);
    
    banks[bankIndex] = {
      ...banks[bankIndex],
      questionIds: remainingIds,
      updatedAt: Date.now(),
      totalQuestions: remainingIds.length,
    };
    bankStore.save(banks);
    return banks[bankIndex];
  },

  merge: (sourceBankId: string, targetBankId: string): QuestionBank | undefined => {
    const sourceBank = bankStore.getById(sourceBankId);
    const targetBank = bankStore.getById(targetBankId);
    if (!sourceBank || !targetBank) return undefined;
    
    // 将源题库的题目合并到目标题库
    const existingIds = new Set(targetBank.questionIds);
    sourceBank.questionIds.forEach(id => existingIds.add(id));
    
    const banks = bankStore.getAll();
    const targetIndex = banks.findIndex(b => b.id === targetBankId);
    
    banks[targetIndex] = {
      ...banks[targetIndex],
      questionIds: Array.from(existingIds),
      updatedAt: Date.now(),
      totalQuestions: Array.from(existingIds).length,
    };
    bankStore.save(banks);
    
    // 删除源题库
    bankStore.remove(sourceBankId);
    
    return banks[targetIndex];
  },

  rename: (id: string, newName: string): QuestionBank | undefined => {
    const banks = bankStore.getAll();
    const bankIndex = banks.findIndex(b => b.id === id);
    if (bankIndex === -1) return undefined;
    
    banks[bankIndex] = {
      ...banks[bankIndex],
      name: newName,
      updatedAt: Date.now(),
    };
    bankStore.save(banks);
    return banks[bankIndex];
  },

  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.BANKS);
  },
};

// 统计计算
export const calculateStats = (): Stats => {
  const records = recordStore.getAll();
  const questions = questionStore.getAll();
  
  const correctCount = records.filter(r => r.isCorrect).length;
  const wrongCount = records.filter(r => !r.isCorrect).length;
  const totalAttempts = records.length;
  
  const accuracy = totalAttempts > 0 
    ? Math.round((correctCount / totalAttempts) * 100) 
    : 0;
  
  const wrongQuestions = getWrongQuestionIds();
  
  // 计算连续正确次数
  let streak = 0;
  const sortedRecords = [...records].sort((a, b) => b.timestamp - a.timestamp);
  for (const record of sortedRecords) {
    if (record.isCorrect) {
      streak++;
    } else {
      break;
    }
  }
  
  return {
    totalQuestions: questions.length,
    correctCount,
    wrongCount,
    accuracy,
    practiceHistory: records,
    wrongQuestions,
    streak,
  };
};

// 生成唯一ID
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ==================== 云端数据同步服务 ====================
export interface CloudSyncStatus {
  lastSyncTime: number | null;
  isSyncing: boolean;
  error: string | null;
}

// 云端同步状态
const syncStatus: CloudSyncStatus = {
  lastSyncTime: null,
  isSyncing: false,
  error: null,
};

// 获取用户ID（从 localStorage）
const getUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const userData = localStorage.getItem('quiz_user_data');
    if (userData) {
      const user = JSON.parse(userData);
      return user.id || null;
    }
  } catch {}
  return null;
};

// 云端同步服务
export const cloudSyncService = {
  // 获取同步状态
  getStatus: (): CloudSyncStatus => ({ ...syncStatus }),

  // 保存练习记录到云端
  async saveRecords(userId: string, records: PracticeRecord[]): Promise<boolean> {
    try {
      const response = await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_records',
          userId,
          data: { records },
        }),
      });
      return response.ok;
    } catch (error) {
      console.error('保存记录到云端失败:', error);
      return false;
    }
  },

  // 保存错题连续正确次数到云端
  async saveStreaks(userId: string, streaks: Record<string, number>): Promise<boolean> {
    try {
      const response = await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_streaks',
          userId,
          data: { streaks },
        }),
      });
      return response.ok;
    } catch (error) {
      console.error('保存错题次数到云端失败:', error);
      return false;
    }
  },

  // 保存最近练习记录到云端
  async saveRecentPractice(userId: string, practice: RecentPractice): Promise<boolean> {
    try {
      const response = await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_recent',
          userId,
          data: practice,
        }),
      });
      return response.ok;
    } catch (error) {
      console.error('保存最近练习到云端失败:', error);
      return false;
    }
  },

  // 从云端拉取数据
  async pullData(userId: string): Promise<{
    records: PracticeRecord[];
    streaks: Record<string, number>;
    recentPractices: RecentPractice[];
  } | null> {
    try {
      // 并行获取所有数据
      const [recordsRes, streaksRes, recentRes] = await Promise.all([
        fetch(`/api/user-data?userId=${userId}&type=records`),
        fetch(`/api/user-data?userId=${userId}&type=streaks`),
        fetch(`/api/user-data?userId=${userId}&type=recent`),
      ]);

      const [recordsData, streaksData, recentData] = await Promise.all([
        recordsRes.json(),
        streaksRes.json(),
        recentRes.json(),
      ]);

      // 转换云端记录格式为前端格式
      const records: PracticeRecord[] = (recordsData.records || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        questionId: r.question_id as string,
        isCorrect: r.is_correct as boolean,
        selectedAnswer: r.selected_answer ? (r.selected_answer as string).split(',') : '',
        timestamp: new Date(r.timestamp as string).getTime(),
      }));

      const streaks: Record<string, number> = {};
      (streaksData.streaks || []).forEach((s: Record<string, unknown>) => {
        streaks[s.question_id as string] = s.streak as number;
      });

      const recentPractices: RecentPractice[] = (recentData.recentPractices || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        bankId: r.bank_id as string,
        bankName: r.bank_name as string,
        mode: r.mode as 'sequential' | 'random' | 'wrong',
        totalCount: r.total_count as number,
        answeredCount: r.answered_count as number,
        correctCount: r.correct_count as number,
        wrongCount: r.wrong_count as number,
        currentIndex: r.current_index as number,
        isCompleted: r.is_completed as boolean,
        startedAt: new Date(r.started_at as string).getTime(),
        lastPracticeAt: new Date(r.last_practice_at as string).getTime(),
      }));

      return { records, streaks, recentPractices };
    } catch (error) {
      console.error('从云端拉取数据失败:', error);
      return null;
    }
  },

  // 合并并同步所有数据
  async syncAll(userId: string): Promise<boolean> {
    if (syncStatus.isSyncing) return false;

    syncStatus.isSyncing = true;
    syncStatus.error = null;

    try {
      // 获取本地数据
      const localRecords = recordStore.getAll();
      const localStreaks = wrongStreakStore.getAll();
      const localRecentPractices = recentPracticeStore.getAll();

      // 调用合并接口
      const response = await fetch('/api/user-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          localRecords,
          localStreaks,
          localRecentPractices,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // 更新本地数据
          if (result.data.records?.length > 0) {
            recordStore.save(result.data.records);
          }
          if (result.data.streaks && Object.keys(result.data.streaks).length > 0) {
            wrongStreakStore.save(result.data.streaks);
          }
          if (result.data.recentPractices?.length > 0) {
            recentPracticeStore.save(result.data.recentPractices);
          }
        }

        syncStatus.lastSyncTime = Date.now();
        return true;
      }

      syncStatus.error = '同步失败';
      return false;
    } catch (error) {
      console.error('云端同步失败:', error);
      syncStatus.error = '网络错误';
      return false;
    } finally {
      syncStatus.isSyncing = false;
    }
  },

  // 登录后自动同步（拉取云端数据并合并）
  async syncOnLogin(): Promise<boolean> {
    const userId = getUserId();
    if (!userId) return false;

    return this.syncAll(userId);
  },
};

// 初始化示例数据（已禁用）
export const initSampleQuestions = () => {
  // 不再预置示例题目，用户需要导入题库
};

// 错题记忆状态管理
const INTERVALS = {
  forgot: 0,      // 忘记：立即复习
  learning: 1,   // 学习中：1天后
  mastered: 3,   // 已掌握：3天后
};

export const wrongStatsStore = {
  // 获取所有错题统计
  getAll: (): WrongQuestionStats[] => {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WRONG_STATS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // 保存所有错题统计
  save: (stats: WrongQuestionStats[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.WRONG_STATS, JSON.stringify(stats));
    } catch (e) {
      console.error('保存错题统计失败:', e);
    }
  },

  // 获取单个错题的统计
  getById: (questionId: string): WrongQuestionStats | undefined => {
    return wrongStatsStore.getAll().find(s => s.questionId === questionId);
  },

  // 更新错题答题结果
  updateResult: (questionId: string, isCorrect: boolean, wrongAnswer?: string | string[]) => {
    const stats = wrongStatsStore.getAll();
    const index = stats.findIndex(s => s.questionId === questionId);
    
    if (index === -1) {
      // 新增
      if (!isCorrect) {
        stats.push({
          questionId,
          wrongCount: 1,
          correctCount: 0,
          memoryLevel: 'forgot',
          lastReviewed: Date.now(),
          nextReview: Date.now(),
          lastWrongAnswer: wrongAnswer || '',
        });
      }
    } else {
      // 更新
      if (isCorrect) {
        stats[index].correctCount++;
        // 根据正确次数更新记忆水平
        if (stats[index].correctCount >= 3) {
          stats[index].memoryLevel = 'mastered';
          stats[index].nextReview = Date.now() + INTERVALS.mastered * 24 * 60 * 60 * 1000;
        } else if (stats[index].correctCount >= 1) {
          stats[index].memoryLevel = 'learning';
          stats[index].nextReview = Date.now() + INTERVALS.learning * 24 * 60 * 60 * 1000;
        }
      } else {
        stats[index].wrongCount++;
        stats[index].memoryLevel = 'forgot';
        stats[index].nextReview = Date.now(); // 立即复习
        stats[index].lastWrongAnswer = wrongAnswer || '';
      }
      stats[index].lastReviewed = Date.now();
    }
    
    wrongStatsStore.save(stats);
  },

  // 重置单道题的统计
  reset: (questionId: string) => {
    const stats = wrongStatsStore.getAll().filter(s => s.questionId !== questionId);
    wrongStatsStore.save(stats);
  },

  // 重置所有错题统计
  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.WRONG_STATS);
  },

  // 获取需要复习的错题（基于间隔重复）
  getForReview: (): WrongQuestionStats[] => {
    const now = Date.now();
    return wrongStatsStore.getAll().filter(s => s.nextReview <= now);
  },

  // 获取统计摘要
  getSummary: () => {
    const stats = wrongStatsStore.getAll();
    return {
      total: stats.length,
      forgot: stats.filter(s => s.memoryLevel === 'forgot').length,
      learning: stats.filter(s => s.memoryLevel === 'learning').length,
      mastered: stats.filter(s => s.memoryLevel === 'mastered').length,
      dueReview: wrongStatsStore.getForReview().length,
    };
  },
};

// 分类管理（支持二级分类）
export const categoryStore = {
  // 获取所有分类
  getAll: (): Category[] => {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // 保存所有分类
  save: (categories: Category[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch (e) {
      console.error('保存分类失败:', e);
    }
  },

  // 获取顶级分类
  getRootCategories: (): Category[] => {
    return categoryStore.getAll().filter(c => !c.parentId).sort((a, b) => a.order - b.order);
  },

  // 获取子分类
  getChildCategories: (parentId: string): Category[] => {
    return categoryStore.getAll().filter(c => c.parentId === parentId).sort((a, b) => a.order - b.order);
  },

  // 获取分类（包括父分类信息）
  getWithParent: (): (Category & { parentName?: string })[] => {
    const categories = categoryStore.getAll();
    return categories.map(c => {
      if (c.parentId) {
        const parent = categories.find(p => p.id === c.parentId);
        return { ...c, parentName: parent?.name };
      }
      return c;
    }).sort((a, b) => a.order - b.order);
  },

  // 添加分类
  add: (category: Omit<Category, 'id'>): Category => {
    const categories = categoryStore.getAll();
    const newCategory: Category = {
      ...category,
      id: generateId(),
      createdAt: Date.now(),
    };
    categories.push(newCategory);
    categoryStore.save(categories);
    return newCategory;
  },

  // 更新分类
  update: (category: Category): Category => {
    const categories = categoryStore.getAll();
    const index = categories.findIndex(c => c.id === category.id);
    if (index !== -1) {
      categories[index] = category;
      categoryStore.save(categories);
    }
    return category;
  },

  // 删除分类（同时删除子分类）
  remove: (id: string) => {
    const categories = categoryStore.getAll();
    // 获取所有要删除的分类ID（包括子分类）
    const idsToDelete = new Set<string>();
    idsToDelete.add(id);
    // 查找所有子分类
    const children = categories.filter(c => c.parentId === id);
    children.forEach(child => {
      idsToDelete.add(child.id);
      // 递归查找子分类
      const grandchildren = categories.filter(c => c.parentId === child.id);
      grandchildren.forEach(gc => idsToDelete.add(gc.id));
    });
    
    const filteredCategories = categories.filter(c => !idsToDelete.has(c.id));
    categoryStore.save(filteredCategories);
    
    // 将该分类下的题库移至未分类
    const banks = bankStore.getAll();
    const updatedBanks = banks.map(b => {
      if (idsToDelete.has(b.categoryId || '')) {
        return { ...b, categoryId: undefined };
      }
      return b;
    });
    bankStore.save(updatedBanks);
    
    return filteredCategories;
  },

  // 清除所有分类
  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
  },
};

// 最近练习记录类型
export interface RecentPractice {
  id: string;
  bankId: string;           // 题库ID
  bankName: string;         // 题库名称
  categoryId?: string;      // 分类ID
  categoryName?: string;     // 分类名称
  mode: 'sequential' | 'random' | 'wrong';
  totalCount: number;       // 总题数
  currentIndex: number;     // 当前进度
  answeredCount: number;    // 已答题数
  correctCount: number;     // 正确数
  wrongCount: number;       // 错误数
  startedAt: number;        // 开始时间
  lastPracticeAt: number;   // 最后练习时间
  isCompleted: boolean;      // 是否已完成
}

// 最近练习记录管理
export const recentPracticeStore = {
  // 获取最近练习记录
  getAll: (): RecentPractice[] => {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECENT_PRACTICE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // 保存所有记录
  save: (practices: RecentPractice[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.RECENT_PRACTICE, JSON.stringify(practices));
    } catch (e) {
      console.error('保存最近练习失败:', e);
    }
  },

  // 添加或更新练习记录
  update: (practice: Omit<RecentPractice, 'id'>): RecentPractice => {
    const practices = recentPracticeStore.getAll();
    const existingIndex = practices.findIndex(p => p.bankId === practice.bankId && p.mode === practice.mode);
    
    const newPractice: RecentPractice = {
      ...practice,
      id: existingIndex >= 0 ? practices[existingIndex].id : generateId(),
    };

    if (existingIndex >= 0) {
      practices[existingIndex] = newPractice;
    } else {
      // 新增：放在最前面
      practices.unshift(newPractice);
      // 只保留最近10条
      if (practices.length > 10) {
        practices.pop();
      }
    }
    
    recentPracticeStore.save(practices);
    return newPractice;
  },

  // 获取最近的练习记录（用于首页显示）
  getRecent: (limit: number = 3): RecentPractice[] => {
    return recentPracticeStore.getAll()
      .sort((a, b) => b.lastPracticeAt - a.lastPracticeAt)
      .slice(0, limit);
  },

  // 根据题库ID获取记录
  getByBankId: (bankId: string): RecentPractice | undefined => {
    return recentPracticeStore.getAll().find(p => p.bankId === bankId);
  },

  // 删除记录
  remove: (id: string) => {
    const practices = recentPracticeStore.getAll().filter(p => p.id !== id);
    recentPracticeStore.save(practices);
  },

  // 清除所有记录
  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.RECENT_PRACTICE);
  },
};
