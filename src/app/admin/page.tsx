'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  LogOut,
  MoreHorizontal,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart3,
  Search,
  Download,
  FileJson,
  Edit3,
  Check,
  X,
  ChevronRight,
  List,
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

// 生成 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

type QuestionType = 'single' | 'multiple' | 'true-false' | 'fill-blank' | 'comprehensive';

interface Question {
  id: string;
  parentId?: string;
  type: QuestionType;
  content: string;
  options?: { id: string; text: string }[];
  answer: string | string[];
  explanation?: string;
  difficulty: string;
  tags: string[];
  bankId?: string;
  createdAt: number;
  caseBackground?: string;
  children?: Question[];
}

// 类型映射
const typeMap: Record<number, QuestionType> = {
  1: 'single',
  2: 'multiple',
  3: 'true-false',
  4: 'fill-blank',
  5: 'comprehensive',
};

// 检测题型
function detectQuestionType(qType: unknown): QuestionType {
  if (typeof qType === 'number') {
    return typeMap[qType] || 'single';
  } else if (typeof qType === 'string') {
    const t = qType.toLowerCase().trim();
    if (t === 'single') return 'single';
    else if (t === 'multiple') return 'multiple';
    else if (t === 'true-false' || t === 'truefalse' || t === 'judge') return 'true-false';
    else if (t === 'fill-blank' || t === 'fillblank' || t === 'fill') return 'fill-blank';
    else if (t === 'comprehensive') return 'comprehensive';
    else if (t.includes('多选')) return 'multiple';
    else if (t.includes('判断')) return 'true-false';
    else if (t.includes('填空')) return 'fill-blank';
    else if (t.includes('综合') || t.includes('案例')) return 'comprehensive';
    return 'single';
  }
  return 'single';
}

// 处理选项
function processOptions(q: Record<string, unknown>): { id: string; text: string }[] | undefined {
  const isExportFormat = !!q.stem;
  
  if (isExportFormat) {
    const opts: { id: string; text: string }[] = [];
    if (q.optiona) opts.push({ id: 'a', text: String(q.optiona) });
    if (q.optionb) opts.push({ id: 'b', text: String(q.optionb) });
    if (q.optionc) opts.push({ id: 'c', text: String(q.optionc) });
    if (q.optiond) opts.push({ id: 'd', text: String(q.optiond) });
    return opts.length > 0 ? opts : undefined;
  } else {
    const qOptions = q.options;
    if (qOptions && typeof qOptions === 'object') {
      if (Array.isArray(qOptions)) {
        return qOptions as { id: string; text: string }[];
      } else {
        return Object.entries(qOptions).map(([key, val]) => ({
          id: key.toLowerCase(),
          text: String(val),
        })).sort((a, b) => a.id.localeCompare(b.id));
      }
    }
  }
  return undefined;
}

// 处理答案
function processAnswer(q: Record<string, unknown>): string | string[] {
  let answer: string | string[] = 'a';
  const qAnswer = q.answer || q.ans;
  if (qAnswer) {
    if (typeof qAnswer === 'string') {
      const ans = qAnswer.trim().toLowerCase();
      if (ans.length > 1) {
        answer = ans.split('');
      } else {
        answer = ans;
      }
    } else if (Array.isArray(qAnswer)) {
      answer = qAnswer as string[];
    }
  }
  return answer;
}

// 处理子题目选项
function processChildOptions(child: Record<string, unknown>): { id: string; text: string }[] | undefined {
  const childIsExportFormat = !!child.stem;
  if (childIsExportFormat) {
    const opts: { id: string; text: string }[] = [];
    if (child.optiona) opts.push({ id: 'a', text: String(child.optiona) });
    if (child.optionb) opts.push({ id: 'b', text: String(child.optionb) });
    if (child.optionc) opts.push({ id: 'c', text: String(child.optionc) });
    if (child.optiond) opts.push({ id: 'd', text: String(child.optiond) });
    return opts.length > 0 ? opts : undefined;
  } else {
    const childQOptions = child.options;
    if (childQOptions && typeof childQOptions === 'object') {
      if (Array.isArray(childQOptions)) {
        return childQOptions as { id: string; text: string }[];
      } else {
        return Object.entries(childQOptions).map(([key, val]) => ({
          id: key.toLowerCase(),
          text: String(val),
        })).sort((a, b) => a.id.localeCompare(b.id));
      }
    }
  }
  return undefined;
}

