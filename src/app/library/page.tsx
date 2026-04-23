'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Search, Lock, Play, Check, ChevronDown, ChevronUp, Bookmark, Clock, Zap, Tag, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Category, QuestionBank, getCurrentUser } from '@/lib/quiz-store';

// ==================== 类型 ====================

interface BankWithCategory {
  bank: QuestionBank;
  categoryName: string;
}

// ==================== 辅助函数 ====================

async function cachedFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const cacheKey = `cache_${url}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* ignore */ }
  }
  const response = await fetch(url, options);
  const data = await response.json();
  try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* ignore */ }
  return data;
}

// ==================== 主组件 ====================

export default function LibraryPage() {
  const router = useRouter();
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activatedCategories, setActivatedCategories] = useState<string[]>([]);
  const [activationCode, setActivationCode] = useState('');
  const [activatingCategory, setActivatingCategory] = useState<string | null>(null);
  const [showActivationInput, setShowActivationInput] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [userActivations, setUserActivations] = useState<string[]>([]);

  const isFirstRender = useRef(true);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 获取分类和题库数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [banksData, categoriesData] = await Promise.all([
        cachedFetch<{ banks: QuestionBank[] }>('/api/admin/banks'),
        cachedFetch<{ categories: Category[] }>('/api/admin/categories'),
      ]);
      setBanks(banksData.banks || []);
      setCategories(categoriesData.categories || []);

      // 获取用户已激活分类
      const user = getCurrentUser();
      if (user) {
        setCurrentUser(user);
        try {
          const token = localStorage.getItem('quiz_user_token');
          const resp = await fetch('/api/auth/user/activations', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.success) {
              setUserActivations(data.activatedCategories || []);
            }
          }
        } catch {}
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      loadData();
    }
  }, [loadData]);

  // 防抖刷新
  const refreshData = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      sessionStorage.removeItem('cache_/api/admin/banks');
      sessionStorage.removeItem('cache_/api/admin/categories');
      loadData();
    }, 500);
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  // 分类展开/折叠
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // 检查分类是否需要激活
  const isCategoryLocked = (categoryId: string): boolean => {
    if (!currentUser) return true;
    if (userActivations.includes(categoryId)) return false;
    // 检查是否是顶级分类（需要激活子分类中的任意一个）
    const subCats = categories.filter(c => c.parentId === categoryId);
    if (subCats.length > 0) {
      return !subCats.some(sc => userActivations.includes(sc.id));
    }
    return true;
  };

  // 激活分类
  const activateCategory = async (categoryId: string) => {
    const code = activationCode.trim();
    if (!code) return;

    setActivatingCategory(categoryId);
    try {
      const token = localStorage.getItem('quiz_user_token');
      const response = await fetch('/api/activation-codes/use', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code, userId: currentUser?.id }),
      });

      const data = await response.json();
      if (data.success) {
        setUserActivations(prev => [...prev, data.activation.category_id]);
        setActivationCode('');
        setShowActivationInput(null);
        // 刷新数据
        refreshData();
      } else {
        alert(data.error || '激活失败');
      }
    } catch (error) {
      alert('激活请求失败');
    } finally {
      setActivatingCategory(null);
    }
  };

  // 开始练习
  const handleStartPractice = (bankId: string, mode: 'sequential' | 'random' = 'sequential') => {
    // 保存到 localStorage，首页会自动读取
    localStorage.setItem('quiz_start_pending', JSON.stringify({ bankId, mode }));
    router.push('/');
  };

  // 过滤题库
  const filteredBanks = banks.filter(bank => {
    const matchesSearch = !searchQuery || bank.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || bank.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // 按分类分组的题库
  const banksByCategory = categories
    .filter(c => !c.parentId)
    .map(cat => {
      const subCategories = categories.filter(sc => sc.parentId === cat.id);
      const allCatIds = [cat.id, ...subCategories.map(sc => sc.id)];
      const catBanks = filteredBanks.filter(b => allCatIds.includes(b.categoryId || ''));
      return { category: cat, subCategories, banks: catBanks };
    })
    .filter(item => item.banks.length > 0);

  // 未分类题库
  const uncategorizedBanks = filteredBanks.filter(b => !b.categoryId || !categories.some(c => c.id === b.categoryId));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[970px] mx-auto px-4 pt-4 pb-24">
      {/* 页面标题 */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-500" />
          题库浏览
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          共 {banks.length} 个题库，{banks.reduce((sum, b) => sum + (b.questionCount || b.questionIds?.length || 0), 0)} 道题目
        </p>
      </div>

      {/* 搜索框 */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="搜索题库..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* 分类筛选标签 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            !selectedCategory
              ? 'bg-indigo-500 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          全部
        </button>
        {categories.filter(c => !c.parentId).map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              selectedCategory === cat.id
                ? 'bg-indigo-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* 题库列表 - 按分类分组 */}
      <div className="space-y-3">
        {banksByCategory.map(({ category, subCategories, banks: catBanks }) => {
          const isExpanded = expandedCategories.has(category.id);
          const locked = isCategoryLocked(category.id);
          return (
            <div key={category.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              {/* 分类标题 */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${category.color || 'bg-slate-100'}`}>
                    <Tag className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-slate-800">{category.name}</h3>
                    <p className="text-xs text-slate-500">
                      {catBanks.length} 个题库 · {catBanks.reduce((sum, b) => sum + (b.questionCount || b.questionIds?.length || 0), 0)} 题
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {locked && currentUser && (
                    <Lock className="w-4 h-4 text-amber-500" />
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>

              {/* 展开的题库列表 */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  {subCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {subCategories.map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => setSelectedCategory(selectedCategory === sub.id ? '' : sub.id)}
                          className={`text-xs px-2 py-1 rounded-md transition-colors ${
                            selectedCategory === sub.id
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {catBanks.map(bank => (
                    <div
                      key={bank.id}
                      className="flex items-center justify-between p-3 bg-slate-50/50 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-800 text-sm truncate">{bank.name}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {bank.questionCount || bank.questionIds?.length || 0} 题
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        {locked && currentUser ? (
                          <>
                            {showActivationInput === bank.id ? (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  value={activationCode}
                                  onChange={(e) => setActivationCode(e.target.value)}
                                  placeholder="输入激活码"
                                  className="w-28 h-8 text-xs"
                                />
                                <Button
                                  size="sm"
                                  className="h-8 px-2 text-xs bg-indigo-500 hover:bg-indigo-600"
                                  onClick={() => activateCategory(bank.categoryId || category.id)}
                                  disabled={activatingCategory === bank.categoryId || !activationCode.trim()}
                                >
                                  {activatingCategory === bank.categoryId ? '...' : '激活'}
                                </Button>
                                <button
                                  onClick={() => {
                                    setShowActivationInput(null);
                                    setActivationCode('');
                                  }}
                                  className="text-xs text-slate-400 hover:text-slate-600"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowActivationInput(bank.id)}
                                className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                激活
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-xs"
                              onClick={() => handleStartPractice(bank.id, 'sequential')}
                            >
                              <Bookmark className="w-3 h-3 mr-1" />
                              顺序
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 px-2.5 text-xs bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                              onClick={() => handleStartPractice(bank.id, 'random')}
                            >
                              <Zap className="w-3 h-3 mr-1" />
                              随机
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* 未分类题库 */}
        {uncategorizedBanks.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="p-4">
              <h3 className="font-semibold text-slate-800 mb-3">未分类</h3>
              <div className="space-y-2">
                {uncategorizedBanks.map(bank => (
                  <div
                    key={bank.id}
                    className="flex items-center justify-between p-3 bg-slate-50/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-800 text-sm">{bank.name}</h4>
                      <span className="text-xs text-slate-500">
                        {bank.questionCount || bank.questionIds?.length || 0} 题
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 ml-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => handleStartPractice(bank.id, 'sequential')}
                      >
                        <Bookmark className="w-3 h-3 mr-1" />
                        顺序
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 px-2.5 text-xs bg-gradient-to-r from-indigo-500 to-purple-500"
                        onClick={() => handleStartPractice(bank.id, 'random')}
                      >
                        <Zap className="w-3 h-3 mr-1" />
                        随机
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {banksByCategory.length === 0 && uncategorizedBanks.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">暂无题库</p>
          </div>
        )}
      </div>
    </div>
  );
}
