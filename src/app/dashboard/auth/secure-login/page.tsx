'use client';

import { useState, FormEvent, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Lock, RefreshCw, Shield } from 'lucide-react';

interface CaptchaData {
  token: string;
  code: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaData, setCaptchaData] = useState<CaptchaData | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchCaptcha = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/captcha');
      const data = await res.json();
      if (data.token && data.code) {
        setCaptchaData({ token: data.token, code: data.code });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }

    if (!captchaInput || !captchaData) {
      setError('请输入验证码');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          captchaToken: captchaData.token,
          captchaInput: captchaInput.toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '登录失败');
        fetchCaptcha();
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
    } catch {
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
                {captchaData ? (
                  <div
                    className="h-11 w-[140px] rounded border cursor-pointer bg-slate-50 flex items-center justify-center select-none overflow-hidden"
                    onClick={fetchCaptcha}
                    title="点击刷新验证码"
                  >
                    <svg width="140" height="44" viewBox="0 0 140 44">
                      <defs>
                        <filter id="noise-secure">
                          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
                          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
                          <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" />
                        </filter>
                      </defs>
                      <rect width="140" height="44" fill="#f8fafc" rx="4" />
                      {Array.from({ length: 3 }, (_, i) => (
                        <line
                          key={`line-${i}`}
                          x1={Math.sin(i * 1.7) * 30 + 20}
                          y1={Math.cos(i * 2.1) * 10 + 12}
                          x2={Math.cos(i * 1.3) * 30 + 120}
                          y2={Math.sin(i * 1.9) * 10 + 32}
                          stroke="#cbd5e1"
                          strokeWidth="1"
                          opacity="0.6"
                        />
                      ))}
                      {captchaData.code.split('').map((ch, i) => (
                        <text
                          key={i}
                          x={15 + i * 30 + Math.sin(i * 1.5) * 4}
                          y={28 + Math.cos(i * 2) * 5}
                          fontSize="22"
                          fontWeight="bold"
                          fill={`hsl(${(i * 60 + 200) % 360}, 60%, ${40 + i * 5}%)`}
                          transform={`rotate(${(i - 1.5) * 10}, ${15 + i * 30 + 12}, 28)`}
                          fontFamily="monospace"
                        >
                          {ch}
                        </text>
                      ))}
                    </svg>
                  </div>
                ) : (
                  <div className="h-11 w-[140px] rounded border bg-slate-100 animate-pulse" />
                )}
                <button
                  type="button"
                  onClick={fetchCaptcha}
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