// 处理子题目答案
function processChildAnswer(child: Record<string, unknown>): string | string[] {
  let answer: string | string[] = 'a';
  const childQAnswer = child.answer || child.ans;
  if (childQAnswer) {
    if (typeof childQAnswer === 'string') {
      const ans = childQAnswer.trim().toLowerCase();
      if (ans.length > 1) {
        answer = ans.split('');
      } else {
        answer = ans;
      }
    } else if (Array.isArray(childQAnswer)) {
      answer = childQAnswer as string[];
    }
  }
  return answer;
}

// 处理子题目
function processChildren(children: Record<string, unknown>[], parentId: string, bankId: string): Question[] {
  return children.map((child) => {
    const childContent = (child.question as string) || (child.content as string) || (child.stem as string) || '';
    const childQType = child.type || child.qtype;
    return {
      id: generateId(),
      parentId: parentId,
      type: detectQuestionType(childQType),
      content: childContent,
      options: processChildOptions(child),
      answer: processChildAnswer(child),
      explanation: ((child.explanation as string) || (child.parsetext as string)) || undefined,
      difficulty: (child.difficulty as string) || 'medium',
      tags: [],
      bankId,
      createdAt: Date.now(),
    } as Question;
  }).filter(q => q.content);
}

// 处理单个题目
function processQuestion(q: Record<string, unknown>, bankId: string, parentId?: string): Question | null {
  const isExportFormat = !!q.stem;
  const qType = q.type || q.qtype;
  const questionType = detectQuestionType(qType);
  
  const options = processOptions(q);
  const answer = processAnswer(q);
  const questionId = generateId();
  const content = (q.question as string) || (q.content as string) || (q.stem as string) || '';
  const explanation = (q.explanation as string) || (q.parsetext as string) || '';
  
  return {
    id: questionId,
    parentId,
    type: questionType,
    content,
    options,
    answer,
    explanation,
    difficulty: (q.difficulty as string) || 'medium',
    tags: (q.tags as string[]) || [],
    bankId,
    createdAt: Date.now(),
  };
}

// 扁平化处理题目（支持综合题）
function flattenQuestions(questions: Record<string, unknown>[], bankId: string): Question[] {
  const result: Question[] = [];
  
  for (const q of questions) {
    const children = q.children as Record<string, unknown>[] | undefined;
    const hasChildren = Array.isArray(children) && children.length > 0;
    
    const qType = q.type || q.qtype;
    const isComprehensive = 
      (typeof qType === 'number' && qType === 5) ||
      (typeof qType === 'string' && (qType.toLowerCase().trim() === 'comprehensive' || qType.includes('综合') || qType.includes('案例')));
    
    if (hasChildren && isComprehensive) {
      const questionId = generateId();
      const caseBackground = (q.question as string) || (q.content as string) || (q.stem as string) || '';
      const childQuestions = processChildren(children, questionId, bankId);
      
      const comprehensiveQuestion: Question = {
        id: questionId,
        parentId: undefined,
        type: 'comprehensive',
        content: '',
        caseBackground,
        children: childQuestions,
        options: undefined,
        answer: '',
        explanation: '',
        difficulty: 'medium',
        tags: [],
        bankId,
        createdAt: Date.now(),
      };
      
      result.push(comprehensiveQuestion);
    } else {
      const processed = processQuestion(q, bankId);
      if (processed) {
        result.push(processed);
      }
    }
  }
  
  return result;
}

