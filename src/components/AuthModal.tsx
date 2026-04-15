'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User as UserIcon, LogOut, UserCircle, Shield } from 'lucide-react';
import { sessionStore, registerUser, loginUser, logoutUser, initDefaultAdmin } from '@/lib/user-store';
import type { User as UserType } from '@/lib/types';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthChange?: () => void;
}

export function AuthModal({ open, onOpenChange, onAuthChange }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initDefaultAdmin();
  }, []);

  // 倒计时效果
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 获取验证码
  const handleGetVerifyCode = async () => {
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, type: 'send' }),
      });

      const data = await response.json();

      if (data.success) {
        setCountdown(60);
        // 测试模式下显示验证码
        if (data.testCode) {
          alert(`【测试模式】验证码: ${data.testCode}`);
        }
      } else {
        setError(data.error || '获取验证码失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const result = loginUser(phone, password);
        if (result.success) {
          onOpenChange(false);
          onAuthChange?.();
        } else {
          setError(result.error || '登录失败');
        }
      } else {
        // 注册时验证验证码
        if (!verifyCode) {
          setError('请输入验证码');
          setLoading(false);
          return;
        }

        // 验证验证码
        const verifyResponse = await fetch('/api/auth/code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, code: verifyCode, type: 'verify' }),
        });

        const verifyData = await verifyResponse.json();

        if (!verifyData.success) {
          setError(verifyData.error || '验证码错误');
          setLoading(false);
          return;
        }

        const result = registerUser(phone, password, nickname);
        if (result.success) {
          onOpenChange(false);
          onAuthChange?.();
        } else {
          setError(result.error || '注册失败');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPhone('');
    setPassword('');
    setNickname('');
    setVerifyCode('');
    setError('');
    setCountdown(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            {mode === 'login' ? '登录账号' : '注册账号'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => { setMode(v as 'login' | 'register'); resetForm(); }} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">手机号</label>
                <Input
                  type="tel"
                  placeholder="请输入手机号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={11}
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">密码</label>
                <Input
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>
              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}
              <Button type="submit" className="w-full rounded-xl" disabled={loading}>
                {loading ? '登录中...' : '登录'}
              </Button>
              <p className="text-xs text-gray-400 text-center">
                测试账号：admin / admin123
              </p>
            </form>
          </TabsContent>

          <TabsContent value="register" className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">手机号</label>
                <div className="flex gap-2">
                  <Input
                    type="tel"
                    placeholder="请输入手机号"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={11}
                    required
                    className="rounded-xl flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl whitespace-nowrap"
                    onClick={handleGetVerifyCode}
                    disabled={loading || countdown > 0}
                  >
                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">验证码</label>
                <Input
                  type="text"
                  placeholder="请输入验证码"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">昵称（选填）</label>
                <Input
                  type="text"
                  placeholder="请输入昵称"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">密码</label>
                <Input
                  type="password"
                  placeholder="请输入密码（至少6位）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  className="rounded-xl"
                />
              </div>
              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}
              <Button type="submit" className="w-full rounded-xl" disabled={loading}>
                {loading ? '注册中...' : '注册'}
              </Button>
              <p className="text-xs text-gray-400 text-center">
                注册即表示同意《用户协议》
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// 用户状态显示组件
interface UserStatusProps {
  className?: string;
}

export function UserStatus({ className }: UserStatusProps) {
  const [user, setUser] = useState<UserType | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    const currentUser = sessionStore.getCurrentUser();
    setUser(currentUser);
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
  };

  if (user) {
    return (
      <div className={`flex items-center gap-2 ${className || ''}`}>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
          <UserCircle className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-medium text-slate-700">
            {user.nickname || user.phone}
          </span>
          {user.role === 'admin' && (
            <Shield className="w-3.5 h-3.5 text-amber-500" />
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-slate-500 hover:text-slate-700 rounded-full"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setAuthModalOpen(true)}
        className="rounded-full gap-1.5"
      >
        <UserIcon className="w-4 h-4" />
        <span>登录</span>
      </Button>
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onAuthChange={checkAuth}
      />
    </>
  );
}

// 需要登录的高阶组件
interface RequireAuthProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireAuth({ children, fallback }: RequireAuthProps) {
  const [user, setUser] = useState<UserType | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    const currentUser = sessionStore.getCurrentUser();
    setUser(currentUser);
    if (!currentUser) {
      setAuthModalOpen(true);
    }
  }, []);

  if (!user) {
    return (
      <>
        {fallback}
        <AuthModal
          open={authModalOpen}
          onOpenChange={setAuthModalOpen}
          onAuthChange={() => {
            const currentUser = sessionStore.getCurrentUser();
            setUser(currentUser);
          }}
        />
      </>
    );
  }

  return <>{children}</>;
}
