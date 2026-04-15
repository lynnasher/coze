'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BookOpen,
  FileText,
  Trash2,
  Upload,
  LogOut,
  Plus,
  MoreHorizontal,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart3,
  Search,
  Download,
  FileJson,
} from 'lucide-react';

interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  sourceFile?: string;
  questionIds: string[];
  createdAt: number;
  updatedAt: number;
}

interface AdminStats {
  totalBanks: number;
  totalQuestions: number;
  recentImports: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalBanks: 0,
    totalQuestions: 0,
    recentImports: 0
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [bankToDelete, setBankToDelete] = useState<QuestionBank | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // 验证登录状态
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const user = localStorage.getItem('admin_user');
    
    if (!token || !user) {
      router.push('/admin/login');
      return;
    }

    // 验证 token 是否过期
    try {
      const payload = JSON.parse(atob(token));
      if (payload.exp < Date.now()) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        router.push('/admin/login');
        return;
      }
      setIsAuthenticated(true);
    } catch {
      router.push('/admin/login');
      return;
    }
  }, [router]);

  // 加载题库数据
  const loadBanks = useCallback(() => {
    const storedBanks = localStorage.getItem('questionBanks');
    const storedQuestions = localStorage.getItem('questions');
    
    if (storedBanks) {
      const parsedBanks: QuestionBank[] = JSON.parse(storedBanks);
      setBanks(parsedBanks);
      setStats(prev => ({
        ...prev,
        totalBanks: parsedBanks.length,
        totalQuestions: parsedBanks.reduce((sum, bank) => sum + bank.questionIds.length, 0)
      }));
    }

    if (storedQuestions) {
      const questions = JSON.parse(storedQuestions);
      // 统计最近7天导入的题目
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentQuestions = questions.filter((q: { createdAt: number }) => q.createdAt > weekAgo);
      setStats(prev => ({ ...prev, recentImports: recentQuestions.length }));
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadBanks();
    }
  }, [isAuthenticated, loadBanks]);

  // 登出
  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push('/admin/login');
  };

  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '导入失败');
      }

      setSuccess(`成功导入 ${data.count} 道题目`);
      loadBanks();
      
      // 清空 input
      e.target.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setIsUploading(false);
    }
  };

  // 导入 JSON 文件
  const handleJsonImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError('');
    setSuccess('');

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // 支持两种格式：直接是题目数组，或包含 questions 字段
      const questions = Array.isArray(data) ? data : data.questions;

      if (!Array.isArray(questions)) {
        throw new Error('JSON 格式不正确');
      }

      const response = await fetch('/api/admin/import-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions, bankName: data.name || file.name.replace('.json', '') }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '导入失败');
      }

      setSuccess(`成功导入 ${result.count} 道题目到"${result.bankName}"题库`);
      loadBanks();
      
      e.target.value = '';
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('JSON 格式错误');
      } else {
        setError(err instanceof Error ? err.message : '导入失败');
      }
    } finally {
      setIsImporting(false);
    }
  };

  // 删除题库
  const handleDeleteBank = async () => {
    if (!bankToDelete) return;

    try {
      const response = await fetch(`/api/admin/banks/${bankToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除失败');
      }

      setSuccess(`题库"${bankToDelete.name}"已删除`);
      loadBanks();
      setIsDeleteDialogOpen(false);
      setBankToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  // 导出题库为 JSON
  const handleExportBank = (bank: QuestionBank) => {
    const storedQuestions = localStorage.getItem('questions');
    if (!storedQuestions) return;

    const allQuestions = JSON.parse(storedQuestions);
    const bankQuestions = allQuestions.filter((q: { id: string }) => bank.questionIds.includes(q.id));

    const data = {
      name: bank.name,
      description: bank.description,
      exportedAt: new Date().toISOString(),
      questions: bankQuestions
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bank.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 格式化时间
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 过滤题库
  const filteredBanks = banks.filter(bank =>
    bank.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bank.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">题库管理后台</h1>
              <p className="text-sm text-slate-500">管理您的题库资源</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={loadBanks}>
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              退出登录
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* 提示信息 */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-6 border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">题库总数</CardTitle>
              <BookOpen className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalBanks}</div>
              <p className="text-xs text-slate-500 mt-1">个题库</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">题目总数</CardTitle>
              <FileText className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalQuestions}</div>
              <p className="text-xs text-slate-500 mt-1">道题目</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">本周导入</CardTitle>
              <Clock className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.recentImports}</div>
              <p className="text-xs text-slate-500 mt-1">道题目</p>
            </CardContent>
          </Card>
        </div>

        {/* 导入区域 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              导入题库
            </CardTitle>
            <CardDescription>
              支持 Word (.docx)、PDF (.pdf) 和 JSON (.json) 格式的题库文件
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              {/* Word/PDF 导入 */}
              <div className="flex-1">
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                    <p className="font-medium">上传 Word/PDF 文件</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {isUploading ? '正在解析...' : '支持 .docx, .pdf 格式'}
                    </p>
                  </div>
                </Label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".docx,.pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </div>

              {/* JSON 导入 */}
              <div className="flex-1">
                <Label htmlFor="json-upload" className="cursor-pointer">
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-green-500 hover:bg-green-50 transition-colors">
                    <FileJson className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                    <p className="font-medium">导入 JSON 题目</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {isImporting ? '正在导入...' : '支持 .json 格式题目数据'}
                    </p>
                  </div>
                </Label>
                <input
                  id="json-upload"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleJsonImport}
                  disabled={isImporting}
                />
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-100 rounded-lg">
              <p className="text-sm font-medium text-slate-700 mb-2">JSON 格式说明：</p>
              <pre className="text-xs text-slate-600 overflow-x-auto">
{`{
  "name": "题库名称",
  "questions": [
    {
      "type": "single", // single|multiple|true-false|fill-blank|comprehensive
      "content": "题目内容",
      "options": [{"id": "A", "text": "选项A"}, ...],
      "answer": "A",
      "explanation": "解析内容",
      "tags": ["标签1"],
      "difficulty": "medium"
    }
  ]
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* 题库列表 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  题库列表
                </CardTitle>
                <CardDescription>共 {banks.length} 个题库</CardDescription>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索题库..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredBanks.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>暂无题库</p>
                <p className="text-sm mt-1">请上传文件导入题库</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>题库名称</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>题目数量</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBanks.map((bank) => (
                    <TableRow key={bank.id}>
                      <TableCell className="font-medium">{bank.name}</TableCell>
                      <TableCell className="text-slate-500">
                        {bank.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {bank.questionIds.length} 题
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {formatDate(bank.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExportBank(bank)}>
                              <Download className="h-4 w-4 mr-2" />
                              导出 JSON
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setBankToDelete(bank);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              删除题库
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* 删除确认对话框 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除题库"{bankToDelete?.name}"吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteBank}>
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
