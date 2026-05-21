'use client';

import { useState, useCallback } from 'react';
import { flattenQuestions } from '@/lib/import-utils';
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

      const response = await fetch('/api/admin/import-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify({
          questions: data.questions,
          bankName: data.bankName || data.subjectName || file.name.replace('.json', ''),
          categoryId,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        return { success: false, error: result.error || '导入失败' };
      }

      return { success: true, data: result };
    } catch (err) {
      if (err instanceof SyntaxError) {
        return { success: false, error: 'JSON 格式错误' };
      }
      return { success: false, error: '导入失败' };
    } finally {
      setIsImporting(false);
    }
  }, []);

  return { isImporting, importJson };
}
