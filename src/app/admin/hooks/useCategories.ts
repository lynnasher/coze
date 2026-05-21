'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Category } from '../types';
import { STORAGE_KEYS } from '../types';

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
          setCategories(data.categories);
          localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(data.categories));
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
