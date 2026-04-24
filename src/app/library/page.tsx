'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Library, 
  User, 
  BookOpen,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TopNav } from '@/components/TopNav';
import { BankCard } from '@/components/BankCard';
import { AuthModal } from '@/components/AuthModal';
import { useUserStore } from '@/lib/store';
import { Category, QuestionBank, User as UserType } from '@/lib/types';
import { Loader2 } from 'lucide-react';

// 直接从 localStorage 读取用户状态，避免 Zustand hydration 时序问题
const getStoredUser = (): { user: UserType | null; token: string | null } => {
  try {
    const token = localStorage.getItem('quiz_user_token');
    const userData = localStorage.getItem('quiz_user_data');
    
    if (!token || !userData) {
      return { user: null, token: null };
    }
    
    const parsedUser = JSON.parse(userData);
    const user: UserType = {
      ...parsedUser,
      activatedCategories: parsedUser.activated_categories || [],
    };
    
    return { user, token };
  } catch {
    return { user: null, token: null };
  }
};

export default function LibraryPage() {
  const router = useRouter();
  const { login } = useUserStore();
  
  // 使用本地状态追踪，确保客户端渲染正确
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // 初始化 - 客户端挂载后检查登录状态
  useEffect(() => {
    const stored = getStoredUser();
    setIsLoggedIn(!!stored.user && !!stored.token);
    setCurrentUser(stored.user);
    setMounted(true);
    
    // 如果有存储的用户数据，同步到 Zustand
    if (stored.user && stored.token) {
      login(stored.user, stored.token);
    }
  }, [login]);

  // 加载题库数据（仅当登录时）
  const loadData = useCallback(async () => {
    if (!isLoggedIn) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      const [banksRes, categoriesRes] = await Promise.all([
        fetch('/api/banks'),
        fetch('/api/categories'),
      ]);

      if (banksRes.ok) {
        const banksData = await banksRes.json();
        setBanks(banksData.banks || []);
      }

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.categories || []);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (mounted) {
      loadData();
    }
  }, [mounted, loadData]);

  // 登录成功回调
  const handleAuthSuccess = () => {
    const stored = getStoredUser();
    setIsLoggedIn(true);
    setCurrentUser(stored.user);
    if (stored.user && stored.token) {
      login(stored.user, stored.token);
    }
    setAuthModalOpen(false);
    loadData();
  };

  // 开始练习
  const handleStartPractice = (bankId: string) => {
    if (!isLoggedIn) {
      setAuthModalOpen(true);
      return;
    }
    router.push(`/practice?bankId=${bankId}&mode=sequential`);
  };

  // 获取题库的 categoryId
  const getBankCategoryId = (bank: QuestionBank): string | undefined => {
    return bank.categoryId || (bank as any).category_id;
  };

  // 获取用户激活的分类
  const activatedCategoryIds = currentUser?.activatedCategories || [];
  const activatedCategories = categories.filter(c => activatedCategoryIds.includes(c.id));

  // 加载中
  if (!mounted || (isLoggedIn && isLoading)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // 未登录状态
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <TopNav />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-3xl flex items-center justify-center shadow-lg">
              <User className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">请先登录</h2>
            <p className="text-gray-500 text-sm mb-8">登录后可浏览题库并开始练习</p>
            <Button 
              size="lg" 
              className="rounded-2xl bg-blue-600 hover:bg-blue-700 px-8 h-12 text-base"
              onClick={() => setAuthModalOpen(true)}
            >
              立即登录
            </Button>
          </div>
        </main>
        <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} onAuthChange={handleAuthSuccess} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />

      <main className="max-w-[970px] mx-auto px-4 py-6">
        {/* 页面标题 */}
        <div className="mb-6">
          <div className="bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/60 backdrop-blur rounded-xl flex items-center justify-center shadow-sm">
                <Library className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-slate-700 tracking-tight">题库浏览</h1>
                <p className="text-slate-500 text-xs mt-0.5">选择分类开始练习</p>
              </div>
              <div className="px-2.5 py-1 bg-white/50 backdrop-blur rounded-full">
                <span className="text-slate-600 text-xs font-medium">
                  {activatedCategoryIds.length} 个分类
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 无激活分类提示 */}
        {activatedCategoryIds.length === 0 && (
          <Card className="mb-5 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-900">暂无激活的题库分类</h4>
                  <p className="text-xs text-gray-600 mt-0.5">请联系管理员获取激活码来解锁题库</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 题库列表 */}
        <div className="space-y-3">
          {banks.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
              <div className="w-14 h-14 mx-auto mb-3 bg-gray-50 rounded-2xl flex items-center justify-center">
                <Library className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm text-gray-500 font-medium">暂无题库</p>
              <p className="text-xs text-gray-400 mt-1">请联系管理员导入</p>
            </div>
          ) : (
            <>
              {/* 未分类题库 */}
              {banks.filter(b => !getBankCategoryId(b)).length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                    <FolderOpen className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-700">未分类</h3>
                    <span className="text-xs text-slate-400 ml-auto">
                      ({banks.filter(b => !getBankCategoryId(b)).length} 题库)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {banks.filter(b => !getBankCategoryId(b)).map((bank) => (
                      <BankCard 
                        key={bank.id} 
                        bank={bank} 
                        onStartPractice={handleStartPractice}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* 按分类显示题库 */}
              {activatedCategories.length > 0 && (
                <>
                  {activatedCategories.filter(c => !c.parentId).map(category => (
                    <div key={category.id} className="mb-4">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                        <FolderOpen className="w-4 h-4 text-slate-400" />
                        <h3 className="text-sm font-semibold text-slate-700">{category.name}</h3>
                        <span className="text-xs text-slate-400 ml-auto">
                          ({banks.filter(b => getBankCategoryId(b) === category.id).length} 题库)
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {banks.filter(b => getBankCategoryId(b) === category.id).map((bank) => (
                          <BankCard 
                            key={bank.id} 
                            bank={bank} 
                            onStartPractice={handleStartPractice}
                          />
                        ))}
                      </div>
                      
                      {activatedCategories.filter(c => c.parentId === category.id).map(childCategory => (
                        <div key={childCategory.id} className="mt-4 pl-4 border-l-2 border-slate-200">
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                            <FolderOpen className="w-4 h-4 text-slate-400" />
                            <h3 className="text-sm font-semibold text-slate-700">{childCategory.name}</h3>
                            <span className="text-xs text-slate-400 ml-auto">
                              ({banks.filter(b => getBankCategoryId(b) === childCategory.id).length} 题库)
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {banks.filter(b => getBankCategoryId(b) === childCategory.id).map((bank) => (
                              <BankCard 
                                key={bank.id} 
                                bank={bank} 
                                onStartPractice={handleStartPractice}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </main>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} onAuthChange={handleAuthSuccess} />
    </div>
  );
}
