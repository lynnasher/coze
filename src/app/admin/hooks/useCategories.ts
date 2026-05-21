'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Category } from '../types';
import { STORAGE_KEYS } from '../types';

// 按层级排序分类：父分类在前，子分类紧跟父分类，同级按 order 排序
function sortCategoriesByHierarchy(categories: Category[]): Category[] {
  const categoryMap = new Map<string, Category>();
  const childrenMap = new Map<string, Category[]>();

  // 构建映射
  categories.forEach((cat) => {
    categoryMap.set(cat.id, cat);
    if (cat.parentId) {
      const siblings = childrenMap.get(cat.parentId) || [];
      siblings.push(cat);
      childrenMap.set(cat.parentId, siblings);
    }
  });

  const result: Category[] = [];
  const processed = new Set<string>();

  // 递归添加分类及其子分类
  const addCategoryWithChildren = (cat: Category, depth: number) => {
    if (processed.has(cat.id)) return;
    processed.add(cat.id);

    // 添加当前分类（带深度信息用于缩进）
    result.push({ ...cat, depth });

    // 添加子分类（按 order 排序）
    const children = childrenMap.get(cat.id) || [];
    children
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach((child) => addCategoryWithChildren(child, depth + 1));
  };

  // 先处理所有顶层分类（按 order 排序）
  const topLevelCategories = categories
    .filter((cat) => !cat.parentId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  topLevelCategories.forEach((cat) => addCategoryWithChildren(cat, 0));

  // 处理循环引用或未挂载的分类
  categories.forEach((cat) => {
    if (!processed.has(cat.id)) {
      result.push(cat);
    }
  });

  return result;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/categories', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.categories) {
          // 按层级排序：父分类在前，子分类在后，同级按 order 排序
          const sortedCategories = sortCategoriesByHierarchy(data.categories);
          setCategories(sortedCategories);
          localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(sortedCategories));
          return;
        }
      }

      const storedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (storedCategories) {
        setCategories(JSON.parse(storedCategories));
      }
    } catch {
      const storedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (storedCategories) {
        setCategories(JSON.parse(storedCategories));
      }
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const saveCategory = async (name: string, color: string, parentId: string | null, editingCategory?: Category | null) => {
    if (!name.trim()) return { success: false, error: '请输入分类名称' };

    try {
      const url = editingCategory ? `/api/admin/categories/${editingCategory.id}` : '/api/admin/categories';
      const method = editingCategory ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          color,
          parentId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || '保存失败' };
      }

      await loadCategories();
      return { success: true };
    } catch {
      return { success: false, error: '网络错误' };
    }
  };

  const deleteCategory = async (category: Category) => {
    const idsToDelete: string[] = [category.id];

    const findChildren = (parentId: string) => {
      categories.forEach((c: Category) => {
        if (c.parentId === parentId) {
          idsToDelete.push(c.id);
          findChildren(c.id);
        }
      });
    };

    findChildren(category.id);

    try {
      for (const id of idsToDelete) {
        const response = await fetch(`/api/admin/categories/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
          },
        });

        if (!response.ok) {
          return { success: false, error: '删除失败' };
        }
      }

      await loadCategories();
      return { success: true };
    } catch {
      return { success: false, error: '网络错误' };
    }
  };

  const getCategoryName = (categoryId?: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || '未分类';
  };

  const getCategoryColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
      green: 'bg-green-100 text-green-700 hover:bg-green-200',
      red: 'bg-red-100 text-red-700 hover:bg-red-200',
      yellow: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
      purple: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
      pink: 'bg-pink-100 text-pink-700 hover:bg-pink-200',
      indigo: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
      cyan: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200',
    };
    return colorMap[color] || colorMap.blue;
  };

  return {
    categories,
    loadCategories,
    saveCategory,
    deleteCategory,
    getCategoryName,
    getCategoryColorClass,
  };
}
