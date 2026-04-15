'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
}

export default function ActivationCodesPage() {
  const router = useRouter();
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<{ username: string } | null>(null);
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
      router.push('/admin/login');
      return;
    }
    try {
      const user = JSON.parse(userData);
      setCurrentUser(user);
    } catch {
      router.push('/admin/login');
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
      const response = await fetch('/api/activation-codes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCodes(data.codes || []);
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
    router.push('/admin/login');
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
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/activation-codes', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ids: [codeId] }),
      });
      if (response.ok) {
        loadCodes();
      }
    } catch (error) {
      console.error('删除激活码失败:', error);
    }
    setDeleteConfirm(null);
  };

  // 复制激活码
  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
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
                <h1 className="text-lg font-semibold">激活码管理</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadCodes} className="gap-1">
                <RefreshCw className="w-4 h-4" />
                刷新
              </Button>
              <span className="text-sm text-gray-500">
                管理员: {currentUser?.username}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">总激活码</p>
                  <p className="text-3xl font-bold">{codes.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Key className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">可用激活码</p>
                  <p className="text-3xl font-bold text-green-600">{validCodes}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">已使用</p>
                  <p className="text-3xl font-bold text-purple-600">{usedCodes}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">已过期</p>
                  <p className="text-3xl font-bold text-red-600">{expiredCodes}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-lg"
              />
            </div>

            {/* 表格 */}
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>激活码</TableHead>
                    <TableHead>对应分类</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>使用情况</TableHead>
                    <TableHead>过期时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : filteredCodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        暂无激活码
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCodes.map((code) => {
                      const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
                      const isUsed = code.status === 'used' || code.uses >= code.max_uses;
                      const isValid = !isExpired && !isUsed;
                      
                      return (
                        <TableRow key={code.id}>
                          <TableCell className="font-mono font-medium">
                            <div className="flex items-center gap-2">
                              <span>{code.code}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(code.code)}
                                className="h-6 w-6 p-0"
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>{getCategoryPath(code.category_id)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{code.type === 'once' ? '单次' : '多次'}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {code.uses} / {code.max_uses}
                            </span>
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
                          <TableCell className="text-sm text-gray-500">
                            {new Date(code.created_at).toLocaleDateString()}
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
            <p>5. 用户切换分类时，系统会检查激活码是否过期</p>
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
                <SelectContent>
                  {categories.length === 0 ? (
                    <SelectItem value="none" disabled>暂无分类，请先创建分类</SelectItem>
                  ) : (
                    categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {getCategoryPath(cat.id)}
                      </SelectItem>
                    ))
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
            <Button variant="destructive" onClick={() => handleDelete(deleteConfirm!)}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
