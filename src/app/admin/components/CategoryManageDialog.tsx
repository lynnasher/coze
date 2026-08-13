'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Folder, FolderOpen, Plus, Edit3, Trash2 } from 'lucide-react';
import type { Category } from '../types';
import { categoryColors } from '../types';

interface CategoryManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onSave: (name: string, color: string, parentId: string | null, editingCategory?: Category | null) => Promise<{ success: boolean; error?: string }>;
  onDelete: (category: Category) => Promise<{ success: boolean; error?: string }>;
}

export function CategoryManageDialog({
  open,
  onOpenChange,
  categories,
  onSave,
  onDelete,
}: CategoryManageDialogProps) {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState('blue');
  const [categoryParentId, setCategoryParentId] = useState<string | null>(null);

  const resetForm = (closeModal = true) => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryColor('blue');
    setCategoryParentId(null);
    if (closeModal) {
      onOpenChange(false);
    }
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const handleSave = async () => {
    const result = await onSave(categoryName, categoryColor, categoryParentId, editingCategory);
    if (result.success) {
      resetForm();
    }
  };

  const startEdit = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryColor(category.color);
    setCategoryParentId(category.parentId || null);
  };

  const getCategoryColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-700',
      green: 'bg-green-100 text-green-700',
      red: 'bg-red-100 text-red-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      purple: 'bg-purple-100 text-purple-700',
      pink: 'bg-pink-100 text-pink-700',
      indigo: 'bg-indigo-100 text-indigo-700',
      cyan: 'bg-cyan-100 text-cyan-700',
    };
    return colorMap[color] || colorMap.blue;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>管理分类</DialogTitle>
          <DialogDescription>支持创建一级分类和二级分类（子分类）</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          <div className="space-y-3">
            {categories.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">暂无分类，请添加一级分类</p>
            ) : (
              <>
                {categories
                  .filter((c) => !c.parentId)
                  .map((cat) => (
                    <div key={cat.id} className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-slate-500" />
                          <Badge className={getCategoryColorClass(cat.color)}>{cat.name}</Badge>
                          <span className="text-xs text-slate-400">
                            ({categories.filter((c) => c.parentId === cat.id).length}个子分类)
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(cat)}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(cat)}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </div>

                      <div className="ml-6 space-y-1">
                        {categories
                          .filter((c) => c.parentId === cat.id)
                          .map((child) => (
                            <div
                              key={child.id}
                              className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100"
                            >
                              <div className="flex items-center gap-2">
                                <FolderOpen className="w-3 h-3 text-slate-400" />
                                <Badge className={getCategoryColorClass(child.color)} variant="outline">
                                  {child.name}
                                </Badge>
                              </div>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => startEdit(child)}>
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => onDelete(child)}>
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
              </>
            )}
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Select
                value={categoryParentId === null ? 'root' : categoryParentId || 'root'}
                onValueChange={(v) => setCategoryParentId(v === 'root' ? null : v)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">一级分类</SelectItem>
                  {categories
                    .filter((c) => !c.parentId)
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name} 的子分类
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="分类名称"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categoryColors.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategoryColor(c.value)}
                  className={`w-8 h-8 rounded-full ${
                    categoryColor === c.value ? 'ring-2 ring-offset-2 ring-slate-400' : ''
                  } ${
                    c.value === 'blue'
                      ? 'bg-blue-500'
                      : c.value === 'green'
                      ? 'bg-green-500'
                      : c.value === 'red'
                      ? 'bg-red-500'
                      : c.value === 'yellow'
                      ? 'bg-yellow-500'
                      : c.value === 'purple'
                      ? 'bg-purple-500'
                      : c.value === 'pink'
                      ? 'bg-pink-500'
                      : c.value === 'indigo'
                      ? 'bg-indigo-500'
                      : 'bg-cyan-500'
                  }`}
                  title={c.label}
                />
              ))}
            </div>
            <Button onClick={handleSave} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              {editingCategory ? '保存修改' : '添加分类'}
            </Button>
            {editingCategory && (
              <Button variant="outline" onClick={() => resetForm(true)} className="w-full">
                取消编辑
              </Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
