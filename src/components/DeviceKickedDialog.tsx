'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Smartphone, AlertTriangle } from 'lucide-react';

interface DeviceKickedDialogProps {
  open: boolean;
  message?: string;
  onConfirm: () => void;
}

/**
 * 设备被挤下线提示弹窗
 * 当用户账号在其他设备登录时显示
 */
export function DeviceKickedDialog({ 
  open, 
  message = '您的账号已在其他设备登录',
  onConfirm 
}: DeviceKickedDialogProps) {
  // 防止按 ESC 关闭
  useEffect(() => {
    if (open) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <DialogTitle className="text-xl">账号已在其他设备登录</DialogTitle>
          <DialogDescription className="text-base mt-2">
            {message}
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-slate-50 rounded-lg p-4 mt-4">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-slate-400" />
            <div className="text-sm text-slate-600">
              <p>为保障账号安全，同一时间仅支持一台设备在线</p>
              <p className="mt-1 text-slate-400">如需在此设备使用，请重新登录</p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Button 
            onClick={onConfirm}
            className="w-full bg-slate-800 hover:bg-slate-700"
          >
            我知道了
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
