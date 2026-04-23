'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Library, Folder, FolderOpen, User, BookOpen, ChevronRight } from 'lucide-react';
import { bankStore, questionStore } from '@/lib/quiz-store';
import { Question, Category } from '@/lib/types';
import { BankCard } from '@/components/BankCard';
import { AuthModal } from '@/components/AuthModal';
import { useApp } from '@/components/providers/AppProviders';
import Link from 'next/link';

interface Bank {
  id: string;
  name: string;
  description?: string;
  questionCount: number;
  categoryId?: string;
  createdAt: number;
}

export default function LibraryPage() {
  const { currentUser, authModalOpen, setAuthModalOpen, refreshUser, mounted } = useApp();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dbBanks, setDbBanks] = useState<Array<{
    id: string;
    name: string;
    description?: string;
    question_count?: number;
    category_id?: string;
    created_at?: string;
  }>>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 加载题库和分类数据
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 从 API 获取题库
      const response = await fetch('/api/banks');
      if (response.ok) {
        const data = await response.json();
        if (data.banks) {
          setDbBanks(data.banks);
          const mappedBanks: Bank[] = data.banks.map((b: typeof data.banks[0]) => ({
            id: b.id,
            name: b.name,
            description: b.description,
            questionCount: b.question_count || 0,
            categoryId: b.category_id,
            createdAt: Date.now(),
          }));
          setBanks(mappedBanks);
          // bankStore 需要 QuestionBank 类型
          const questionBanks = mappedBanks.map(b => ({
            id: b.id,
            name: b.name,
            description: b.description,
            questionIds: [] as string[],
            createdAt: b.createdAt,
            updatedAt: Date.now(),
          }));
          bankStore.save(questionBanks);
        }
      }

      // 获取分类
      const catResponse = await fetch('/api/categories');
      if (catResponse.ok) {
        const catData = await catResponse.json();
        if (catData.categories) {
          setCategories(catData.categories);
        }
      }

      // 获取题目
      const questionsResponse = await fetch('/api/questions');
      if (questionsResponse.ok) {
        const questionsData = await questionsResponse.json();
        if (questionsData.questions) {
          questionStore.save(questionsData.questions);
        }
      }
    } catch (error) {
      console.error('Failed to load library data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    refreshUser();
  }, [loadData, refreshUser]);

  // 处理开始练习
  const handleStartPractice = (bankId: string) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    // 跳转到首页并开始练习
    window.location.href = `/?practice=${bankId}`;
  };

  if (!mounted || isLoading) {
    return (
      <main className="max-w-[970px] mx-auto px-4 py-6">
        <div className="flex items-center justify-center py-20">
          <div className="text-slate-400 text-sm">加载中...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-[970px] mx-auto px-4 py-6">
      {/* 页面标题 */}
      <div className="mb-6 relative overflow-hidden">
        <div className="bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 rounded-2xl p-4 shadow-sm">
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
            {currentUser && (
              <div className="px-2.5 py-1 bg-white/50 backdrop-blur rounded-full">
                <span className="text-slate-600 text-xs font-medium">
                  {currentUser.activatedCategories?.length || 0} 个分类
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 未登录提示 */}
      {!currentUser && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-200 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900">登录后查看已激活的题库</h4>
              <p className="text-xs text-gray-600 mt-0.5">请先登录以查看和练习题库</p>
            </div>
            <Button 
              size="sm" 
              className="rounded-xl bg-blue-600 hover:bg-blue-700"
              onClick={() => setAuthModalOpen(true)}
            >
              登录
            </Button>
          </div>
        </div>
      )}

      {/* 已登录但无激活分类提示 */}
      {currentUser && (currentUser.activatedCategories?.length === 0) && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-200 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900">暂无激活的题库分类</h4>
              <p className="text-xs text-gray-600 mt-0.5">请联系管理员获取激活码来解锁题库</p>
            </div>
          </div>
        </div>
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
            {banks.filter(b => !b.categoryId).length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <FolderOpen className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700">未分类</h3>
                  <span className="text-xs text-slate-400 ml-auto">
                    ({banks.filter(b => !b.categoryId).length} 题库)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {banks.filter(b => !b.categoryId).map((bank) => (
                    <BankCard 
                      key={bank.id} 
                      bank={bank} 
                      onStartPractice={() => handleStartPractice(bank.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 按分类显示题库 */}
            {(() => {
              // 非登录用户不显示分类题库
              if (!currentUser) return null;
              
              // 获取用户激活的分类ID列表
              const activatedCategoryIds = currentUser.activatedCategories || [];
              
              // 获取用户激活的所有分类
              const activatedCategories = categories.filter(c => 
                activatedCategoryIds.includes(c.id)
              );
              
              if (activatedCategories.length === 0) return null;
              
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
                  {/* 显示激活的子分类 */}
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
                                        onStartPractice={() => handleStartPractice(bank.id)}
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
                  
                  {/* 显示激活的顶级分类 */}
                  {topCategories.map(category => {
                    const categoryBanks = banks.filter(b => b.categoryId === category.id);
                    const activatedChildCategories = childCategoriesByParent.get(category.id) || [];
                    const childCategoryIds = activatedChildCategories.map(c => c.id);
                    const childCategoryBanks = banks.filter(b => childCategoryIds.includes(b.categoryId || ''));
                    
                    if (categoryBanks.length === 0 && childCategoryBanks.length === 0) return null;
                    
                    return (
                      <div key={category.id} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm mb-4">
                        <div 
                          className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50/80 p-2 -m-2 rounded-xl transition-all duration-200"
                          onClick={() => setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)}
                        >
                          {selectedCategoryId === category.id ? (
                            <FolderOpen className="w-4 h-4 text-slate-500" />
                          ) : (
                            <Folder className="w-4 h-4 text-slate-400" />
                          )}
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg tracking-wide ${
                            category.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                            category.color === 'green' ? 'bg-green-100 text-green-700' :
                            category.color === 'red' ? 'bg-red-100 text-red-700' :
                            category.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                            category.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                            category.color === 'pink' ? 'bg-pink-100 text-pink-700' :
                            category.color === 'indigo' ? 'bg-indigo-100 text-indigo-700' :
                            'bg-cyan-100 text-cyan-700'
                          }`}>
                            {category.name}
                          </span>
                          <span className="text-xs text-gray-500 ml-auto pr-1 font-medium">
                            {categoryBanks.length + childCategoryBanks.length} 个题库
                          </span>
                          <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${selectedCategoryId === category.id ? 'rotate-90' : ''}`} />
                        </div>
                      
                        {selectedCategoryId === category.id && (
                          <div className="mt-3 space-y-3">
                            {categoryBanks.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-2">
                                  <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                  <span className="text-xs text-gray-400 font-medium">直接题库</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {categoryBanks.map((bank) => (
                                    <BankCard 
                                      key={bank.id} 
                                      bank={bank} 
                                      onStartPractice={() => handleStartPractice(bank.id)}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {activatedChildCategories.map(child => {
                              const childBanks = banks.filter(b => b.categoryId === child.id);
                              if (childBanks.length === 0) return null;
                              
                              return (
                                <div key={child.id}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <FolderOpen className="w-3 h-3 text-gray-500" />
                                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${
                                      child.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                                      child.color === 'green' ? 'bg-green-100 text-green-700' :
                                      child.color === 'red' ? 'bg-red-100 text-red-700' :
                                      child.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                                      child.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                                      child.color === 'pink' ? 'bg-pink-100 text-pink-700' :
                                      child.color === 'indigo' ? 'bg-indigo-100 text-indigo-700' :
                                      'bg-cyan-100 text-cyan-700'
                                    }`}>
                                      {child.name}
                                    </span>
                                    <span className="text-xs text-gray-500 font-medium">({childBanks.length} 题库)</span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {childBanks.map((bank) => (
                                      <BankCard 
                                        key={bank.id} 
                                        bank={bank} 
                                        onStartPractice={() => handleStartPractice(bank.id)}
                                      />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
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
      </div>

      {/* 底部安全间距 */}
      <div className="h-8"></div>

      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onAuthChange={refreshUser}
      />
    </main>
  );
}
