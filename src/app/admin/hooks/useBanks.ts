'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
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
      const data = await apiClient.get<{ banks: Array<{
        id: string;
        name: string;
        description?: string;
        created_at: string;
        category_id?: string;
        source_file?: string;
        status?: string;
        question_count?: number;
        correct_rate?: number;
      }> }>('/api/admin/banks');

      const dbBanks: QuestionBank[] = (data.banks || []).map((b) => ({
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
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 自动加载数据
  useEffect(() => {
    loadBanks();
  }, [loadBanks]);

  const updateBankOrder = async (newBanks: QuestionBank[]) => {
    setBanks(newBanks);
    try {
      await apiClient.post('/api/admin/banks/reorder', {
        bankIds: newBanks.map((b) => b.id),
      });
    } catch {
      // 静默处理错误
    }
  };

  const deleteBank = async (bankId: string) => {
    try {
      const data = await apiClient.delete<{
        success: boolean;
        deletedQuestionIds?: string[];
      }>(`/api/admin/banks/${bankId}`);

      if (data?.success) {
        // 清除该题库相关的本地数据
        if (data.deletedQuestionIds && data.deletedQuestionIds.length > 0) {
          const { recordStore, wrongStreakStore, questionStore, deletedQuestionStore } = await import('@/lib/quiz-store');
          // 清除练习记录
          recordStore.removeByQuestionIds(data.deletedQuestionIds);
          // 清除错题连续正确次数
          wrongStreakStore.removeByQuestionIds(data.deletedQuestionIds);
          // 清除题目本身
          questionStore.removeByQuestionIds(data.deletedQuestionIds);
          // 记录已删除的题目ID（用于过滤云端同步数据）
          deletedQuestionStore.add(data.deletedQuestionIds);

          // 触发全局事件通知其他组件刷新数据
          window.dispatchEvent(new CustomEvent('bankDeleted', {
            detail: { questionIds: data.deletedQuestionIds }
          }));
        }

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
      await apiClient.put(`/api/admin/banks/${bankId}`, updates);
      await loadBanks();
      return { success: true };
    } catch {
      return { success: false, error: '更新失败' };
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
