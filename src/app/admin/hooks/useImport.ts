'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { STORAGE_KEYS } from '../types';

export function useImport() {
  const [isImporting, setIsImporting] = useState(false);

  const importJson = useCallback(async (file: File, categoryId?: string) => {
    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data.questions)) {
        return { success: false, error: '无效的题库格式' };
      }

      if (data.questions.length === 0) {
        return { success: false, error: '题库中没有题目' };
      }

      const result = await apiClient.post('/api/admin/import-json', {
        questions: data.questions,
        bankName: data.bankName || data.subjectName || file.name.replace('.json', ''),
        categoryId,
      });

      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        return { success: false, error: 'JSON 格式错误' };
      }
      return { success: false, error: err?.message || '导入失败' };
    } finally {
      setIsImporting(false);
    }
  }, []);

  return { isImporting, importJson };
}
