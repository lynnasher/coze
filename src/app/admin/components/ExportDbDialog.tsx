'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ExportDbDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTables: Array<{ id: string; name: string; color: string }>;
  loadingTables: boolean;
  onExport: (tables: string[]) => void;
}

export function ExportDbDialog({
  open,
  onOpenChange,
  availableTables,
  loadingTables,
  onExport,
}: ExportDbDialogProps) {
  const [selectedTables, setSelectedTables] = useState<string[]>([]);

  const handleExport = () => {
    onExport(selectedTables);
    setSelectedTables([]);
    onOpenChange(false);
  };

  const toggleTable = (tableId: string) => {
    if (selectedTables.includes(tableId)) {
      setSelectedTables(selectedTables.filter((t) => t !== tableId));
    } else {
      setSelectedTables([...selectedTables, tableId]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>导出数据库</DialogTitle>
          <DialogDescription>选择要导出的数据表</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {loadingTables ? (
            <div className="text-center py-4 text-gray-500">加载中...</div>
          ) : availableTables.length === 0 ? (
            <div className="text-center py-4 text-gray-500">数据库中没有可导出的表</div>
          ) : (
            availableTables.map((table) => (
              <div
                key={table.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedTables.includes(table.id)
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => toggleTable(table.id)}
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center ${
                    selectedTables.includes(table.id)
                      ? 'bg-indigo-500 border-indigo-500'
                      : 'border-gray-300'
                  }`}
                >
                  {selectedTables.includes(table.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className={`text-xs px-2 py-0.5 rounded w-fit ${table.color}`}>{table.name}</span>
                  <span className="text-xs text-gray-400 mt-1">{table.id}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleExport} disabled={selectedTables.length === 0}>
            导出 {selectedTables.length > 0 && `(${selectedTables.length}个表)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
