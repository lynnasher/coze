'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  LogOut, 
  User, 
  BookOpen,
  Key,
  Check,
  Copy,
  ChevronRight,
  Settings,
  UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TopNav } from '@/components/TopNav';
import { useUserStore } from '@/lib/store';

interface UserActivation {
  id: string;
  category_id: string;
  category_name: string;
  activation_code: string | null;
  activated_at: string;
  expires_at: string | null;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

export default function ProfilePage() {
  const { user: currentUser, isLoggedIn, logout, hasHydrated } = useUserStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [userActivations, setUserActivations] = useState<UserActivation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 激活码相关状态
  const [activationCode, setActivationCode] = useState('');
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [activationSuccess, setActivationSuccess] = useState('');

  useEffect(() => {
    if (hasHydrated && isLoggedIn()) {
      loadData();
    }
  }, [hasHydrated]);

  // 监听登录状态变化，自动刷新页面
  useEffect(() => {
    const handleAuthChange = () => {
      window.location.reload();
    };

    window.addEventListener('user-auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('user-auth-change', handleAuthChange);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    const token = localStorage.getItem('quiz_user_token');
    
    // 加载用户激活记录
    if (token) {
      try {
        const activationsRes = await fetch('/api/auth/user/activations', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (activationsRes.ok) {
          const data = await activationsRes.json();
          setUserActivations(data.activations || []);
        }
      } catch (error) {
        console.error('加载激活记录失败:', error);
      }
    }
    
    // 加载分类
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
    }
    
    setLoading(false);
  };

  // 使用激活码
  const handleActivateCode = async () => {
    if (!currentUser || !activationCode.trim()) {
      setActivationError('请输入激活码');
      return;
    }

    setActivationLoading(true);
    setActivationError('');
    setActivationSuccess('');

    try {
      const response = await fetch('/api/activation-codes/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: activationCode, userId: currentUser.id }),
      });

      const data = await response.json();

      if (data.success) {
        setActivationSuccess(`成功激活：${data.activation.category_name}`);
        setActivationCode('');
        // 刷新激活记录
        loadData();
      } else {
        setActivationError(data.error || '激活失败');
      }
    } catch {
      setActivationError('网络错误，请稍后重试');
    } finally {
      setActivationLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  // 格式化过期时间
  const formatExpireTime = (expiresAt: string | null): string => {
    if (!expiresAt) return '永久有效';
    const expireDate = new Date(expiresAt);
    const now = new Date();
    if (expireDate < now) return '已过期';
    
    const diff = expireDate.getTime() - now.getTime();
    const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
    if (days <= 7) return `${days}天后过期`;
    return expireDate.toLocaleDateString();
  };

  // 复制激活码
  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  // 等待挂载和 store 恢复
  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  // 未登录状态
  if (!isLoggedIn()) {
    return (
      <div className="min-h-screen bg-slate-50">
        <TopNav title="个人中心" showBack backHref="/" />
        
        <div className="max-w-[970px] mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-700 mb-2">未登录</h3>
          <p className="text-sm text-slate-400 mb-6">请先登录查看个人信息</p>
          <Link href="/?login=true">
            <Button className="bg-indigo-500 hover:bg-indigo-600 rounded-xl">
              去登录
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航 */}
      <TopNav 
        title="个人中心" 
        showBack 
        backHref="/"
        rightContent={
          <button
            onClick={handleLogout}
            className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            title="退出登录"
          >
            <LogOut className="w-5 h-5" />
          </button>
        }
      />

      {/* 主内容 */}
      <main className="max-w-[970px] mx-auto px-4 py-4">
        {/* 用户信息卡片 */}
        <Card className="mb-4 border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-md">
                <UserCircle className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-slate-900 truncate">
                  {currentUser?.nickname || '用户'}
                </h2>
                <p className="text-xs text-slate-500">{currentUser?.phone}</p>
                {currentUser?.role === 'admin' && (
                  <Badge variant="secondary" className="mt-0.5 text-xs">管理员</Badge>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xl font-bold text-orange-500">{userActivations.length}</div>
                <p className="text-xs text-slate-400">已激活</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 激活码激活 */}
        <Card className="mb-4 border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Key className="w-4 h-4 text-green-500" />
              激活码激活
            </h3>
            <div className="flex gap-2">
              <Input
                placeholder="请输入激活码"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                className="flex-1 text-sm h-9"
              />
              <Button 
                onClick={handleActivateCode} 
                disabled={activationLoading}
                size="sm" 
                className="px-4 bg-indigo-500 hover:bg-indigo-600"
              >
                {activationLoading ? '激活中...' : '激活'}
              </Button>
            </div>
            {activationError && (
              <p className="text-xs text-red-500 mt-2">{activationError}</p>
            )}
            {activationSuccess && (
              <p className="text-xs text-green-500 mt-2 flex items-center gap-1">
                <Check className="w-3 h-3" />
                {activationSuccess}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 已激活分类 */}
        <Card className="mb-4 border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              我的分类
              <Badge variant="secondary" className="ml-auto text-xs">{userActivations.length}</Badge>
            </h3>
            
            {userActivations.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">暂无已激活的分类</p>
              </div>
            ) : (
              <div className="space-y-2">
                {userActivations.map((activation) => {
                  const category = categories.find(c => c.id === activation.category_id);
                  const isExpired = activation.expires_at && new Date(activation.expires_at) < new Date();
                  
                  return (
                    <div 
                      key={activation.id} 
                      className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0"
                    >
                      {/* 分类图标 */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        category?.color === 'blue' ? 'bg-blue-50' :
                        category?.color === 'green' ? 'bg-green-50' :
                        category?.color === 'purple' ? 'bg-purple-50' :
                        category?.color === 'orange' ? 'bg-orange-50' :
                        category?.color === 'red' ? 'bg-red-50' :
                        'bg-slate-50'
                      }`}>
                        <BookOpen className={`w-4 h-4 ${
                          category?.color === 'blue' ? 'text-blue-500' :
                          category?.color === 'green' ? 'text-green-500' :
                          category?.color === 'purple' ? 'text-purple-500' :
                          category?.color === 'orange' ? 'text-orange-500' :
                          category?.color === 'red' ? 'text-red-500' :
                          'text-slate-500'
                        }`} />
                      </div>
                      
                      {/* 分类名称 */}
                      <span className="text-sm text-slate-700 flex-1 truncate">
                        {activation.category_name}
                      </span>
                      
                      {/* 激活码 */}
                      {activation.activation_code && (
                        <button
                          onClick={() => copyToClipboard(activation.activation_code!)}
                          className="flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 hover:bg-slate-200"
                        >
                          {activation.activation_code}
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                      
                      {/* 过期时间 */}
                      <span className={`text-xs flex-shrink-0 ${
                        isExpired ? 'text-red-500' :
                        activation.expires_at ? 'text-slate-500' : 'text-green-600'
                      }`}>
                        {isExpired ? '已过期' : formatExpireTime(activation.expires_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 快捷入口 */}
        <Link href="/library">
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-green-500 border-0 shadow-sm">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-slate-900 text-sm">开始练习</div>
                <div className="text-xs text-slate-400">进入题库浏览</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </CardContent>
          </Card>
        </Link>

        {currentUser?.role === 'admin' && (
          <Link href="/admin">
            <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-purple-500 border-0 shadow-sm mt-2">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <Settings className="w-5 h-5 text-purple-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-900 text-sm">后台管理</div>
                  <div className="text-xs text-slate-400">题库和用户管理</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </CardContent>
            </Card>
          </Link>
        )}
      </main>
    </div>
  );
}
