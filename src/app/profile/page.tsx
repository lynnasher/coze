'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { User, LogOut, BookOpen, Settings, ChevronRight, UserCircle } from 'lucide-react';
import Link from 'next/link';
import { sessionStore, userStore, logoutUser } from '@/lib/user-store';
import type { User as UserType, Category } from '@/lib/types';

export default function ProfilePage() {
  const [user, setUser] = useState<UserType | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banks, setBanks] = useState<{ id: string; name: string; questionIds: string[]; categoryId?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = () => {
    const currentUser = sessionStore.getCurrentUser();
    if (!currentUser) {
      // 未登录，跳转到首页
      window.location.href = '/';
      return;
    }
    setUser(currentUser);
  };

  const loadData = () => {
    // 加载分类
    const storedCategories = localStorage.getItem('quiz_categories');
    if (storedCategories) {
      setCategories(JSON.parse(storedCategories));
    }
    
    // 加载题库
    const storedBanks = localStorage.getItem('quiz_banks');
    if (storedBanks) {
      setBanks(JSON.parse(storedBanks));
    }
    
    setLoading(false);
  };

  const handleToggleCategory = (categoryId: string, isActivated: boolean) => {
    if (!user) return;
    
    if (isActivated) {
      userStore.deactivateCategory(user.id, categoryId);
    } else {
      userStore.activateCategory(user.id, categoryId);
    }
    
    // 刷新用户数据
    const updatedUser = userStore.getById(user.id);
    if (updatedUser) {
      setUser(updatedUser);
    }
  };

  const handleActivateAll = () => {
    if (!user) return;
    const topLevelCategories = categories.filter(c => !c.parentId);
    const allCategoryIds = topLevelCategories.map(c => c.id);
    userStore.activateCategories(user.id, allCategoryIds);
    
    const updatedUser = userStore.getById(user.id);
    if (updatedUser) {
      setUser(updatedUser);
    }
  };

  const handleDeactivateAll = () => {
    if (!user) return;
    const topLevelCategories = categories.filter(c => !c.parentId);
    topLevelCategories.forEach(cat => {
      userStore.deactivateCategory(user.id, cat.id);
    });
    
    const updatedUser = userStore.getById(user.id);
    if (updatedUser) {
      setUser(updatedUser);
    }
  };

  const handleLogout = () => {
    logoutUser();
    window.location.href = '/';
  };

  const getCategoryQuestionCount = (categoryId: string) => {
    const categoryBanks = banks.filter(b => b.categoryId === categoryId);
    return categoryBanks.reduce((sum, bank) => sum + bank.questionIds.length, 0);
  };

  const activatedCategories = user?.activatedCategories || [];
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
                <div className="text-2xl font-bold text-blue-600">{activatedCategories.length}</div>
                <p className="text-xs text-gray-500">已激活分类</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 分类激活管理 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-500" />
                  题库分类管理
                </CardTitle>
                <CardDescription>
                  激活的分类可以在练习页面中选择和练习
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleActivateAll}>
                  全选
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeactivateAll}>
                  取消全部
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {topLevelCategories.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无分类</p>
              </div>
            ) : (
              topLevelCategories.map((category) => {
                const isActivated = activatedCategories.includes(category.id);
                const questionCount = getCategoryQuestionCount(category.id);
                
                return (
                  <div key={category.id}>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isActivated ? 'bg-blue-100' : 'bg-gray-200'
                        }`}>
                          <BookOpen className={`w-5 h-5 ${isActivated ? 'text-blue-600' : 'text-gray-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900">{category.name}</div>
                          <div className="text-xs text-gray-400">
                            {questionCount} 道题目
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isActivated && (
                          <Badge variant="default" className="bg-blue-500">已激活</Badge>
                        )}
                        <Switch
                          checked={isActivated}
                          onCheckedChange={(checked) => handleToggleCategory(category.id, checked)}
                        />
                      </div>
                    </div>
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
