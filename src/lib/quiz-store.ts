import { Question, PracticeRecord, QuestionBank, Stats } from './types';

const STORAGE_KEYS = {
  QUESTIONS: 'quiz_questions',
  RECORDS: 'quiz_records',
  BANKS: 'quiz_banks',
  STATS: 'quiz_stats',
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

  getWrongQuestionIds: (): string[] => {
    const records = recordStore.getAll();
    const wrongMap = new Map<string, number>();
    
    records.forEach(record => {
      if (!record.isCorrect) {
        wrongMap.set(record.questionId, (wrongMap.get(record.questionId) || 0) + 1);
      }
    });
    
    return Array.from(wrongMap.keys());
  },

  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.RECORDS);
  },
};

// 题库管理
export const bankStore = {
  getAll: (): QuestionBank[] => {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BANKS);
      return data ? JSON.parse(data) : [];
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

  add: (bank: QuestionBank) => {
    const banks = bankStore.getAll();
    banks.push(bank);
    bankStore.save(banks);
    return bank;
  },

  remove: (id: string) => {
    const banks = bankStore.getAll().filter(b => b.id !== id);
    bankStore.save(banks);
    return banks;
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
  
  const wrongQuestions = recordStore.getWrongQuestionIds();
  
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

// 初始化示例数据
export const initSampleQuestions = () => {
  if (questionStore.getAll().length > 0) return;
  
  const sampleQuestions: Question[] = [
    {
      id: generateId(),
      type: 'single',
      content: 'JavaScript 中，以下哪个关键字用于声明一个常量？',
      options: [
        { id: 'a', text: 'var' },
        { id: 'b', text: 'let' },
        { id: 'c', text: 'const' },
        { id: 'd', text: 'constant' },
      ],
      answer: 'c',
      explanation: '在 JavaScript 中，使用 const 关键字声明常量，其值在声明后不能被重新赋值。',
      tags: ['JavaScript', '基础'],
      difficulty: 'easy',
      createdAt: Date.now(),
    },
    {
      id: generateId(),
      type: 'single',
      content: '以下哪个方法可以将 JavaScript 数组的所有元素连接成一个字符串？',
      options: [
        { id: 'a', text: 'concat()' },
        { id: 'b', text: 'join()' },
        { id: 'c', text: 'merge()' },
        { id: 'd', text: 'combine()' },
      ],
      answer: 'b',
      explanation: 'join() 方法将数组的所有元素连接成一个字符串，可指定分隔符。',
      tags: ['JavaScript', '数组'],
      difficulty: 'easy',
      createdAt: Date.now(),
    },
    {
      id: generateId(),
      type: 'multiple',
      content: '以下哪些是 React Hooks？（多选）',
      options: [
        { id: 'a', text: 'useState' },
        { id: 'b', text: 'useEffect' },
        { id: 'c', text: 'useContext' },
        { id: 'd', text: 'useClass' },
      ],
      answer: ['a', 'b', 'c'],
      explanation: 'React 16.8 引入的 Hooks 包括 useState, useEffect, useContext 等。useClass 不是 React Hook。',
      tags: ['React', 'Hooks'],
      difficulty: 'medium',
      createdAt: Date.now(),
    },
    {
      id: generateId(),
      type: 'true-false',
      content: 'TypeScript 是 JavaScript 的超集。',
      options: [
        { id: 'true', text: '正确' },
        { id: 'false', text: '错误' },
      ],
      answer: 'true',
      explanation: 'TypeScript 添加了类型系统和其他特性，是 JavaScript 的超集，所有 JavaScript 代码都是有效的 TypeScript 代码。',
      tags: ['TypeScript'],
      difficulty: 'easy',
      createdAt: Date.now(),
    },
    {
      id: generateId(),
      type: 'fill-blank',
      content: '在 React 中，用于渲染列表时，每个元素都应该有一个唯一的 _____ 属性。',
      options: [],
      answer: 'key',
      explanation: 'key 帮助 React 识别哪些元素改变了（如添加、删除或重新排序），从而提高渲染性能。',
      tags: ['React'],
      difficulty: 'medium',
      createdAt: Date.now(),
    },
    {
      id: generateId(),
      type: 'single',
      content: 'CSS Flexbox 中，哪个属性用于定义主轴的方向？',
      options: [
        { id: 'a', text: 'flex-direction' },
        { id: 'b', text: 'flex-wrap' },
        { id: 'c', text: 'flex-flow' },
        { id: 'd', text: 'justify-content' },
      ],
      answer: 'a',
      explanation: 'flex-direction 属性定义了主轴的方向，可以是 row、row-reverse、column 或 column-reverse。',
      tags: ['CSS', 'Flexbox'],
      difficulty: 'medium',
      createdAt: Date.now(),
    },
    {
      id: generateId(),
      type: 'single',
      content: '以下哪个 HTTP 方法通常用于更新资源？',
      options: [
        { id: 'a', text: 'GET' },
        { id: 'b', text: 'POST' },
        { id: 'c', text: 'PUT' },
        { id: 'd', text: 'DELETE' },
      ],
      answer: 'c',
      explanation: 'PUT 方法通常用于更新现有资源，POST 用于创建新资源。',
      tags: ['HTTP', 'API'],
      difficulty: 'easy',
      createdAt: Date.now(),
    },
    {
      id: generateId(),
      type: 'multiple',
      content: '以下哪些方法可以创建 JavaScript 数组？（多选）',
      options: [
        { id: 'a', text: '[]' },
        { id: 'b', text: 'new Array()' },
        { id: 'c', text: 'Array.from()' },
        { id: 'd', text: 'Array.make()' },
      ],
      answer: ['a', 'b', 'c'],
      explanation: 'JavaScript 中可以使用字面量 []、new Array() 构造函数和 Array.from() 方法创建数组。',
      tags: ['JavaScript', '数组'],
      difficulty: 'medium',
      createdAt: Date.now(),
    },
    {
      id: generateId(),
      type: 'true-false',
      content: 'Next.js 只能用于创建静态网站。',
      options: [
        { id: 'true', text: '正确' },
        { id: 'false', text: '错误' },
      ],
      answer: 'false',
      explanation: 'Next.js 支持静态生成（SSG）和服务端渲染（SSR），也可以创建动态应用。',
      tags: ['Next.js'],
      difficulty: 'medium',
      createdAt: Date.now(),
    },
    {
      id: generateId(),
      type: 'single',
      content: '以下哪个是 Tailwind CSS 的特点？',
      options: [
        { id: 'a', text: '原子化 CSS' },
        { id: 'b', text: '组件化 CSS' },
        { id: 'c', text: 'CSS-in-JS' },
        { id: 'd', text: 'CSS Modules' },
      ],
      answer: 'a',
      explanation: 'Tailwind CSS 是一个原子化 CSS 框架，通过组合小粒度的工具类来构建样式。',
      tags: ['CSS', 'Tailwind'],
      difficulty: 'easy',
      createdAt: Date.now(),
    },
  ];
  
  questionStore.save(sampleQuestions);
};
