'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User as UserIcon, LogOut, UserCircle, CheckCircle } from 'lucide-react';
import type { User as UserType } from '@/lib/types';
import { cloudSyncService } from '@/lib/quiz-store';

import { STORAGE_KEYS } from '@/lib/constants';

// 使用统一的常量
const TOKEN_KEY = STORAGE_KEYS.TOKEN;
const USER_KEY = STORAGE_KEYS.USER;
const DEVICE_KEY = STORAGE_KEYS.DEVICE_ID;

interface StoredUser {
  id: string;
  phone: string;
  nickname?: string;
  role: string;
  activated_categories: string[];
}

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
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  
  // 跟踪组件是否已挂载
  const isMountedRef = useRef(true);

  // 组件挂载/卸载跟踪
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
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
        body: JSON.stringify({ phone, type: 'send', action: mode }), // mode: 'register' | 'login'
      });

      const data = await response.json();

      if (data.success) {
        setCountdown(60);
        // 弹窗提示用户注意查收
        setShowSuccessDialog(true);
        if (data.testCode) {
          alert(`验证码: ${data.testCode}`);
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
        // 用户登录
        const response = await fetch('/api/auth/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'login', phone, password }),
        });

        const data = await response.json();

        if (data.success) {
          localStorage.setItem(TOKEN_KEY, data.token);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          userCache = data.user; // 更新缓存
          // 保存设备ID（用于单设备登录验证）
          if (data.deviceId) {
            localStorage.setItem(DEVICE_KEY, data.deviceId);
          }
          onOpenChange(false);
          onAuthChange?.();
          // 通知其他组件用户状态变化
          window.dispatchEvent(new Event('user-auth-change'));
          
          // 登录成功后同步云端数据（检查组件是否已挂载）
          cloudSyncService.syncOnLogin().then(success => {
            if (success && isMountedRef.current) {
              // 数据同步成功
              // 通知页面刷新数据
              window.dispatchEvent(new Event('storage'));
            }
          });
        } else {
          setError(data.error || '登录失败');
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

        // 注册
        const response = await fetch('/api/auth/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'register', phone, password, nickname }),
        });

        const data = await response.json();

        if (data.success) {
          localStorage.setItem(TOKEN_KEY, data.token);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          userCache = data.user; // 更新缓存
          // 保存设备ID（用于单设备登录验证）
          if (data.deviceId) {
            localStorage.setItem(DEVICE_KEY, data.deviceId);
          }
          onOpenChange(false);
          onAuthChange?.();
          // 通知其他组件用户状态变化
          window.dispatchEvent(new Event('user-auth-change'));
          
          // 注册成功后同步云端数据（清空本地旧数据，拉取新用户数据）
          cloudSyncService.syncOnLogin().then(success => {
            if (success && isMountedRef.current) {
              // 数据同步成功，通知页面刷新
              window.dispatchEvent(new Event('storage'));
            }
          });
        } else {
          setError(data.error || '注册失败');
        }
      }
    } catch {
      setError('网络错误，请稍后重试');
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
    <>
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
    
    {/* 验证码发送成功弹窗 */}
    <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <DialogTitle className="text-xl">验证码已发送</DialogTitle>
          <DialogDescription className="text-base mt-2">
            【云渚科技验证平台】您的验证码已发送，请在手机查收。
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <Button 
            onClick={() => setShowSuccessDialog(false)}
            className="w-full rounded-xl"
          >
            我知道了
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

// 用户状态显示组件
interface UserStatusProps {
  className?: string;
}

export function UserStatus({ className }: UserStatusProps) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const checkAuth = () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const userData = localStorage.getItem(USER_KEY);
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        clearUserCache(); // 清除缓存
        setUser(null);
      }
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    checkAuth();
    
    // 监听 localStorage 变化
    const handleStorageChange = () => {
      clearUserCache(); // 清除缓存以读取最新数据
      checkAuth();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('user-auth-change', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('user-auth-change', handleStorageChange);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    clearUserCache(); // 清除缓存
    // 清除用户相关的错题数据（避免切换账号时看到之前用户的数据）
    localStorage.removeItem(STORAGE_KEYS.RECORDS);
    localStorage.removeItem(STORAGE_KEYS.WRONG_STREAK);
    localStorage.removeItem(STORAGE_KEYS.RECENT_PRACTICE);
    setUser(null);
    // 触发认证状态变化事件
    window.dispatchEvent(new Event('user-auth-change'));
    // 刷新页面以清除所有状态
    window.location.reload();
  };

  if (user) {
    return (
      <div className={`flex items-center gap-2 ${className || ''}`}>
        <a href="/profile" className="flex items-center justify-center w-8 h-8 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
          <UserCircle className="w-4 h-4 text-slate-600" />
        </a>
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

// 用户缓存（减少重复 localStorage 读取）
let userCache: StoredUser | null = null;
let cacheInitialized = false;

// 获取当前用户
export function getCurrentUser(): StoredUser | null {
  // 首次调用或已失效时读取 localStorage
  if (!cacheInitialized) {
    const userData = localStorage.getItem(USER_KEY);
    if (userData) {
      try {
        userCache = JSON.parse(userData);
      } catch {
        userCache = null;
      }
    }
    cacheInitialized = true;
  }
  return userCache;
}

// 清除用户缓存（登录/登出时调用）
export function clearUserCache(): void {
  userCache = null;
  cacheInitialized = false;
}

// 获取用户 Token
export function getUserToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
