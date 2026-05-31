'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LogOut, BookOpen, Settings, ChevronRight, UserCircle, Key, Check, Copy, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getCurrentUser, clearUserCache } from '@/components/AuthModal';
import { STORAGE_KEYS } from '@/lib/constants';
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

  // 修改密码相关状态
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

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

  const loadData = async (_retryCount = 0) => {
    // 从 API 获取用户已激活的分类记录（优先加载，因为需要验证 token）
    const token = localStorage.getItem('quiz_user_token');
    if (token) {
      try {
        const activationsRes = await fetch('/api/auth/user/activations', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (activationsRes.status === 401) {
          // Token 过期，需要重新登录
          alert('登录已过期，请重新登录');
          localStorage.removeItem('quiz_user_token');
          localStorage.removeItem('quiz_user_data');
          window.location.href = '/';
          return;
        }
        
        if (activationsRes.ok) {
          const activationsData = await activationsRes.json();
          // 设置用户激活记录
          setUserActivations(activationsData.activations || []);
        }
      } catch (error) {
        // 忽略错误
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
      // 忽略错误
    }
    
    // 加载题库
    try {
      const banksResponse = await fetch('/api/banks');
      if (banksResponse.ok) {
        const banksData = await banksResponse.json();
        setBanks(banksData.banks || []);
      }
    } catch (error) {
      // 忽略错误
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
      // 使用管理员 token（如果有的话），否则使用用户 token
      const adminToken = localStorage.getItem('admin_token');
      const userToken = localStorage.getItem('quiz_user_token');
      const token = adminToken || userToken;
      
      await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ userId: user.id, action: 'categories', value: updatedCategories }),
      });

      const updatedUser = { ...user, activated_categories: updatedCategories };
      setUser(updatedUser);
      localStorage.setItem('quiz_user_data', JSON.stringify(updatedUser));
    } catch {
      // 忽略错误
    }
  };

  const handleLogout = () => {
    // 清除 Token
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    // 清除用户数据
    localStorage.removeItem(STORAGE_KEYS.USER);
    // 清除用户缓存
    clearUserCache();
    // 清除答题记录和错题数据（避免切换账号时看到之前用户的数据）
    localStorage.removeItem(STORAGE_KEYS.RECORDS);
    localStorage.removeItem(STORAGE_KEYS.WRONG_STREAK);
    localStorage.removeItem(STORAGE_KEYS.RECENT_PRACTICE);
    
    // 触发事件通知其他组件
    window.dispatchEvent(new Event('user-auth-change'));
    
    // 刷新页面
    window.location.reload();
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

  // 修改密码
  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('请填写所有密码字段');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('新密码长度至少6位');
      return;
    }

    setPasswordLoading(true);
    try {
      const token = localStorage.getItem('quiz_user_token');
      const response = await fetch('/api/auth/user/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPasswordError(data.error || '修改密码失败');
        return;
      }

      setPasswordSuccess('密码修改成功');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowChangePassword(false);
        setPasswordSuccess('');
      }, 2000);
    } catch {
      setPasswordError('网络错误，请重试');
    } finally {
      setPasswordLoading(false);
    }
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

  // 按分类去重激活记录，选择最优惠的（永久有效优先，否则选更晚到期的）
  const getUniqueActivations = () => {
    const uniqueActivations = new Map<string, UserActivation>();
    for (const a of userActivations) {
      const existing = uniqueActivations.get(a.category_id);
      if (!existing) {
        uniqueActivations.set(a.category_id, a);
      } else {
        // 选择更优惠的：永久有效优先，否则选更晚到期的
        const aIsPermanent = !a.expires_at;
        const existingIsPermanent = !existing.expires_at;
        if (aIsPermanent && !existingIsPermanent) {
          uniqueActivations.set(a.category_id, a);
        } else if (!aIsPermanent && !existingIsPermanent) {
          // 都不是永久，选更晚到期的
          if (new Date(a.expires_at!) > new Date(existing.expires_at!)) {
            uniqueActivations.set(a.category_id, a);
          }
        }
      }
    }
    return Array.from(uniqueActivations.values());
  };
  const uniqueActivations = getUniqueActivations();

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
      <header className="bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-[970px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* 产品标识 */}
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-md">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">智能刷题</h1>
                <p className="text-xs text-gray-400">{uniqueActivations.length} 个已激活分类</p>
              </div>
            </Link>
            
            {/* 用户信息 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 hidden sm:block">
                {user?.nickname || user?.phone}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="rounded-xl">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-[970px] mx-auto px-4 py-4">
        {/* 用户信息卡片 - 紧凑横向布局 */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-md">
                <UserCircle className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-gray-900 truncate">{user?.nickname || '用户'}</h2>
                <p className="text-xs text-gray-500">{user?.phone}</p>
                {user?.role === 'admin' && (
                  <Badge variant="secondary" className="mt-0.5 text-xs">管理员</Badge>
                )}
              </div>
              <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                <div>
                  <div className="text-xl font-bold text-orange-500">{uniqueActivations.length}</div>
                  <p className="text-xs text-gray-400">已激活</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowChangePassword(true)}
                  className="text-xs h-7 px-2"
                >
                  <Key className="w-3 h-3 mr-1" />
                  修改密码
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 修改密码对话框 */}
        <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>修改密码</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm">原密码</Label>
                <Input
                  type="password"
                  placeholder="请输入原密码"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">新密码</Label>
                <Input
                  type="password"
                  placeholder="请输入新密码（至少6位）"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">确认新密码</Label>
                <Input
                  type="password"
                  placeholder="请再次输入新密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {passwordError && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{passwordError}</AlertDescription>
                </Alert>
              )}
              {passwordSuccess && (
                <Alert className="py-2 border-green-500 text-green-700">
                  <Check className="h-4 w-4" />
                  <AlertDescription className="text-xs">{passwordSuccess}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowChangePassword(false)} size="sm">
                取消
              </Button>
              <Button onClick={handleChangePassword} disabled={passwordLoading} size="sm">
                {passwordLoading ? '修改中...' : '确认修改'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 激活码激活 - 紧凑卡片 */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Key className="w-4 h-4 text-green-500" />
              激活码激活
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="请输入激活码"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                className="flex-1 text-sm h-9"
              />
              <Button onClick={handleActivateCode} disabled={activationLoading} size="sm" className="px-4">
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

        {/* 分类激活管理 - 紧凑表格 */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              我的分类
              <Badge variant="secondary" className="ml-auto text-xs">{uniqueActivations.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {uniqueActivations.length === 0 ? (
              <div className="text-center py-4 text-gray-400">
                <BookOpen className="w-6 h-6 mx-auto mb-1 opacity-50" />
                <p className="text-xs">暂无已激活的分类</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {uniqueActivations.map((activation) => {
                  const category = categories.find(c => c.id === activation.category_id);
                  const isExpired = activation.expires_at && new Date(activation.expires_at) < new Date();
                  
                  return (
                    <div key={activation.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                      {/* 分类名称 */}
                      <div className="flex items-center gap-2 min-w-0 flex-[2]">
                        <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                          category?.color === 'blue' ? 'bg-blue-100' :
                          category?.color === 'green' ? 'bg-green-100' :
                          category?.color === 'purple' ? 'bg-purple-100' :
                          category?.color === 'orange' ? 'bg-orange-100' :
                          category?.color === 'red' ? 'bg-red-100' :
                          category?.color === 'pink' ? 'bg-pink-100' :
                          category?.color === 'cyan' ? 'bg-cyan-100' :
                          'bg-gray-100'
                        }`}>
                          <BookOpen className={`w-3 h-3 ${
                            category?.color === 'blue' ? 'text-blue-600' :
                            category?.color === 'green' ? 'text-green-600' :
                            category?.color === 'purple' ? 'text-purple-600' :
                            category?.color === 'orange' ? 'text-orange-600' :
                            category?.color === 'red' ? 'text-red-600' :
                            category?.color === 'pink' ? 'text-pink-600' :
                            category?.color === 'cyan' ? 'text-cyan-600' :
                            'text-gray-600'
                          }`} />
                        </div>
                        <span className="text-sm text-gray-700 truncate">{activation.category_name}</span>
                      </div>
                      
                      {/* 激活码 */}
                      <div className="flex items-center gap-1.5 flex-[1.5]">
                        {activation.activation_code ? (
                          <>
                            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">
                              {activation.activation_code}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(activation.activation_code!)}
                              className="h-5 w-5 p-0 text-gray-400 hover:text-gray-600"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                      
                      {/* 到期日期 */}
                      <div className={`text-xs flex-shrink-0 ${
                        isExpired ? 'text-red-500' :
                        activation.expires_at ? 'text-gray-500' : 'text-green-600'
                      }`}>
                        {isExpired ? '已过期' : formatExpireTime(activation.expires_at)}
                      </div>
                      
                      {/* 管理员删除按钮 */}
                      {user?.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleCategory(activation.category_id, true)}
                          className="text-red-400 hover:text-red-500 hover:bg-red-50 h-6 w-6 p-0"
                        >
                          <LogOut className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 快捷入口 - 单列显示 */}
        <Link href="/">
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-green-500">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900 text-sm">开始练习</div>
                <div className="text-xs text-gray-400">进入题库浏览</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </CardContent>
          </Card>
        </Link>

        {user?.role === 'admin' && (
          <Link href="/admin">
            <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-purple-500 mt-2">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Settings className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 text-sm">后台管理</div>
                  <div className="text-xs text-gray-400">题库和用户管理</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </CardContent>
            </Card>
          </Link>
        )}
      </main>
    </div>
  );
}
