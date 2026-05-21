'use client';

import { useState, useEffect } from 'react';
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
              {categories
                .filter((c) => !c.parentId)
                .map((cat) => (
                  <SelectItem key={`parent-${cat.id}`} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              {categories
                .filter((c) => c.parentId)
                .map((child) => (
                  <SelectItem key={`child-${child.id}`} value={child.id}>
                    &nbsp;&nbsp;&nbsp;&nbsp;├ {child.name}
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
