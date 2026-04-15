'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  FolderOpen,
  Folder,
  Plus,
  User,
  Key,
} from 'lucide-react';

// 存储 Keys - 与前台统一
const STORAGE_KEYS = {
  QUESTIONS: 'quiz_questions',
  BANKS: 'quiz_banks',
  CATEGORIES: 'quiz_categories',
};

interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  questionIds: string[];
  createdAt: number;
  updatedAt: number;
}

interface Category {
  id: string;
  name: string;
  color: string;
  order: number;
  parentId?: string; // 父分类ID，如果为空则是顶级分类
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
function localImportJson(data: Record<string, unknown>, fileName: string, categoryId?: string): { count: number; bankId: string; bankName: string } {
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
  const existingQuestions = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTIONS) || '[]');
  const existingBanks = JSON.parse(localStorage.getItem(STORAGE_KEYS.BANKS) || '[]');
  
  // 创建新题库
  const newBank: QuestionBank = {
    id: bankId,
    name: bankName,
    description: `从 ${fileName} 导入`,
    categoryId: categoryId,
    questionIds: processedQuestions.map(q => q.id),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  // 合并数据
  const updatedQuestions = [...existingQuestions, ...processedQuestions];
  const updatedBanks = [...existingBanks, newBank];
  
  // 保存
  localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(updatedQuestions));
  localStorage.setItem(STORAGE_KEYS.BANKS, JSON.stringify(updatedBanks));
  
  return { count: processedQuestions.length, bankId, bankName };
}

