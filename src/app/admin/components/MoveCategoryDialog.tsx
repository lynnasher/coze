'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { QuestionBank, Category } from '../types';

interface MoveCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bank: QuestionBank | null;
  categories: Category[];
  onConfirm: (categoryId: string) => void;
}

// 按层级排序分类：父分类在前，子分类紧跟父分类，同级按 order 排序
function sortCategoriesByHierarchy(categories: Category[]): Category[] {
  const categoryMap = new Map<string, Category>();
  const childrenMap = new Map<string, Category[]>();

  categories.forEach((cat) => {
    categoryMap.set(cat.id, { ...cat, depth: 0 });
    if (cat.parentId) {
      if (!childrenMap.has(cat.parentId)) {
        childrenMap.set(cat.parentId, []);
      }
      childrenMap.get(cat.parentId)!.push(categoryMap.get(cat.id)!);
    }
  });

  const result: Category[] = [];

  const addCategoryWithChildren = (cat: Category, depth: number) => {
    cat.depth = depth;
    result.push(cat);
    const children = childrenMap.get(cat.id) || [];
    children.sort((a, b) => (a.order || 0) - (b.order || 0));
    children.forEach((child) => addCategoryWithChildren(child, depth + 1));
  };

  const rootCategories = categories
    .filter((c) => !c.parentId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  rootCategories.forEach((cat) => {
    addCategoryWithChildren(categoryMap.get(cat.id)!, 0);
  });

  return result;
}

export function MoveCategoryDialog({
  open,
  onOpenChange,
  bank,
  categories,
  onConfirm,
}: MoveCategoryDialogProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('uncategorized');

  useEffect(() => {
    if (open && bank) {
      setSelectedCategoryId(bank.categoryId || 'uncategorized');
    }
  }, [open, bank]);

  const handleConfirm = () => {
    onConfirm(selectedCategoryId === 'uncategorized' ? '' : selectedCategoryId);
    onOpenChange(false);
  };

  // 使用按层级排序后的分类
  const sortedCategories = useMemo(() => sortCategoriesByHierarchy(categories), [categories]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>移动题库到分类</DialogTitle>
          <DialogDescription>将「{bank?.name}」移动到指定分类</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="move-category">选择分类</Label>
          <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="选择分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="uncategorized">未分类</SelectItem>
              {sortedCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {(cat.depth || 0) > 0
                    ? `${'  '.repeat(cat.depth || 0)}└ ${cat.name}`
                    : cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm}>确认移动</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
