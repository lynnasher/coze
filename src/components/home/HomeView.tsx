'use client';

import { useState } from 'react';
import { Library, Folder, FolderOpen, ChevronRight, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BankCard } from '@/components/BankCard';
import type { QuestionBank, Category } from '@/lib/types';

// 用户类型
interface User {
  id: string;
  phone: string;
  nickname?: string;
  activatedCategories?: string[];
}

interface HomeViewProps {
  // 数据
  banks: QuestionBank[];
  categories: Category[];
  currentUser: User | null;
  
  // 回调
  onStartPractice: (bankId: string) => void;
  onShowAuthModal: () => void;
  onShowActivationModal: () => void;
}

export function HomeView({
  banks,
  categories,
  currentUser,
  onStartPractice,
  onShowAuthModal,
  onShowActivationModal,
}: HomeViewProps) {
  // 选中的分类ID（用于展开/折叠）
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  // 未分类题库
  const uncategorizedBanks = banks.filter(b => !b.categoryId);
  
  // 获取用户激活的分类
  const activatedCategoryIds = currentUser?.activatedCategories || [];
  const activatedCategories = categories.filter(c => 
    activatedCategoryIds.includes(c.id)
  );
  
  // 分离顶级分类和子分类
  const topCategories = activatedCategories.filter(c => !c.parentId);
  const childCategories = activatedCategories.filter(c => c.parentId);
  
  // 将子分类按父分类分组
  const childCategoriesByParent = new Map<string, Category[]>();
  childCategories.forEach(cat => {
    const parentId = cat.parentId!;
    if (!childCategoriesByParent.has(parentId)) {
      childCategoriesByParent.set(parentId, []);
    }
    childCategoriesByParent.get(parentId)!.push(cat);
  });
  
  // 检查是否有未激活的分类（显示激活提示）
  const hasUnactivatedCategories = categories.length > 0 && 
    activatedCategoryIds.length === 0 && 
    currentUser !== null;

  // 获取分类颜色样式
  const getCategoryColorClass = (color?: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-700',
      green: 'bg-green-100 text-green-700',
      red: 'bg-red-100 text-red-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      purple: 'bg-purple-100 text-purple-700',
      pink: 'bg-pink-100 text-pink-700',
      indigo: 'bg-indigo-100 text-indigo-700',
      cyan: 'bg-cyan-100 text-cyan-700',
    };
    return colorMap[color || 'blue'] || colorMap.blue;
  };

  return (
    <div className="space-y-4">
      {/* 激活提示 - 未激活时显示 */}
      {hasUnactivatedCategories && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Ticket className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">
                需要激活题库
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                请联系管理员获取激活码来解锁题库
              </p>
            </div>
            <Button
              size="sm"
              onClick={onShowActivationModal}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs rounded-lg"
            >
              去激活
            </Button>
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
            {uncategorizedBanks.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <FolderOpen className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700">未分类</h3>
                  <span className="text-xs text-slate-400 ml-auto">
                    ({uncategorizedBanks.length} 题库)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {uncategorizedBanks.map((bank) => (
                    <BankCard
                      key={bank.id}
                      bank={bank}
                      onStartPractice={(bankId) => {
                        if (!currentUser) {
                          onShowAuthModal();
                          return;
                        }
                        onStartPractice(bankId);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 按分类显示题库 */}
            {currentUser && (
              <>
                {/* 激活的子分类（带父分类标题） */}
                {Array.from(childCategoriesByParent.entries()).map(([parentId, children]) => {
                  const parentCategory = categories.find(c => c.id === parentId);
                  
                  return (
                    <div key={`parent-${parentId}`} className="mb-4">
                      {/* 父分类标题 */}
                      {parentCategory && (
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                          <Folder className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-semibold text-slate-700">
                            {parentCategory.name}
                          </span>
                        </div>
                      )}
                      
                      {/* 子分类卡片列表 */}
                      <div className="space-y-2">
                        {children.map(category => {
                          const categoryBanks = banks.filter(b => b.categoryId === category.id);
                          if (categoryBanks.length === 0) return null;

                          return (
                            <CategorySection
                              key={category.id}
                              category={category}
                              banks={categoryBanks}
                              isExpanded={selectedCategoryId === category.id}
                              onToggle={() => setSelectedCategoryId(
                                selectedCategoryId === category.id ? null : category.id
                              )}
                              onStartPractice={(bankId) => {
                                if (!currentUser) {
                                  onShowAuthModal();
                                  return;
                                }
                                onStartPractice(bankId);
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* 顶级分类 */}
                {topCategories.map(category => {
                  const categoryBanks = banks.filter(b => b.categoryId === category.id);
                  const activatedChildCategories = childCategoriesByParent.get(category.id) || [];
                  const childCategoryIds = activatedChildCategories.map(c => c.id);
                  const childCategoryBanks = banks.filter(b => 
                    childCategoryIds.includes(b.categoryId || '')
                  );

                  if (categoryBanks.length === 0 && childCategoryBanks.length === 0) {
                    return null;
                  }

                  return (
                    <div key={category.id} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm mb-4">
                      {/* 顶级分类标题 */}
                      <div
                        className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50/80 p-2 -m-2 rounded-xl transition-all duration-200"
                        onClick={() => setSelectedCategoryId(
                          selectedCategoryId === category.id ? null : category.id
                        )}
                      >
                        {selectedCategoryId === category.id ? (
                          <FolderOpen className="w-4 h-4 text-slate-500" />
                        ) : (
                          <Folder className="w-4 h-4 text-slate-400" />
                        )}
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg tracking-wide ${getCategoryColorClass(category.color)}`}>
                          {category.name}
                        </span>
                        <span className="text-xs text-slate-400 ml-auto">
                          {categoryBanks.length + childCategoryBanks.length} 题库
                        </span>
                        <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${
                          selectedCategoryId === category.id ? 'rotate-90' : ''
                        }`} />
                      </div>

                      {/* 展开时显示题库 */}
                      {selectedCategoryId === category.id && (
                        <div className="mt-3 space-y-3 pl-2">
                          {/* 直接属于该分类的题库 */}
                          {categoryBanks.map(bank => (
                            <BankCard
                              key={bank.id}
                              bank={bank}
                              onStartPractice={(bankId) => {
                                if (!currentUser) {
                                  onShowAuthModal();
                                  return;
                                }
                                onStartPractice(bankId);
                              }}
                            />
                          ))}

                          {/* 子分类的题库 */}
                          {activatedChildCategories.map(childCategory => {
                            const childBanks = banks.filter(b => b.categoryId === childCategory.id);
                            if (childBanks.length === 0) return null;

                            return (
                              <div key={childCategory.id} className="mt-3">
                                <div className="flex items-center gap-2 mb-2 px-1">
                                  <Folder className="w-3.5 h-3.5 text-slate-400" />
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${getCategoryColorClass(childCategory.color)}`}>
                                    {childCategory.name}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    {childBanks.length} 个题库
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {childBanks.map(bank => (
                                    <BankCard
                                      key={bank.id}
                                      bank={bank}
                                      onStartPractice={(bankId) => {
                                        if (!currentUser) {
                                          onShowAuthModal();
                                          return;
                                        }
                                        onStartPractice(bankId);
                                      }}
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
            )}
          </>
        )}
      </div>

      {/* 底部安全间距 */}
      <div className="h-8"></div>
    </div>
  );
}

// 子分类组件
interface CategorySectionProps {
  category: Category;
  banks: QuestionBank[];
  isExpanded: boolean;
  onToggle: () => void;
  onStartPractice: (bankId: string) => void;
}

function CategorySection({
  category,
  banks,
  isExpanded,
  onToggle,
  onStartPractice,
}: CategorySectionProps) {
  return (
    <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
      {/* 子分类标题 */}
      <div
        className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-3 -m-2 rounded-xl transition-all duration-200"
        onClick={onToggle}
      >
        {isExpanded ? (
          <FolderOpen className="w-4 h-4 text-slate-500" />
        ) : (
          <Folder className="w-4 h-4 text-slate-400" />
        )}
        <span className="text-sm font-medium text-slate-700 flex-1">
          {category.name}
        </span>
        <span className="text-xs text-slate-400">
          {banks.length} 个题库
        </span>
        <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${
          isExpanded ? 'rotate-90' : ''
        }`} />
      </div>

      {/* 展开时显示题库 */}
      {isExpanded && (
        <div className="mt-3 space-y-3 pl-2">
          {banks.map(bank => (
            <BankCard
              key={bank.id}
              bank={bank}
              onStartPractice={onStartPractice}
            />
          ))}
        </div>
      )}
    </div>
  );
}
