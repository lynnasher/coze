'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export function useExportDb() {
  const [availableTables, setAvailableTables] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [loadingTables, setLoadingTables] = useState(false);

  const fetchAvailableTables = useCallback(async () => {
    setLoadingTables(true);
    try {
      const data = await apiClient.get<{
        success: boolean;
        tables: Array<{ id: string; name: string; color: string }>;
      }>('/api/admin/export-db');

      if (data.success) {
        setAvailableTables(data.tables);
      }
    } finally {
      setLoadingTables(false);
    }
  }, []);

  const exportDatabase = async (selectedTables: string[]) => {
    try {
      const data = await apiClient.post('/api/admin/export-db', { tables: selectedTables });
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error?.message || '导出失败' };
    }
  };

  return {
    availableTables,
    loadingTables,
    fetchAvailableTables,
    exportDatabase,
  };
}
