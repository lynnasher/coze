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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Copy, Check, AlertTriangle, Download } from 'lucide-react';

interface TwoFactorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled: boolean;
  onStatusChange: (enabled: boolean) => void;
}

interface TwoFactorSetupData {
  enabled: boolean;
  secret?: string;
  qrCode?: string;
  backupCodes?: string[];
  manualEntryKey?: string;
  message?: string;
}

export function TwoFactorDialog({
  open,
  onOpenChange,
  enabled,
  onStatusChange,
}: TwoFactorDialogProps) {
  const [step, setStep] = useState<'loading' | 'setup' | 'verify' | 'backup' | 'disable'>('loading');
  const [setupData, setSetupData] = useState<TwoFactorSetupData | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // 获取 2FA 设置状态
  useEffect(() => {
    if (!open) return;

    const fetchStatus = async () => {
      setStep('loading');
      setError('');
      setSuccess('');

      try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch('/api/admin/2fa/setup', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (data.enabled) {
          setStep('disable');
          onStatusChange(true);
        } else {
          setSetupData(data);
          setStep('setup');
          onStatusChange(false);
        }
      } catch (err) {
        setError('获取 2FA 状态失败');
        setStep('setup');
      }
    };

    fetchStatus();
  }, [open, onStatusChange]);

  // 复制到剪贴板
  const copyToClipboard = async (text: string, type: 'key' | 'codes') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'key') {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      } else {
        setCopiedCodes(true);
        setTimeout(() => setCopiedCodes(false), 2000);
      }
    } catch {
      // 复制失败
    }
  };

  // 下载备用码
  const downloadBackupCodes = () => {
    if (!setupData?.backupCodes?.length) return;

    const content = `押题100 - 二次验证备用码\n生成时间: ${new Date().toLocaleString()}\n\n备用码（每个只能使用一次）:\n${setupData.backupCodes.join('\n')}\n\n请妥善保管，不要与他人分享！`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `押题100-备用码-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 验证并启用 2FA
  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      setError('请输入6位验证码');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/2fa/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ code: verifyCode }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('二次验证已成功启用！');
        setStep('backup');
        onStatusChange(true);
      } else {
        setError(data.error || '验证失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 禁用 2FA
  const handleDisable = async () => {
    if (!disableCode || disableCode.length !== 6) {
      setError('请输入6位验证码');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/2fa/setup', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ code: disableCode }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('二次验证已禁用');
        setTimeout(() => {
          onOpenChange(false);
          onStatusChange(false);
        }, 1500);
      } else {
        setError(data.error || '验证失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setVerifyCode('');
    setDisableCode('');
    setError('');
    setSuccess('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {enabled ? '关闭二次验证' : '设置二次验证'}
          </DialogTitle>
          <DialogDescription>
            {enabled
              ? '关闭二次验证会降低账户安全性'
              : '使用微软 Authenticator 或 Google Authenticator 扫描下方二维码'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {step === 'loading' && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            </div>
          )}

          {step === 'setup' && setupData && (
            <>
              {/* 二维码 */}
              <div className="flex flex-col items-center space-y-4">
                <div className="bg-white p-4 rounded-lg border">
                  {setupData.qrCode ? (
                    <img
                      src={setupData.qrCode}
                      alt="2FA QR Code"
                      className="w-48 h-48"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center bg-gray-100">
                      加载中...
                    </div>
                  )}
                </div>

                {/* 手动输入密钥 */}
                <div className="w-full space-y-2">
                  <Label>手动输入密钥</Label>
                  <div className="flex gap-2">
                    <Input
                      value={setupData.manualEntryKey || ''}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(setupData.manualEntryKey || '', 'key')}
                    >
                      {copiedKey ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* 验证码输入 */}
                <div className="w-full space-y-2">
                  <Label htmlFor="verifyCode">输入6位验证码</Label>
                  <Input
                    id="verifyCode"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="text-center text-2xl tracking-widest"
                    maxLength={6}
                  />
                </div>
              </div>
            </>
          )}

          {step === 'backup' && setupData?.backupCodes && (
            <>
              <Alert className="bg-amber-50 border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">
                  请保存以下备用码，每个码只能使用一次。当无法使用验证器时，可用备用码登录。
                </AlertDescription>
              </Alert>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {setupData.backupCodes.map((code, index) => (
                    <div
                      key={index}
                      className="font-mono text-sm bg-white p-2 rounded border text-center"
                    >
                      {code}
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => copyToClipboard(setupData.backupCodes?.join('\n') || '', 'codes')}
                >
                  {copiedCodes ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      复制备用码
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={downloadBackupCodes}
                >
                  <Download className="h-4 w-4 mr-2" />
                  下载备用码
                </Button>
              </div>
            </>
          )}

          {step === 'disable' && (
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  关闭二次验证后，您的账户安全性将降低。建议保持开启。
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="disableCode">输入6位验证码以确认关闭</Label>
                <Input
                  id="disableCode"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {step === 'backup' ? '完成' : '取消'}
          </Button>

          {step === 'setup' && (
            <Button
              onClick={handleVerify}
              disabled={verifyCode.length !== 6 || isLoading}
            >
              {isLoading ? '验证中...' : '启用'}
            </Button>
          )}

          {step === 'disable' && (
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={disableCode.length !== 6 || isLoading}
            >
              {isLoading ? '处理中...' : '确认关闭'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
