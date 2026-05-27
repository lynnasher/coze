'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLoginPath } from '@/lib/admin-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Key,
  MoreHorizontal,
  Plus,
  Search,
  LogOut,
  ArrowLeft,
  Trash2,
  RefreshCw,
  Copy,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar as CalendarIcon,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface Category {
  id: string;
  name: string;
  color: string;
  order: number;
  parentId?: string;
}

interface ActivationUser {
  user_id: string;
  user_phone?: string;
  user_nickname?: string;
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
  description: string | null;
  created_at: string;
  activated_users?: ActivationUser[];
}

export default function ActivationCodesPage() {
  const router = useRouter();
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<{ username: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [categories, setCategories] = useState<Category[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  // 创建表单状态
  const [selectedCategory, setSelectedCategory] = useState('');
  const [expireType, setExpireType] = useState<'permanent' | 'days' | 'date'>('days');
  const [expireDays, setExpireDays] = useState('30');
  const [expireDate, setExpireDate] = useState<Date | undefined>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 默认30天后
  );
  const [codeCount, setCodeCount] = useState('1');
  const [creating, setCreating] = useState(false);

  // 检查管理员登录状态
  useEffect(() => {
    checkAuth();
    loadCategories();
  }, []);

  const checkAuth = () => {
    const token = localStorage.getItem('admin_token');
    const userData = localStorage.getItem('admin_user');
    if (!token || !userData) {
      router.push(getLoginPath());
      return;
    }
    try {
      const user = JSON.parse(userData);
      setCurrentUser(user);
    } catch {
      router.push(getLoginPath());
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/admin/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      // 备用：从 localStorage 获取
      const stored = localStorage.getItem('quiz_categories');
      if (stored) {
        setCategories(JSON.parse(stored));
      }
    }
  };

  const loadCodes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        console.error('未登录或登录已过期');
        setLoading(false);
        return;
      }
      
      const response = await fetch('/api/activation-codes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const text = await response.text();
        if (text) {
          const data = JSON.parse(text);
          setCodes(data.codes || []);
        }
      } else if (response.status === 401) {
        // token 过期，跳转登录
        router.push(getLoginPath());
      }
    } catch (error) {
      console.error('加载激活码失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadCodes();
    }
  }, [currentUser]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push(getLoginPath());
  };

  // 获取分类的完整路径
  const getCategoryPath = (categoryId: string): string => {
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

  // 创建激活码
  const handleCreateCodes = async () => {
    if (!selectedCategory) {
      alert('请选择分类');
      return;
    }

    setCreating(true);
    try {
      const token = localStorage.getItem('admin_token');
      const category = categories.find(c => c.id === selectedCategory);
      
      // 计算过期时间
      let expiresAt: string | null = null;
      if (expireType === 'permanent') {
        expiresAt = null; // 永久有效
      } else if (expireType === 'days') {
        expiresAt = new Date(Date.now() + parseInt(expireDays) * 24 * 60 * 60 * 1000).toISOString();
      } else if (expireType === 'date' && expireDate) {
        expiresAt = expireDate.toISOString();
      }
      
      const response = await fetch('/api/activation-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          categoryId: selectedCategory,
          categoryName: category?.name || selectedCategory,
          quantity: parseInt(codeCount) || 1,
          type: 'once',
          maxUses: 1,
          expiresAt,
        }),
      });

      if (response.ok) {
        setCreateModalOpen(false);
        setSelectedCategory('');
        setExpireDays('30');
        setExpireDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
        setCodeCount('1');
        loadCodes();
      } else {
        const data = await response.json();
        alert(data.error || '创建失败');
      }
    } catch (error) {
      console.error('创建激活码失败:', error);
      alert('创建失败');
    } finally {
      setCreating(false);
    }
  };

  // 删除激活码
  const handleDelete = async (codeId: string) => {
    if (!codeId) return;
    
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        alert('请先登录');
        router.push(getLoginPath());
        return;
      }
      
      // 使用 URL 查询参数传递 ID，避免 DELETE 请求 body 问题
      const url = `/api/activation-codes?ids=${encodeURIComponent(JSON.stringify([codeId]))}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        },
      });
      
      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text();
        console.error('删除失败:', response.status, errorText);
        alert('删除失败，请重试');
        return;
      }
      
      // 尝试解析 JSON
      const text = await response.text();
      if (!text) {
        console.error('服务器返回空响应');
        alert('删除失败，请重试');
        return;
      }
      
      const data = JSON.parse(text);
      
      if (data.success) {
        setDeleteConfirm(null);
        loadCodes();
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除激活码失败:', error);
      alert('删除失败，请重试');
    }
  };

  // 复制激活码
  const copyToClipboard = (code: ActivationCode) => {
    const textToCopy = `激活码：${code.code}\n所属科目：${code.category_name}`;
    navigator.clipboard.writeText(textToCopy);
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

  // 判断激活码是否有效
  const isCodeValid = (code: ActivationCode): boolean => {
    if (code.status === 'used') return false;
    if (code.status === 'expired') return false;
    if (code.expires_at && new Date(code.expires_at) < new Date()) return false;
    if (code.max_uses > 0 && code.uses >= code.max_uses) return false;
    return true;
  };

  const filteredCodes = codes.filter(code => {
    const query = searchQuery.toLowerCase();
    return (
      code.code.toLowerCase().includes(query) ||
      code.category_name.toLowerCase().includes(query)
    );
  });

  // 分页计算
  const totalPages = Math.ceil(filteredCodes.length / itemsPerPage);
  const paginatedCodes = filteredCodes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const validCodes = codes.filter(isCodeValid).length;
  const expiredCodes = codes.filter(c => c.expires_at && new Date(c.expires_at) < new Date()).length;
  const usedCodes = codes.filter(c => c.status === 'used').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="gap-1">
                  <ArrowLeft className="w-4 h-4" />
                  返回
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                  <Key className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-lg font-semibold">激活码</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500">总激活码</p>
                <p className="text-lg sm:text-2xl font-bold">{codes.length}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Key className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500">可用激活码</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600">{validCodes}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500">已使用</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600">{usedCodes}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500">已过期</p>
                <p className="text-lg sm:text-2xl font-bold text-red-600">{expiredCodes}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* 激活码列表 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>激活码列表</CardTitle>
                <CardDescription>
                  管理题库激活码，每个激活码对应一个最小子分类
                </CardDescription>
              </div>
              <Button onClick={() => setCreateModalOpen(true)} className="gap-1">
                <Plus className="w-4 h-4" />
                生成激活码
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* 搜索框 */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索激活码或分类..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 rounded-lg"
              />
            </div>

            {/* 表格 */}
            <div className="rounded-lg border overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">激活码</TableHead>
                    <TableHead className="whitespace-nowrap">对应分类</TableHead>
                    <TableHead className="whitespace-nowrap">激活用户</TableHead>
                    <TableHead className="whitespace-nowrap">类型</TableHead>
                    <TableHead className="whitespace-nowrap">过期时间</TableHead>
                    <TableHead className="whitespace-nowrap">状态</TableHead>
                    <TableHead className="text-right whitespace-nowrap">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : paginatedCodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        暂无激活码
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCodes.map((code) => {
                      const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
                      const isUsed = code.status === 'used' || code.uses >= code.max_uses;
                      const activatedUsers = code.activated_users || [];
                      
                      return (
                        <TableRow key={code.id}>
                          <TableCell className="font-mono font-medium">
                            <div className="flex items-center gap-2">
                              <span>{code.code}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(code)}
                                className="h-6 w-6 p-0"
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{getCategoryPath(code.category_id)}</TableCell>
                          <TableCell>
                            {activatedUsers.length === 0 ? (
                              <span className="text-sm text-gray-400">-</span>
                            ) : (
                              <div className="space-y-1">
                                {activatedUsers.map((user, idx) => (
                                  <div key={user.user_id} className="flex items-center gap-1.5 text-sm bg-gray-50 rounded px-2 py-1">
                                    <User className="w-3 h-3 text-gray-400" />
                                    <span className="truncate max-w-[120px]">
                                      {user.user_nickname || user.user_phone || '未知用户'}
                                    </span>
                                    <span className="text-xs text-gray-400 ml-auto">
                                      {new Date(user.activated_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{code.type === 'once' ? '单次' : '多次'}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className={`w-3 h-3 ${isExpired ? 'text-red-500' : 'text-gray-400'}`} />
                              {formatExpireTime(code.expires_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isExpired ? (
                              <Badge variant="destructive">已过期</Badge>
                            ) : isUsed ? (
                              <Badge variant="secondary">已使用</Badge>
                            ) : (
                              <Badge variant="default" className="bg-green-500">可用</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirm(code.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              
              {/* 分页控件 */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200">
                  <div className="text-xs sm:text-sm text-gray-500">
                    共 {filteredCodes.length} 条，第 {currentPage} / {totalPages} 页
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-2 sm:px-3"
                    >
                      ←
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        // 显示当前页附近的页码
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-7 h-7 sm:w-8 sm:h-8 p-0 text-xs sm:text-sm"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2 sm:px-3"
                    >
                      →
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 分类说明 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-500" />
              激活码规则说明
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>1. 每个激活码对应一个题库分类</p>
            <p>2. 用户使用激活码后，将获得该分类的访问权限</p>
            <p>3. 可设置过期时间，到期后用户的该分类权限将自动失效</p>
            <p>4. 单次激活码只能使用一次，使用后即失效</p>
            <p>5. 删除激活码会同时取消用户对该分类的激活权限</p>
          </CardContent>
        </Card>
      </main>

      {/* 创建激活码对话框 */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>生成激活码</DialogTitle>
            <DialogDescription>
              为题库分类生成激活码，设置过期时间
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category">对应分类 *</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {categories.length === 0 ? (
                    <SelectItem value="none" disabled>暂无分类，请先创建分类</SelectItem>
                  ) : (
                    (() => {
                      // 获取顶级分类（按 order 排序）
                      const topCategories = categories
                        .filter(c => !c.parentId)
                        .sort((a, b) => a.order - b.order);
                      
                      // 获取子分类（按 order 排序）
                      const getChildren = (parentId: string) =>
                        categories
                          .filter(c => c.parentId === parentId)
                          .sort((a, b) => a.order - b.order);
                      
                      // 按父分类分组渲染
                      const items: React.ReactNode[] = [];
                      topCategories.forEach(top => {
                        // 渲染顶级分类
                        items.push(
                          <SelectItem key={top.id} value={top.id} className="font-medium">
                            {top.name}
                          </SelectItem>
                        );
                        // 渲染其子分类（缩进显示）
                        const children = getChildren(top.id);
                        children.forEach(child => {
                          items.push(
                            <SelectItem key={child.id} value={child.id} className="pl-6 text-slate-600">
                              ├─ {child.name}
                            </SelectItem>
                          );
                        });
                      });
                      return items;
                    })()
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>过期时间</Label>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={expireType === 'permanent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setExpireType('permanent')}
                    className="flex-1"
                  >
                    永久有效
                  </Button>
                  <Button
                    type="button"
                    variant={expireType === 'days' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setExpireType('days')}
                    className="flex-1"
                  >
                    按天数
                  </Button>
                  <Button
                    type="button"
                    variant={expireType === 'date' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setExpireType('date')}
                    className="flex-1"
                  >
                    指定日期
                  </Button>
                </div>
                
                {expireType === 'days' && (
                  <Select value={expireDays} onValueChange={setExpireDays}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择天数" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 天</SelectItem>
                      <SelectItem value="30">30 天</SelectItem>
                      <SelectItem value="90">90 天</SelectItem>
                      <SelectItem value="180">180 天</SelectItem>
                      <SelectItem value="365">1 年</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                
                {expireType === 'date' && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !expireDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {expireDate ? format(expireDate, "yyyy-MM-dd") : "选择日期"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={expireDate}
                        onSelect={setExpireDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="codeCount">生成数量</Label>
              <Input
                id="codeCount"
                type="number"
                min="1"
                max="100"
                value={codeCount}
                onChange={(e) => setCodeCount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateCodes} disabled={creating || !selectedCategory}>
              {creating ? '生成中...' : '生成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除该激活码吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              取消
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                const codeId = deleteConfirm;
                setDeleteConfirm(null);
                if (codeId) handleDelete(codeId);
              }}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
