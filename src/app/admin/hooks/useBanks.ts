'use client';

import { useState, useCallback, useEffect } from 'react';
import type { QuestionBank, AdminStats } from '../types';

export function useBanks() {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [stats, setStats] = useState<AdminStats>(({
    totalBanks: 0,
    totalQuestions: 0,
  }));
  const [isLoading, setIsLoading] = useState(false);

  const loadBanks = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/banks', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const dbBanks: QuestionBank[] = (data.banks || []).map((b: {
          id: string;
          name: string;
          description?: string;
          created_at: string;
          category_id?: string;
          source_file?: string;
          status?: string;
          question_count?: number;
          correct_rate?: number;
        }) => ({
          id: b.id,
          name: b.name,
          description: b.description,
          createdAt: new Date(b.created_at).getTime(),
          categoryId: b.category_id,
          sourceFile: b.source_file,
          status: b.status,
          questionCount: b.question_count || 0,
          correctRate: b.correct_rate || 0,
          questionIds: [],
        }));

        setBanks(dbBanks);
        const totalQ = (data.banks || []).reduce(
          (sum: number, b: { question_count?: number }) => sum + (b.question_count || 0),
          0
        );
        setStats({
          totalBanks: dbBanks.length,
          totalQuestions: totalQ,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateBankOrder = async (newBanks: QuestionBank[]) => {
    setBanks(newBanks);
    try {
      await fetch('/api/admin/banks/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify({
          bankIds: newBanks.map((b) => b.id),
        }),
      });
    } catch {
      // 静默处理错误
    }
  };

  const deleteBank = async (bankId: string) => {
    try {
      const response = await fetch(`/api/admin/banks/${bankId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });

      if (response.ok) {
        await loadBanks();
        return { success: true };
      }
      return { success: false, error: '删除失败' };
    } catch {
      return { success: false, error: '网络错误' };
    }
  };

  const updateBank = async (bankId: string, updates: Partial<QuestionBank>) => {
    try {
      const response = await fetch(`/api/admin/banks/${bankId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await loadBanks();
        return { success: true };
      }
      return { success: false, error: '更新失败' };
    } catch {
      return { success: false, error: '网络错误' };
    }
  };

  return {
    banks,
    stats,
    isLoading,
    loadBanks,
    updateBankOrder,
    deleteBank,
    updateBank,
  };
}