// 本地导入 JSON
function localImportJson(data: Record<string, unknown>, fileName: string): { count: number; bankId: string; bankName: string } {
  const questions = data.questions;
  
  if (!Array.isArray(questions)) {
    throw new Error('JSON 格式错误：缺少 questions 数组');
  }
  
  const bankId = `bank_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const bankName = (data.subjectName as string) || (data.bankName as string) || (data.title as string) || fileName.replace('.json', '') || '导入题库';
  
  const processedQuestions = flattenQuestions(questions, bankId);
  
  if (processedQuestions.length === 0) {
    throw new Error('JSON 中没有有效的题目');
  }
  
  // 读取现有数据
  const existingQuestions = JSON.parse(localStorage.getItem('questions') || '[]');
  const existingBanks = JSON.parse(localStorage.getItem('questionBanks') || '[]');
  
  // 创建新题库
  const newBank = {
    id: bankId,
    name: bankName,
    description: `从 ${fileName} 导入`,
    questionIds: processedQuestions.map(q => q.id),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  // 合并数据
  const updatedQuestions = [...existingQuestions, ...processedQuestions];
  const updatedBanks = [...existingBanks, newBank];
  
  // 保存
  localStorage.setItem('questions', JSON.stringify(updatedQuestions));
  localStorage.setItem('questionBanks', JSON.stringify(updatedBanks));
  
  return { count: processedQuestions.length, bankId, bankName };
}

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
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
  
  // 题库名称编辑状态
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [editingBankName, setEditingBankName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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

      const result = localImportJson(data, file.name);

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

  // 开始编辑题库名称
  const startEditBankName = (bank: QuestionBank) => {
    setEditingBankId(bank.id);
    setEditingBankName(bank.name);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  // 保存题库名称
  const saveBankName = () => {
    if (!editingBankId || !editingBankName.trim()) {
      setEditingBankId(null);
      return;
    }

    try {
      const storedBanks = localStorage.getItem('questionBanks');
      if (!storedBanks) return;
      
      const banksList: QuestionBank[] = JSON.parse(storedBanks);
      const updatedBanks = banksList.map(b => 
        b.id === editingBankId 
          ? { ...b, name: editingBankName.trim(), updatedAt: Date.now() }
          : b
      );
      
      localStorage.setItem('questionBanks', JSON.stringify(updatedBanks));
      setBanks(updatedBanks);
      setSuccess('题库名称已更新');
    } catch (err) {
      setError('更新失败');
    } finally {
      setEditingBankId(null);
    }
  };

  // 取消编辑
  const cancelEditBankName = () => {
    setEditingBankId(null);
    setEditingBankName('');
  };

  // 删除题库
  const handleDeleteBank = () => {
    if (!bankToDelete) return;

    try {
      const questions = JSON.parse(localStorage.getItem('questions') || '[]');
      const banksList = JSON.parse(localStorage.getItem('questionBanks') || '[]');
      
      const updatedBanks = banksList.filter((b: { id: string }) => b.id !== bankToDelete.id);
      const updatedQuestions = questions.filter(
        (q: { bankId?: string }) => q.bankId !== bankToDelete.id
      );

      localStorage.setItem('questions', JSON.stringify(updatedQuestions));
      localStorage.setItem('questionBanks', JSON.stringify(updatedBanks));

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

  // 进入题库编辑页面
  const goToBankEdit = (bank: QuestionBank) => {
    router.push(`/admin/bank/${bank.id}`);
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

  // 题型显示映射
  const typeLabels: Record<string, string> = {
    single: '单选题',
    multiple: '多选题',
    'true-false': '判断题',
    'fill-blank': '填空题',
    comprehensive: '综合题'
  };

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

        {/* 导入区域 - 仅保留 JSON 导入 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              导入题库
            </CardTitle>
            <CardDescription>
              仅支持 JSON 格式的题库文件
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="json-upload" className="cursor-pointer">
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-green-500 hover:bg-green-50 transition-colors">
                  <FileJson className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                  <p className="font-medium">导入 JSON 题目</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {isImporting ? '正在导入...' : '点击选择 JSON 文件'}
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

            <div className="mt-4 p-3 bg-slate-100 rounded-lg">
              <p className="text-sm font-medium text-slate-700 mb-2">JSON 格式说明：</p>
              <pre className="text-xs text-slate-600 overflow-x-auto">
{`{
  "bankName": "题库名称",
  "questions": [
    {
      "type": "single",
      "content": "题目内容",
      "options": [{"id": "a", "text": "选项A"}, ...],
      "answer": "a",
      "explanation": "解析内容"
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
                <p className="text-sm mt-1">请上传 JSON 文件导入题库</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>题库名称</TableHead>
                    <TableHead>题目数量</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBanks.map((bank) => (
                    <TableRow key={bank.id} className="cursor-pointer hover:bg-slate-50">
                      <TableCell onClick={() => goToBankEdit(bank)}>
                        {editingBankId === bank.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              ref={inputRef}
                              value={editingBankName}
                              onChange={(e) => setEditingBankName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveBankName();
                                if (e.key === 'Escape') cancelEditBankName();
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="h-8 max-w-[200px]"
                              autoFocus
                            />
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); saveBankName(); }}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); cancelEditBankName(); }}>
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{bank.name}</span>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={(e) => { e.stopPropagation(); startEditBankName(bank); }}
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Edit3 className="h-3 w-3 text-slate-400" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell onClick={() => goToBankEdit(bank)}>
                        <Badge variant="secondary">
                          {bank.questionIds.length} 题
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500" onClick={() => goToBankEdit(bank)}>
                        {formatDate(bank.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => startEditBankName(bank)}>
                              <Edit3 className="h-4 w-4 mr-2" />
                              修改名称
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => goToBankEdit(bank)}>
                              <List className="h-4 w-4 mr-2" />
                              编辑题目
                            </DropdownMenuItem>
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
