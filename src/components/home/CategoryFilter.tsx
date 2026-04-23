/**
 * CategoryFilter - 分类筛选组件
 */

'use client';

import { Category } from '@/lib/types';
import { CATEGORY_COLORS } from '@/config';

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelect: (categoryId: string | null) => void;
}

export function CategoryFilter({ 
  categories, 
  selectedCategory, 
  onSelect 
}: CategoryFilterProps) {
  if (categories.length === 0) return null;

  // 按 order 排序
  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  return (
    <div className="px-4 py-3 bg-white border-b border-slate-100">
      <div className="max-w-[970px] mx-auto">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {/* 全部 */}
          <button
            onClick={() => onSelect(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === null
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            全部
          </button>

          {/* 分类列表 */}
          {sortedCategories.map((category) => {
            const colorClass = CATEGORY_COLORS[category.color as keyof typeof CATEGORY_COLORS] || 'bg-slate-500';
            const isSelected = selectedCategory === category.id;

            return (
              <button
                key={category.id}
                onClick={() => onSelect(category.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${colorClass}`} />
                {category.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