// 分类颜色选项
const categoryColors = [
  { value: 'blue', label: '蓝色' },
  { value: 'green', label: '绿色' },
  { value: 'red', label: '红色' },
  { value: 'yellow', label: '黄色' },
  { value: 'purple', label: '紫色' },
  { value: 'pink', label: '粉色' },
  { value: 'indigo', label: '靛蓝' },
  { value: 'cyan', label: '青色' },
];

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalBanks: 0,
    totalQuestions: 0,
    recentImports: 0
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [bankToDelete, setBankToDelete] = useState<QuestionBank | null>(null);
  
  // 题库名称编辑状态
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [editingBankName, setEditingBankName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // 分类管理状态
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState('blue');
  const [categoryParentId, setCategoryParentId] = useState<string | undefined>(undefined);

  // 移动题库分类状态
  const [isMoveCategoryDialogOpen, setIsMoveCategoryDialogOpen] = useState(false);
  const [bankToMove, setBankToMove] = useState<QuestionBank | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('uncategorized');

  // 验证登录状态
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const user = localStorage.getItem('admin_user');
    
    if (!token || !user) {
      router.push('/admin/login');
      return;
    }

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
    }
  }, [router]);

  // 加载分类
  const loadCategories = useCallback(() => {
    const storedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (storedCategories) {
      setCategories(JSON.parse(storedCategories));
    }
  }, []);

  // 加载题库数据
  const loadBanks = useCallback(() => {
    const storedBanks = localStorage.getItem(STORAGE_KEYS.BANKS);
    const storedQuestions = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    
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
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentQuestions = questions.filter((q: { createdAt: number }) => q.createdAt > weekAgo);
      setStats(prev => ({ ...prev, recentImports: recentQuestions.length }));
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadBanks();
      loadCategories();
    }
  }, [isAuthenticated, loadBanks, loadCategories]);

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

      const result = localImportJson(data, file.name, filterCategory !== 'all' ? filterCategory : undefined);

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

  // 重置分类表单
  const resetCategoryForm = () => {
    setIsCategoryModalOpen(false);
    setEditingCategory(null);
    setCategoryName('');
    setCategoryColor('blue');
    setCategoryParentId(undefined);
  };

  // 保存分类
  const saveCategory = () => {
    if (!categoryName.trim()) {
      setError('分类名称不能为空');
      return;
    }

    // 获取所有分类
    const existingCategories = JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '[]');
    
    if (editingCategory) {
      // 更新
      const updated = existingCategories.map((c: Category) => 
        c.id === editingCategory.id 
          ? { ...c, name: categoryName.trim(), color: categoryColor, parentId: categoryParentId }
          : c
      );
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(updated));
      setCategories(updated);
      setSuccess('分类已更新');
    } else {
      // 新增
      const siblings = existingCategories.filter((c: Category) => c.parentId === categoryParentId);
      const newCategory: Category = {
        id: generateId(),
        name: categoryName.trim(),
        color: categoryColor,
        order: siblings.length,
        parentId: categoryParentId,
      };
      const updated = [...existingCategories, newCategory];
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(updated));
      setCategories(updated);
      setSuccess('分类已添加');
    }

    resetCategoryForm();
  };

  // 删除分类（包括子分类）
  const deleteCategory = (category: Category) => {
    const existingCategories = JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '[]');
    
    // 收集所有要删除的分类ID（包括子分类）
    const idsToDelete = new Set<string>();
    idsToDelete.add(category.id);
    
    // 递归查找子分类
    const findChildren = (parentId: string) => {
      existingCategories.forEach((c: Category) => {
        if (c.parentId === parentId) {
          idsToDelete.add(c.id);
          findChildren(c.id);
        }
      });
    };
    findChildren(category.id);
    
    // 将该分类及子分类下的题库移至未分类
    const existingBanks = JSON.parse(localStorage.getItem(STORAGE_KEYS.BANKS) || '[]');
    const updatedBanks = existingBanks.map((b: QuestionBank) => 
      idsToDelete.has(b.categoryId || '') 
        ? { ...b, categoryId: undefined }
        : b
    );
    localStorage.setItem(STORAGE_KEYS.BANKS, JSON.stringify(updatedBanks));
    
    // 删除分类
    const updatedCategories = existingCategories.filter((c: Category) => !idsToDelete.has(c.id));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(updatedCategories));
    
    setCategories(updatedCategories);
    setBanks(updatedBanks);
    setSuccess('分类已删除');
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
      const storedBanks = localStorage.getItem(STORAGE_KEYS.BANKS);
      if (!storedBanks) return;
      
      const banksList: QuestionBank[] = JSON.parse(storedBanks);
      const updatedBanks = banksList.map(b => 
        b.id === editingBankId 
          ? { ...b, name: editingBankName.trim(), updatedAt: Date.now() }
          : b
      );
      
      localStorage.setItem(STORAGE_KEYS.BANKS, JSON.stringify(updatedBanks));
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
      const questions = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTIONS) || '[]');
      const banksList = JSON.parse(localStorage.getItem(STORAGE_KEYS.BANKS) || '[]');
      
      const updatedBanks = banksList.filter((b: { id: string }) => b.id !== bankToDelete.id);
      const updatedQuestions = questions.filter(
        (q: { bankId?: string }) => q.bankId !== bankToDelete.id
      );

      localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(updatedQuestions));
      localStorage.setItem(STORAGE_KEYS.BANKS, JSON.stringify(updatedBanks));

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
    const storedQuestions = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
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

  // 移动题库到指定分类
  const handleMoveCategory = () => {
    if (!bankToMove) return;
    
    const storedBanks = JSON.parse(localStorage.getItem(STORAGE_KEYS.BANKS) || '[]');
    const updatedBanks = storedBanks.map((b: QuestionBank) => 
      b.id === bankToMove.id 
        ? { ...b, categoryId: selectedCategoryId === 'uncategorized' ? undefined : selectedCategoryId, updatedAt: Date.now() }
        : b
    );
    localStorage.setItem(STORAGE_KEYS.BANKS, JSON.stringify(updatedBanks));
    setBanks(updatedBanks);
    setIsMoveCategoryDialogOpen(false);
    setBankToMove(null);
    setSuccess(`题库已移动到${selectedCategoryId === 'uncategorized' ? '未分类' : categories.find(c => c.id === selectedCategoryId)?.name || '指定分类'}`);
  };

  // 打开移动分类对话框
  const openMoveCategoryDialog = (bank: QuestionBank) => {
    setBankToMove(bank);
    setSelectedCategoryId(bank.categoryId || 'uncategorized');
    setIsMoveCategoryDialogOpen(true);
  };

  // 进入题库编辑页面
  const goToBankEdit = (bank: QuestionBank) => {
    router.push(`/admin/bank/${bank.id}`);
  };

  // 获取分类名称
  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return '未分类';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || '未分类';
  };

  // 获取分类颜色
  const getCategoryColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-700',
      green: 'bg-green-100 text-green-700',
      red: 'bg-red-100 text-red-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      purple: 'bg-purple-100 text-purple-700',
      pink: 'bg-pink-100 text-pink-700',
      indigo: 'bg-indigo-100 text-indigo-700',
      cyan: 'bg-cyan-100 text-cyan-700',
      gray: 'bg-gray-100 text-gray-600',
    };
    return colorMap[color] || 'bg-gray-100 text-gray-600';
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
  const filteredBanks = banks.filter(bank => {
    const matchSearch = bank.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = filterCategory === 'all' || bank.categoryId === filterCategory || (!bank.categoryId && filterCategory === 'uncategorized');
    return matchSearch && matchCategory;
  });

  // 按分类分组
  const groupedBanks = filteredBanks.reduce((acc, bank) => {
    const categoryId = bank.categoryId || 'uncategorized';
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(bank);
    return acc;
  }, {} as Record<string, QuestionBank[]>);

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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

          <Link href="/admin/users">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">用户管理</CardTitle>
                <User className="h-5 w-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">管理</div>
                <p className="text-xs text-slate-500 mt-1">查看/添加用户</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/codes">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">激活码管理</CardTitle>
                <Key className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">生成</div>
                <p className="text-xs text-slate-500 mt-1">创建/管理激活码</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* 导入区域 */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5" />
                导入题库
              </CardTitle>
              <CardDescription>
                导入 JSON 格式题库到指定分类
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setIsCategoryModalOpen(true)}>
              <FolderOpen className="h-4 w-4 mr-2" />
              管理分类
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="category-select">导入到分类</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部分类</SelectItem>
                    <SelectItem value="uncategorized">未分类</SelectItem>
                    {/* 顶级分类 */}
                    {categories.filter(c => !c.parentId).map((cat) => (
                      <SelectItem key={`parent-${cat.id}`} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                    {/* 子分类 */}
                    {categories.filter(c => c.parentId).map((child) => (
                      <SelectItem key={`child-${child.id}`} value={child.id}>
                        &nbsp;&nbsp;&nbsp;&nbsp;├ {child.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-[2]">
                <Label htmlFor="json-upload">选择 JSON 文件</Label>
                <Label htmlFor="json-upload" className="cursor-pointer mt-2 block">
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-green-500 hover:bg-green-50 transition-colors">
                    <FileJson className="h-6 w-6 mx-auto mb-1 text-slate-400" />
                    <p className="text-sm">{isImporting ? '正在导入...' : '点击选择 JSON 文件'}</p>
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
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="搜索题库..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="筛选分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部分类</SelectItem>
                    <SelectItem value="uncategorized">未分类</SelectItem>
                    {/* 一级分类 */}
                    {categories.filter(c => !c.parentId).map((cat) => (
                      <>
                        <SelectItem key={`parent-${cat.id}`} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                        {/* 子分类 - 缩进显示 */}
                        {categories.filter(c => c.parentId === cat.id).map((child) => (
                          <SelectItem key={`child-${child.id}`} value={child.id}>
                            &nbsp;&nbsp;&nbsp;&nbsp;├ {child.name}
                          </SelectItem>
                        ))}
                      </>
                    ))}
                  </SelectContent>
                </Select>
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
              <div className="space-y-6">
                {Object.entries(groupedBanks).map(([categoryId, categoryBanks]) => {
                  const category = categories.find(c => c.id === categoryId);
                  let categoryName: string;
                  let categoryColor: string;
                  
                  if (categoryId === 'uncategorized') {
                    categoryName = '未分类';
                    categoryColor = 'gray';
                  } else if (category) {
                    // 如果是子分类，显示完整的分类路径
                    if (category.parentId) {
                      const parentCategory = categories.find(c => c.id === category.parentId);
                      categoryName = parentCategory ? `${parentCategory.name} > ${category.name}` : category.name;
                    } else {
                      categoryName = category.name;
                    }
                    categoryColor = category.color;
                  } else {
                    categoryName = '未知分类';
                    categoryColor = 'gray';
                  }
                  
                  return (
                    <div key={categoryId}>
                      <div className="flex items-center gap-2 mb-3">
                        {category?.parentId ? (
                          <FolderOpen className="h-4 w-4 text-slate-400" />
                        ) : (
                          <Folder className="h-4 w-4 text-slate-500" />
                        )}
                        <h3 className={`font-medium px-2 py-0.5 rounded ${getCategoryColorClass(categoryColor)}`}>
                          {categoryName}
                        </h3>
                        <span className="text-sm text-slate-400">({categoryBanks.length})</span>
                      </div>
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
                          {categoryBanks.map((bank) => (
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
                                  <span className="font-medium">{bank.name}</span>
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
                                    <DropdownMenuItem onClick={() => openMoveCategoryDialog(bank)}>
                                      <FolderOpen className="h-4 w-4 mr-2" />
                                      移动分类
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => goToBankEdit(bank)}>
                                      <List className="h-4 w-4 mr-2" />
                                      编辑题目
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExportBank(bank)}>
                                      <Download className="h-4 w-4 mr-2" />
                                      导出 JSON
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* 分类管理弹窗 */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>管理分类</DialogTitle>
            <DialogDescription>支持创建一级分类和二级分类（子分类）</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {/* 已有分类列表 - 二级结构 */}
            <div className="space-y-3">
              {categories.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">暂无分类，请添加一级分类</p>
              ) : (
                <>
                  {/* 顶级分类 */}
                  {categories.filter(c => !c.parentId).map((cat) => (
                    <div key={cat.id} className="space-y-2">
                      {/* 顶级分类项 */}
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-slate-500" />
                          <Badge className={getCategoryColorClass(cat.color)}>{cat.name}</Badge>
                          <span className="text-xs text-slate-400">
                            ({categories.filter(c => c.parentId === cat.id).length}个子分类)
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => {
                            setEditingCategory(cat);
                            setCategoryName(cat.name);
                            setCategoryColor(cat.color);
                            setCategoryParentId(cat.parentId);
                          }}>
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteCategory(cat)}>
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* 子分类 */}
                      <div className="ml-6 space-y-1">
                        {categories.filter(c => c.parentId === cat.id).map((child) => (
                          <div key={child.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
                            <div className="flex items-center gap-2">
                              <FolderOpen className="w-3 h-3 text-slate-400" />
                              <Badge className={getCategoryColorClass(child.color)} variant="outline">{child.name}</Badge>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => {
                                setEditingCategory(child);
                                setCategoryName(child.name);
                                setCategoryColor(child.color);
                                setCategoryParentId(child.parentId);
                              }}>
                                <Edit3 className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => deleteCategory(child)}>
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
            
            {/* 添加/编辑分类表单 */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Select 
                  value={categoryParentId || 'root'} 
                  onValueChange={(v) => setCategoryParentId(v === 'root' ? undefined : v)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">一级分类</SelectItem>
                    {categories.filter(c => !c.parentId).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name} 的子分类
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="分类名称"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="flex-1"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {categoryColors.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCategoryColor(c.value)}
                    className={`w-8 h-8 rounded-full ${
                      categoryColor === c.value ? 'ring-2 ring-offset-2 ring-slate-400' : ''
                    } ${
                      c.value === 'blue' ? 'bg-blue-500' :
                      c.value === 'green' ? 'bg-green-500' :
                      c.value === 'red' ? 'bg-red-500' :
                      c.value === 'yellow' ? 'bg-yellow-500' :
                      c.value === 'purple' ? 'bg-purple-500' :
                      c.value === 'pink' ? 'bg-pink-500' :
                      c.value === 'indigo' ? 'bg-indigo-500' :
                      'bg-cyan-500'
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
              <Button onClick={saveCategory} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                {editingCategory ? '保存修改' : '添加分类'}
              </Button>
              {editingCategory && (
                <Button variant="outline" onClick={resetCategoryForm} className="w-full">
                  取消编辑
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除题库&quot;{bankToDelete?.name}&quot;吗？此操作不可恢复。
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

      {/* 移动分类对话框 */}
      <Dialog open={isMoveCategoryDialogOpen} onOpenChange={setIsMoveCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>移动题库到分类</DialogTitle>
            <DialogDescription>
              将「{bankToMove?.name}」移动到指定分类
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="move-category">选择分类</Label>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uncategorized">未分类</SelectItem>
                {/* 顶级分类 */}
                {categories.filter(c => !c.parentId).map((cat) => (
                  <SelectItem key={`parent-${cat.id}`} value={cat.id}>{cat.name}</SelectItem>
                ))}
                {/* 子分类 */}
                {categories.filter(c => c.parentId).map((child) => (
                  <SelectItem key={`child-${child.id}`} value={child.id}>
                    &nbsp;&nbsp;&nbsp;&nbsp;├ {child.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveCategoryDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleMoveCategory}>
              确认移动
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
