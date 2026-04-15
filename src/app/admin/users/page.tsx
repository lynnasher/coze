'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  User,
  MoreHorizontal,
  Shield,
  UserCheck,
  UserX,
  Plus,
  Search,
  LogOut,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { User as UserType } from '@/lib/types';
import { userStore, sessionStore, logoutUser } from '@/lib/user-store';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editUser, setEditUser] = useState<UserType | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);

  const checkAuth = () => {
    const user = sessionStore.getCurrentUser();
    if (!user || user.role !== 'admin') {
      router.push('/admin/login');
      return;
    }
    setCurrentUser(user);
  };

  const loadUsers = () => {
    setUsers(userStore.getAll());
  };

  useEffect(() => {
    checkAuth();
    loadUsers();
  }, []);

  const handleLogout = () => {
    logoutUser();
    router.push('/admin/login');
  };

  const handleStatusToggle = (userId: string, currentStatus: 'active' | 'banned') => {
    const newStatus = currentStatus === 'active' ? 'banned' : 'active';
    userStore.updateStatus(userId, newStatus);
    loadUsers();
  };

  const handleRoleChange = (userId: string, newRole: 'user' | 'admin') => {
    userStore.updateRole(userId, newRole);
    loadUsers();
  };

  const handleDelete = (userId: string) => {
    // 不允许删除自己
    if (userId === currentUser?.id) {
      alert('不能删除当前登录的管理员账号');
      return;
    }
    userStore.remove(userId);
    loadUsers();
    setDeleteConfirm(null);
  };

  const handleAddUser = (phone: string, nickname: string, password: string, role: 'user' | 'admin') => {
    if (userStore.exists(phone)) {
      alert('该手机号已被注册');
      return;
    }
    userStore.add({
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      phone,
      nickname,
      password: btoa(password + '_salt_key_2024'),
      createdAt: Date.now(),
      role,
      status: 'active',
    });
    loadUsers();
    setEditUser(null);
  };

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.phone.includes(query) ||
      user.nickname?.toLowerCase().includes(query)
    );
  });

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
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-lg font-semibold">用户管理</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                管理员: {currentUser?.nickname || currentUser?.phone}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">总用户数</p>
                  <p className="text-3xl font-bold">{users.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">活跃用户</p>
                  <p className="text-3xl font-bold">
                    {users.filter(u => u.status === 'active').length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">管理员</p>
                  <p className="text-3xl font-bold">
                    {users.filter(u => u.role === 'admin').length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 用户列表 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>用户列表</CardTitle>
                <CardDescription>管理所有注册用户</CardDescription>
              </div>
              <Button onClick={() => setEditUser({} as UserType)} className="gap-1">
                <Plus className="w-4 h-4" />
                添加用户
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* 搜索框 */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索手机号或昵称..."
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
                    <TableHead>手机号</TableHead>
                    <TableHead>昵称</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        暂无用户
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.phone}</TableCell>
                        <TableCell>{user.nickname || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="gap-1">
                            {user.role === 'admin' && <Shield className="w-3 h-3" />}
                            {user.role === 'admin' ? '管理员' : '普通用户'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.status === 'active' ? 'default' : 'destructive'} className="gap-1">
                            {user.status === 'active' ? (
                              <>
                                <UserCheck className="w-3 h-3" />
                                正常
                              </>
                            ) : (
                              <>
                                <UserX className="w-3 h-3" />
                                禁用
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleStatusToggle(user.id, user.status)}>
                                {user.status === 'active' ? '禁用账号' : '启用账号'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRoleChange(user.id, user.role === 'admin' ? 'user' : 'admin')}>
                                {user.role === 'admin' ? '设为普通用户' : '设为管理员'}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setDeleteConfirm(user.id)}
                                className="text-red-600"
                                disabled={user.id === currentUser?.id}
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* 添加/编辑用户对话框 */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editUser?.id ? '编辑用户' : '添加用户'}</DialogTitle>
            <DialogDescription>
              {editUser?.id ? '修改用户信息' : '创建新用户账号'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const phone = (form.elements.namedItem('phone') as HTMLInputElement).value;
            const nickname = (form.elements.namedItem('nickname') as HTMLInputElement).value;
            const password = (form.elements.namedItem('password') as HTMLInputElement).value;
            const role = (form.elements.namedItem('role') as HTMLSelectElement).value as 'user' | 'admin';
            handleAddUser(phone, nickname, password, role);
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="phone">手机号</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="请输入手机号"
                  defaultValue={editUser?.phone}
                  required
                  maxLength={11}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nickname">昵称</Label>
                <Input
                  id="nickname"
                  name="nickname"
                  placeholder="请输入昵称（选填）"
                  defaultValue={editUser?.nickname}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="请输入密码（至少6位）"
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">角色</Label>
                <select
                  id="role"
                  name="role"
                  defaultValue={editUser?.role || 'user'}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                >
                  <option value="user">普通用户</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                取消
              </Button>
              <Button type="submit">
                {editUser?.id ? '保存' : '添加'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除该用户吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
