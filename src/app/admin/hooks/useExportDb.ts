'use client';

import { useState, useCallback } from 'react';

export function useExportDb() {
  const [availableTables, setAvailableTables] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [loadingTables, setLoadingTables] = useState(false);

  const fetchAvailableTables = useCallback(async () => {
    setLoadingTables(true);
    try {
      const response = await fetch('/api/admin/export-db', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAvailableTables(data.tables);
        }
      }
    } finally {
      setLoadingTables(false);
    }
  }, []);

  const exportDatabase = async (selectedTables: string[]) => {
    try {
      const response = await fetch('/api/admin/export-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify({ tables: selectedTables }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || '导出失败' };
      }

      const data = await response.json();
      return { success: true, data };
    } catch {
      return { success: false, error: '网络错误' };
    }
  };

  return {
    availableTables,
    loadingTables,
    fetchAvailableTables,
    exportDatabase,
  };
}
