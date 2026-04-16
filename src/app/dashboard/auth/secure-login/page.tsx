'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Lock, LogIn, RefreshCw, Shield } from 'lucide-react';
import { useCaptcha, CaptchaDisplay, verifyCaptcha } from '@/components/Captcha';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { code, canvasRef, refresh: refreshCaptcha } = useCaptcha({ length: 4, width: 140, height: 44 });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // 验证验证码
    if (!verifyCaptcha(captchaInput, code)) {
      setError('验证码错误，请重新输入');
      refreshCaptcha();
      setCaptchaInput('');
      return;
    }

    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '登录失败');
        refreshCaptcha();
        setCaptchaInput('');
        return;
      }

      // 保存 token 到 localStorage
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
      
      // 检查是否需要强制修改密码
      if (data.needChangePassword) {
        router.push('/admin/change-password');
      } else {
        router.push('/admin');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">题库管理后台</CardTitle>
          <CardDescription className="text-center">
            请输入管理员账号登录
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="captcha">验证码</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="captcha"
                  type="text"
                  placeholder="请输入验证码"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value.toUpperCase())}
                  required
                  maxLength={4}
                  className="flex-1"
                  autoComplete="off"
                />
                <CaptchaDisplay code={code} canvasRef={canvasRef} />
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  className="p-2 hover:bg-slate-100 rounded-md transition-colors"
                  title="刷新验证码"
                >
                  <RefreshCw className="h-5 w-5 text-slate-500" />
                </button>
              </div>
            </div>
  
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  登录中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  登录
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            <p>请妥善保管您的账号密码</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
