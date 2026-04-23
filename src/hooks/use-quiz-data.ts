/**
 * useQuizData - 题库数据管理 Hook
 * 处理题库加载、分类筛选等逻辑
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Question, QuestionBank, Category, PracticeMode } from '@/lib/types';
import { bankStore } from '@/lib/quiz-store';

interface UseQuizDataOptions {
  autoLoad?: boolean;
}

interface UseQuizDataReturn {
  // 数据状态
  banks: QuestionBank[];
  categories: Category[];
  filteredBanks: QuestionBank[];
  selectedCategory: string | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  
  // 操作方法
  setSelectedCategory: (categoryId: string | null) => void;
  setSearchQuery: (query: string) => void;
  loadBanks: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadQuestionsForBank: (bankId: string, mode: PracticeMode) => Promise<Question[]>;
  refreshBanks: () => Promise<void>;
  
  // 统计信息
  totalQuestions: number;
  categoryCount: number;
}

export function useQuizData(options: UseQuizDataOptions = {}): UseQuizDataReturn {
  const { autoLoad = true } = options;
  
  // 数据状态
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 加载题库列表
  const loadBanks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/banks');
      if (!response.ok) throw new Error('获取题库列表失败');
      const data = await response.json();
      const banksList = data.banks || [];
      setBanks(banksList);
      // 保存到本地 store
      bankStore.save(banksList);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
      // 降级：使用本地数据
      const localBanks = bankStore.getAll();
      setBanks(localBanks);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // 加载分类列表
  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/categories');
      if (!response.ok) throw new Error('获取分类列表失败');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('加载分类失败:', err);
      setCategories([]);
    }
  }, []);
  
  // 加载题库中的题目
  const loadQuestionsForBank = useCallback(async (
    bankId: string, 
    _mode: PracticeMode
  ): Promise<Question[]> => {
    const response = await fetch(`/api/admin/banks/${bankId}/questions`);
    if (!response.ok) throw new Error('获取题目失败');
    
    const data = await response.json();
    let questions: Question[] = data.questions || [];
    
    // 随机模式打乱顺序
    // if (_mode === 'random') {
    //   questions = shuffleArray(questions);
    // }
    
    return questions;
  }, []);
  
  // 刷新题库
  const refreshBanks = useCallback(async () => {
    await loadBanks();
  }, [loadBanks]);
  
  // 自动加载数据
  useEffect(() => {
    if (autoLoad) {
      loadBanks();
      loadCategories();
    }
  }, [autoLoad, loadBanks, loadCategories]);
  
  // 过滤后的题库
  const filteredBanks = banks.filter(bank => {
    // 分类筛选
    if (selectedCategory && bank.categoryId !== selectedCategory) {
      return false;
    }
    // 搜索筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return bank.name.toLowerCase().includes(query);
    }
    return true;
  });
  
  // 统计信息
  const totalQuestions = banks.reduce((sum, bank) => sum + (bank.questionIds?.length || 0), 0);
  const categoryCount = categories.length;
  
  return {
    banks,
    categories,
    filteredBanks,
    selectedCategory,
    searchQuery,
    isLoading,
    error,
    setSelectedCategory,
    setSearchQuery,
    loadBanks,
    loadCategories,
    loadQuestionsForBank,
    refreshBanks,
    totalQuestions,
    categoryCount,
  };
}

// 辅助函数：随机打乱数组
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
