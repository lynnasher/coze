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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initDefaultAdmin();
  }, []);

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
    setError('');
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
