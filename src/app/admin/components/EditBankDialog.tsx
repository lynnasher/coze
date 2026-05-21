'use client';

import { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface EditBankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankName: string;
  bankDesc: string;
  onNameChange: (name: string) => void;
  onDescChange: (desc: string) => void;
  onSave: () => void;
}

export function EditBankDialog({
  open,
  onOpenChange,
  bankName,
  bankDesc,
  onNameChange,
  onDescChange,
  onSave,
}: EditBankDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑题库</DialogTitle>
          <DialogDescription>修改题库的名称和描述</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="bank-name">题库名称</Label>
            <Input
              id="bank-name"
              ref={inputRef}
              value={bankName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="请输入题库名称"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bank-desc">描述（可选）</Label>
            <Textarea
              id="bank-desc"
              value={bankDesc}
              onChange={(e) => onDescChange(e.target.value)}
              placeholder="请输入题库描述"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSave} disabled={!bankName.trim()}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
