'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { User, LogOut, BookOpen, Settings, ChevronRight, UserCircle, Key, Check, Clock, Copy } from 'lucide-react';
import Link from 'next/link';
import { getCurrentUser } from '@/components/AuthModal';
import { format } from 'date-fns';

interface StoredUser {
  id: string;
  phone: string;
  nickname?: string;
  role: string;
  activated_categories: string[];
}

interface Category {
  id: string;
  name: string;
  color: string;
  order: number;
  parentId?: string;
}

interface UserActivation {
  id: string;
  user_id: string;
  category_id: string;
  category_name: string;
  activation_code: string | null;
  activated_at: string;
  expires_at: string | null;
}

interface ActivationCode {
  id: string;
  code: string;
  category_id: string;
  category_name: string;
  type: string;
  max_uses: number;
  uses: number;
  expires_at: string | null;
  status: string;
  created_at: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banks, setBanks] = useState<{ id: string; name: string; questionIds: string[]; categoryId?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [userActivations, setUserActivations] = useState<UserActivation[]>([]);
  
  // 激活码相关状态
  const [activationCode, setActivationCode] = useState('');
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [activationSuccess, setActivationSuccess] = useState('');

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = () => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      window.location.href = '/';
      return;
    }
    setUser(currentUser);
  };

  const loadData = async () => {
    // 从数据库加载分类
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
    }
    
    // 备用：从 localStorage 获取
    const storedCategories = localStorage.getItem('quiz_categories');
    if (storedCategories && categories.length === 0) {
      setCategories(JSON.parse(storedCategories));
    }
    
    // 从 API 获取用户已激活的分类记录
    const token = localStorage.getItem('quiz_user_token');
    if (token) {
      try {
        const activationsRes = await fetch('/api/auth/user/activations', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (activationsRes.ok) {
          const activationsData = await activationsRes.json();
          // 设置用户激活记录
          setUserActivations(activationsData.activations || []);
        }
      } catch (error) {
        console.error('加载激活记录失败:', error);
      }
    }
    
    setLoading(false);
  };

  // 使用激活码
  const handleActivateCode = async () => {
    if (!user || !activationCode.trim()) {
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
        body: JSON.stringify({ code: activationCode, userId: user.id }),
      });

      const data = await response.json();

      if (data.success) {
        setActivationSuccess(`成功激活：${data.activation.category_name}`);
        setActivationCode('');
        
        // 刷新用户数据
        const updatedCategories = [...new Set([...user.activated_categories, data.activation.category_id])];
        const updatedUser = { ...user, activated_categories: updatedCategories };
        setUser(updatedUser);
        localStorage.setItem('quiz_user_data', JSON.stringify(updatedUser));
        
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

  // 直接切换分类激活状态（管理员功能）
  const handleToggleCategory = async (categoryId: string, isActivated: boolean) => {
    if (!user || user.role !== 'admin') return;

    const updatedCategories = isActivated
      ? user.activated_categories.filter(c => c !== categoryId)
      : [...user.activated_categories, categoryId];

    try {
      await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'categories', value: updatedCategories }),
      });

      const updatedUser = { ...user, activated_categories: updatedCategories };
      setUser(updatedUser);
      localStorage.setItem('quiz_user_data', JSON.stringify(updatedUser));
    } catch {
      console.error('更新分类失败');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('quiz_user_token');
    localStorage.removeItem('quiz_user_data');
    window.location.href = '/';
  };

  const getCategoryQuestionCount = (categoryId: string) => {
    const categoryBanks = banks.filter(b => b.categoryId === categoryId);
    return categoryBanks.reduce((sum, bank) => sum + bank.questionIds.length, 0);
  };

  // 获取分类的完整路径（包含父分类名称）
  const getCategoryFullPath = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return categoryId;
    
    if (category.parentId) {
      const parent = categories.find(c => c.id === category.parentId);
      if (parent) {
        return `${parent.name} > ${category.name}`;
      }
    }
    return category.name;
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

  // 获取分类对应的激活码信息
  const getActivationForCategory = (categoryId: string): UserActivation | undefined => {
    return userActivations.find(a => a.category_id === categoryId);
  };

  // 复制激活码
  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  const activatedCategories = user?.activated_categories || [];
  const topLevelCategories = categories.filter(c => !c.parentId);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-gray-900">智能刷题助手</span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {user?.nickname || user?.phone}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 用户信息卡片 */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                <UserCircle className="w-10 h-10 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{user?.nickname || '用户'}</h2>
                <p className="text-gray-500 text-sm">{user?.phone}</p>
                {user?.role === 'admin' && (
                  <Badge variant="secondary" className="mt-1">管理员</Badge>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{userActivations.length}</div>
                <p className="text-xs text-gray-500">已激活分类</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 激活码激活 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="w-5 h-5 text-green-500" />
              激活码激活
            </CardTitle>
            <CardDescription>
              输入激活码获取分类访问权限
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="请输入激活码"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                className="flex-1"
              />
              <Button onClick={handleActivateCode} disabled={activationLoading}>
                {activationLoading ? '激活中...' : '激活'}
              </Button>
            </div>
            {activationError && (
              <p className="text-sm text-red-500 mt-2">{activationError}</p>
            )}
            {activationSuccess && (
              <p className="text-sm text-green-500 mt-2 flex items-center gap-1">
                <Check className="w-4 h-4" />
                {activationSuccess}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 分类激活管理 - 显示已激活的分类和对应的激活码 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-500" />
                  我的分类
                </CardTitle>
                <CardDescription>
                  已激活的分类及其激活码信息
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {userActivations.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无已激活的分类</p>
                <p className="text-xs mt-1">请使用激活码激活分类</p>
              </div>
            ) : (
              userActivations.map((activation) => {
                const questionCount = getCategoryQuestionCount(activation.category_id);
                const category = categories.find(c => c.id === activation.category_id);
                
                return (
                  <div key={activation.id} className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900">{activation.category_name}</div>
                          <div className="text-xs text-gray-400">
                            {questionCount} 道题目
                          </div>
                        </div>
                      </div>
                      <Badge variant="default" className="bg-blue-500 flex-shrink-0">已激活</Badge>
                    </div>
                    
                    {/* 激活码信息 */}
                    {activation.activation_code && (
                      <div className="mt-3 pt-3 border-t border-blue-100">
                        <div className="flex items-center justify-between bg-white rounded-lg p-2">
                          <div className="flex items-center gap-2">
                            <Key className="w-4 h-4 text-gray-400" />
                            <span className="font-mono text-sm font-medium text-gray-700">
                              {activation.activation_code}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(activation.activation_code!)}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            <span>{formatExpireTime(activation.expires_at)}</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 mt-1 px-1">
                          激活时间：{new Date(activation.activated_at).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                    
                    {/* 管理员可取消激活 */}
                    {user?.role === 'admin' && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleCategory(activation.category_id, true)}
                          className="text-red-500 border-red-200 hover:bg-red-50"
                        >
                          取消激活
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* 快捷入口 */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">开始练习</div>
                    <div className="text-xs text-gray-400">进入练习页面</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </CardContent>
            </Card>
          </Link>
          {user?.role === 'admin' && (
            <Link href="/admin">
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Settings className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">后台管理</div>
                      <div className="text-xs text-gray-400">题库和用户管理</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
