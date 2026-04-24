'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Library, 
  User, 
  BookOpen, 
  Folder, 
  FolderOpen,
  ChevronRight,
  ArrowLeft,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TopNav } from '@/components/TopNav';
import { BankCard } from '@/components/BankCard';
import { AuthModal } from '@/components/AuthModal';
import { DeviceKickedDialog } from '@/components/DeviceKickedDialog';
import { useUserStore } from '@/lib/store';
import { useQuizStore } from '@/lib/store/quiz-store';
import { Category, QuestionBank, User as UserType } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function LibraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentUser, isLoggedIn, login, logout, hasHydrated } = useUserStore();
  const { startQuiz } = useQuizStore();

  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [deviceKickedOpen, setDeviceKickedOpen] = useState(false);

  // 加载数据
  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 页面加载时同步 localStorage 用户数据到 Zustand
  useEffect(() => {
    if (!currentUser) {
      const token = localStorage.getItem('quiz_user_token');
      const userData = localStorage.getItem('quiz_user_data');
      
      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData);
          // 转换 snake_case 到 camelCase
          const user: UserType = {
            ...parsedUser,
            activatedCategories: parsedUser.activated_categories || [],
          };
          login(user, token);
        } catch (e) {
          console.error('同步用户数据失败:', e);
        }
      }
    }
  }, [currentUser, login]);

  // 开始练习
  const handleStartPractice = (bankId: string) => {
    if (!isLoggedIn()) {
      setAuthModalOpen(true);
      return;
    }
    
    // 跳转到练习页面
    router.push(`/practice?bankId=${bankId}&mode=sequential`);
  };

  // 随机练习
  const handleRandomPractice = (bankId: string) => {
    if (!isLoggedIn()) {
      setAuthModalOpen(true);
      return;
    }
    
    router.push(`/practice?bankId=${bankId}&mode=random`);
  };

  // 登录成功回调 - 从 localStorage 读取用户数据并同步到 Zustand
  const handleAuthSuccess = () => {
    const token = localStorage.getItem('quiz_user_token');
    const userData = localStorage.getItem('quiz_user_data');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        const user: UserType = {
          ...parsedUser,
          activatedCategories: parsedUser.activated_categories || [],
        };
        login(user, token);
      } catch (e) {
        console.error('解析用户数据失败:', e);
      }
    }
    
    setAuthModalOpen(false);
    window.location.reload();
  };

  // 等待状态恢复完成
  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // 未登录状态渲染（必须在 hasHydrated 之后判断）
  if (!isLoggedIn()) {
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
        <AuthModal 
          open={authModalOpen} 
          onOpenChange={setAuthModalOpen} 
          onSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  // 辅助函数：获取题库的 categoryId（处理 camelCase 和 snake_case）
  const getBankCategoryId = (bank: QuestionBank): string | undefined => {
    return bank.categoryId || (bank as any).category_id;
  };

  // 获取用户激活的分类
  const activatedCategoryIds = currentUser?.activatedCategories || [];
  const activatedCategories = categories.filter(c => activatedCategoryIds.includes(c.id));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航 */}
      <TopNav />

      {/* 主内容 */}
      <main className="max-w-[970px] mx-auto px-4 py-6">
        {/* 页面标题 */}
        <div className="mb-6">
          <div className="bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/30 rounded-full"></div>
            <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/30 rounded-full"></div>
            
            <div className="relative flex items-center gap-3">
              <div className="w-10 h-10 bg-white/60 backdrop-blur rounded-xl flex items-center justify-center shadow-sm">
                <Library className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-slate-700 tracking-tight">题库浏览</h1>
                <p className="text-slate-500 text-xs mt-0.5">选择分类开始练习</p>
              </div>
              {isLoggedIn() && (
                <div className="px-2.5 py-1 bg-white/50 backdrop-blur rounded-full">
                  <span className="text-slate-600 text-xs font-medium">
                    {activatedCategoryIds.length} 个分类
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 已登录但无激活分类 */}
        {isLoggedIn() && activatedCategoryIds.length === 0 && (
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
              {isLoggedIn() && activatedCategories.length > 0 && (
                <>
                  {(() => {
                    // 分离顶级分类和子分类
                    const topCategories = activatedCategories.filter(c => !c.parentId);
                    const childCategories = activatedCategories.filter(c => c.parentId);
                    
                    // 将子分类按父分类分组
                    const childCategoriesByParent = new Map<string, typeof childCategories>();
                    childCategories.forEach(cat => {
                      const parentId = cat.parentId!;
                      if (!childCategoriesByParent.has(parentId)) {
                        childCategoriesByParent.set(parentId, []);
                      }
                      childCategoriesByParent.get(parentId)!.push(cat);
                    });

                    return (
                      <>
                        {/* 先显示激活的子分类（带父分类标题） */}
                        {Array.from(childCategoriesByParent.entries()).map(([parentId, children]) => {
                          const parentCategory = categories.find(c => c.id === parentId);
                          return (
                            <div key={`parent-${parentId}`} className="mb-4">
                              {parentCategory && (
                                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                                  <Folder className="w-4 h-4 text-slate-400" />
                                  <span className="text-sm font-semibold text-slate-700">
                                    {parentCategory.name}
                                  </span>
                                </div>
                              )}
                              <div className="space-y-2">
                                {children.map(category => {
                                  const categoryBanks = banks.filter(b => getBankCategoryId(b) === category.id);
                                  if (categoryBanks.length === 0) return null;
                                  
                                  return (
                                    <div key={category.id} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
                                      <div 
                                        className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-3 -m-2 rounded-xl transition-all duration-200"
                                        onClick={() => setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)}
                                      >
                                        {selectedCategoryId === category.id ? (
                                          <FolderOpen className="w-4 h-4 text-slate-500" />
                                        ) : (
                                          <Folder className="w-4 h-4 text-slate-400" />
                                        )}
                                        <span className="text-sm font-medium text-slate-700 flex-1">
                                          {category.name}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                          {categoryBanks.length} 个题库
                                        </span>
                                        <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${selectedCategoryId === category.id ? 'rotate-90' : ''}`} />
                                      </div>
                                    
                                      {selectedCategoryId === category.id && (
                                        <div className="mt-3 space-y-3 pl-2">
                                          {categoryBanks.map(bank => (
                                            <BankCard
                                              key={bank.id}
                                              bank={bank}
                                              onStartPractice={handleStartPractice}
                                            />
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}

                        {/* 再显示激活的顶级分类（不带父分类标题） */}
                        {topCategories.map(category => {
                          const categoryBanks = banks.filter(b => b.categoryId === category.id);
                          if (categoryBanks.length === 0) return null;
                          
                          return (
                            <div key={category.id} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
                              <div 
                                className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-3 -m-2 rounded-xl transition-all duration-200"
                                onClick={() => setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)}
                              >
                                {selectedCategoryId === category.id ? (
                                  <FolderOpen className="w-4 h-4 text-slate-500" />
                                ) : (
                                  <Folder className="w-4 h-4 text-slate-400" />
                                )}
                                <span className="text-sm font-medium text-slate-700 flex-1">
                                  {category.name}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {categoryBanks.length} 个题库
                                </span>
                                <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${selectedCategoryId === category.id ? 'rotate-90' : ''}`} />
                              </div>
                            
                              {selectedCategoryId === category.id && (
                                <div className="mt-3 space-y-3 pl-2">
                                  {categoryBanks.map(bank => (
                                    <BankCard
                                      key={bank.id}
                                      bank={bank}
                                      onStartPractice={handleStartPractice}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* 登录弹窗 */}
      <AuthModal 
        open={authModalOpen} 
        onOpenChange={setAuthModalOpen}
        onAuthChange={() => setAuthModalOpen(false)}
      />

      {/* 设备被踢下线提示 */}
      <DeviceKickedDialog 
        open={deviceKickedOpen}
        onConfirm={() => {
          logout();
          setDeviceKickedOpen(false);
        }}
      />
    </div>
  );
}
