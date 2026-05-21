'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GripVertical, Check, X, MoreHorizontal, FileText, Edit3, FolderOpen, Download, Trash2 } from 'lucide-react';
import type { QuestionBank } from '../types';

interface SortableBankRowProps {
  bank: QuestionBank;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
  onMoveCategory: () => void;
  onEditQuestions: () => void;
  onExportWord: () => void;
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function SortableBankRow({
  bank,
  onEdit,
  onDelete,
  onClick,
  onMoveCategory,
  onEditQuestions,
  onExportWord,
  isEditing,
  editingName,
  onEditingNameChange,
  onSave,
  onCancel,
}: SortableBankRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bank.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as const,
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <TableRow ref={setNodeRef} style={style} className="hover:bg-slate-50">
      <TableCell className="w-10 text-center">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 rounded inline-flex"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 text-slate-400" />
        </button>
      </TableCell>
      <TableCell className="w-[40%]">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editingName}
              onChange={(e) => onEditingNameChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={onSave}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
              title="保存"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={onCancel}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
              title="取消"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left truncate block w-full"
              title="点击修改名称"
            >
              {bank.name}
            </button>
            {bank.description && (
              <span className="text-xs text-slate-400 truncate" title={bank.description}>
                {bank.description}
              </span>
            )}
          </div>
        )}
      </TableCell>
      <TableCell onClick={onClick} className="w-[120px] text-center cursor-pointer">
        <Badge variant="secondary">
          {bank.questionCount || 0} 题
        </Badge>
      </TableCell>
      <TableCell className="w-[120px] text-center text-slate-500">
        {formatDate(bank.createdAt)}
      </TableCell>
      <TableCell className="w-[100px] text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEditQuestions}>
              <FileText className="h-4 w-4 mr-2" />
              编辑题目
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Edit3 className="h-4 w-4 mr-2" />
              修改名称
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMoveCategory}>
              <FolderOpen className="h-4 w-4 mr-2" />
              移动分类
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportWord}>
              <Download className="h-4 w-4 mr-2" />
              导出Word
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
