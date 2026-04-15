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
};

// 题目管理
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

// 修改 getWrongQuestionIds 函数：只返回真正答错过的题目，且连续正确次数未达3次
export const getWrongQuestionIds = (): string[] => {
  const records = recordStore.getAll();
  const streaks = wrongStreakStore.getAll();
  
  // 收集所有答错过的题目ID
  const wrongQuestions = new Set<string>();
  records.forEach(record => {
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
