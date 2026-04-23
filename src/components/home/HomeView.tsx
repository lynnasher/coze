/**
 * HomeView - 首页视图组件
 * 包含题库列表、分类筛选、快速入口等
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QuestionBank, Category, PracticeMode } from '@/lib/types';
import { HomeHeader } from './HomeHeader';
import { CategoryFilter } from './CategoryFilter';
import { BankList } from './BankList';
import { AuthModal } from '@/components/AuthModal';
import { BANK_COLORS } from '@/config';

interface HomeViewProps {
  initialBanks?: QuestionBank[];
  initialCategories?: Category[];
}

export function HomeView({ initialBanks = [], initialCategories = [] }: HomeViewProps) {
  const router = useRouter();
  
  // 数据状态
  const [banks, setBanks] = useState<QuestionBank[]>(initialBanks);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [filteredBanks, setFilteredBanks] = useState<QuestionBank[]>(initialBanks);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(!initialBanks.length);
  
  // 用户状态
  const [user, setUser] = useState<{ id: string; phone: string; nickname?: string; role: string } | null>(null);
  const [streakDays, setStreakDays] = useState(0);
  
  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // 加载题库
        const banksRes = await fetch('/api/admin/banks');
        const banksData = await banksRes.json();
        setBanks(banksData.banks || []);
        setFilteredBanks(banksData.banks || []);
        
        // 加载分类
        const catsRes = await fetch('/api/admin/categories');
        const catsData = await catsRes.json();
        setCategories(catsData.categories || []);
        
        // 加载用户信息
        const userData = localStorage.getItem('user-storage');
        if (userData) {
          const parsed = JSON.parse(userData);
          if (parsed.state?.user) {
            setUser(parsed.state.user);
          }
        }
        
        // 加载连续天数
        const streakData = localStorage.getItem('study_streak');
        if (streakData) {
          const parsed = JSON.parse(streakData);
          setStreakDays(parsed.currentStreak || 0);
        }
      } catch (err) {
        console.error('加载数据失败:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  // 筛选题库
  useEffect(() => {
    let filtered = banks;
    
    // 分类筛选
    if (selectedCategory) {
      filtered = filtered.filter(b => b.categoryId === selectedCategory);
    }
    
    // 搜索筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        b.name.toLowerCase().includes(query)
      );
    }
    
    setFilteredBanks(filtered);
  }, [banks, selectedCategory, searchQuery]);
  
  // 计算总题数
  const totalQuestions = banks.reduce((sum, bank) => 
    sum + (bank.questionIds?.length || 0), 0
  );
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* 头部 */}
      <HomeHeader 
        user={user}
        totalQuestions={totalQuestions}
        streakDays={streakDays}
      />
      
      {/* 分类筛选 */}
      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onSelect={setSelectedCategory}
      />
      
      {/* 题库列表 */}
      <BankList
        banks={filteredBanks}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onRefresh={async () => {
          setIsLoading(true);
          try {
            const res = await fetch('/api/admin/banks');
            const data = await res.json();
            setBanks(data.banks || []);
          } finally {
            setIsLoading(false);
          }
        }}
        onSearchChange={setSearchQuery}
      />
    </div>
  );
}
