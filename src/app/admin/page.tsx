'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getLoginPath } from '@/lib/admin-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  BookOpen,
  FileText,
  Trash2,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
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
  GripVertical,
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
  questionCount?: number; // 题目数量（来自数据库）
  sortOrder?: number; // 排序序号
  createdAt: number;
  updatedAt: number;
}

// 可拖拽排序的题库行组件
function SortableBankRow({ 
  bank, 
  onEdit, 
  onDelete,
  onClick,
  onMoveCategory,
  onEditQuestions,
  isEditing,
  editingName,
  onEditingNameChange,
  onSave,
  onCancel
}: { 
  bank: QuestionBank; 
  onEdit: () => void; 
  onDelete: () => void;
  onClick: () => void;
  onMoveCategory: () => void;
  onEditQuestions: () => void;
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bank.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // 处理编辑状态下的键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <TableRow ref={setNodeRef} style={style} className="hover:bg-slate-50">
      <TableCell>
        <button 
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 rounded"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 text-slate-400" />
        </button>
      </TableCell>
      <TableCell className="max-w-[300px]">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editingName}
              onChange={(e) => onEditingNameChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={onSave}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
              title="保存"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={onCancel}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
              title="取消"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left truncate block w-full"
            title="点击修改名称"
          >
            {bank.name}
          </button>
        )}
      </TableCell>
      <TableCell onClick={onClick} className="cursor-pointer">
        <Badge variant="secondary">
          {bank.questionCount || 0} 题
        </Badge>
      </TableCell>
      <TableCell className="text-slate-500">
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
            <DropdownMenuItem onClick={onEditQuestions}>
              <FileText className="h-4 w-4 mr-2" />
              编辑题目
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Edit3 className="h-4 w-4 mr-2" />
              修改名称
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMoveCategory}>
              <FolderOpen className="h-4 w-4 mr-2" />
              移动分类
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
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
    else if (t === 'fill-blank' || t === 'fillblank' || t === 'fill' || t === 'short') return 'fill-blank';
    else if (t === 'comprehensive') return 'comprehensive';
    else if (t.includes('多选')) return 'multiple';
    else if (t.includes('判断')) return 'true-false';
    else if (t.includes('填空') || t.includes('简答') || t.includes('问答')) return 'fill-blank';
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
  const [editingBankDesc, setEditingBankDesc] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10; // 每页显示的题库数量
  
  // 分类管理状态
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState('blue');
  const [categoryParentId, setCategoryParentId] = useState<string | null>(null);

  // 移动题库分类状态
  const [isMoveCategoryDialogOpen, setIsMoveCategoryDialogOpen] = useState(false);
  const [bankToMove, setBankToMove] = useState<QuestionBank | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('uncategorized');

  // 验证登录状态
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const user = localStorage.getItem('admin_user');
    
    if (!token || !user) {
      router.push(getLoginPath());
      return;
    }

    try {
      // Token 格式: base64payload.signature (HMAC-SHA256)
      const payloadStr = token.split('.')[0];
      const payload = JSON.parse(atob(payloadStr));
      if (payload.exp < Date.now()) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        router.push(getLoginPath());
        return;
      }
      setIsAuthenticated(true);
    } catch {
      router.push(getLoginPath());
    }
  }, [router]);

  // 从数据库加载分类
  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      // 备用：从 localStorage 获取
      const storedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (storedCategories) {
        setCategories(JSON.parse(storedCategories));
      }
    }
  }, []);

  // 加载题库数据（从数据库）
  const loadBanks = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      // 从数据库加载题库
      const response = await fetch('/api/admin/banks', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        // 转换数据库题库格式为前端格式
        const dbBanks: QuestionBank[] = (data.banks || []).map((b: {
          id: string;
          name: string;
          description: string | null;
          question_count: number;
          category_id: string | null;
          sort_order: number | null;
          created_at: string;
        }) => ({
          id: b.id,
          name: b.name,
          description: b.description || undefined,
          questionIds: [],
          questionCount: b.question_count || 0,
          categoryId: b.category_id || undefined,
          sortOrder: b.sort_order ?? undefined,
          createdAt: new Date(b.created_at).getTime()
        }))
        // 按 sortOrder 排序
        .sort((a: QuestionBank, b: QuestionBank) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
        
        setBanks(dbBanks);
        // 计算总题目数（使用数据库中的 question_count）
        const totalQ = (data.banks || []).reduce((sum: number, b: { question_count?: number }) => sum + (b.question_count || 0), 0);
        setStats(prev => ({
          ...prev,
          totalBanks: dbBanks.length,
          totalQuestions: totalQ
        }));
      }
    } catch (error) {
      console.error('加载题库失败:', error);
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
    router.push(getLoginPath());
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

      const questions = data.questions;
      
      if (!Array.isArray(questions)) {
        throw new Error('JSON 格式错误：缺少 questions 数组');
      }

      if (questions.length === 0) {
        throw new Error('JSON 中没有有效的题目');
      }

      const bankName = (data.subjectName as string) || (data.bankName as string) || (data.title as string) || file.name.replace('.json', '') || '导入题库';

      // 调用 API 保存到数据库
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/import-json', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          questions,
          bankName,
          categoryId: filterCategory !== 'all' ? filterCategory : undefined
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '导入失败');
      }

      setSuccess(`成功导入 ${result.count} 道题目到"${result.bankName}"题库`);
      loadBanks(); // 重新加载题库
      
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
  const resetCategoryForm = (closeModal = true) => {
    if (closeModal) {
      setIsCategoryModalOpen(false);
    }
    setEditingCategory(null);
    setCategoryName('');
    setCategoryColor('blue');
    setCategoryParentId(null);
  };

  // 保存分类（添加/更新到数据库）
  const saveCategory = async () => {
    if (!categoryName.trim()) {
      setError('分类名称不能为空');
      return;
    }

    try {
      if (editingCategory) {
        // 更新分类
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`/api/admin/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: categoryName.trim(),
            color: categoryColor,
            parentId: categoryParentId,
          }),
        });

        if (!response.ok) {
          throw new Error('更新失败');
        }
        setSuccess('分类已更新');
        // 编辑成功后关闭模态框
        resetCategoryForm();
      } else {
        // 添加分类
        const siblings = categories.filter((c: Category) => c.parentId === categoryParentId);
        const token = localStorage.getItem('admin_token');
        const response = await fetch('/api/admin/categories', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: categoryName.trim(),
            color: categoryColor,
            order: siblings.length,
            parentId: categoryParentId,
          }),
        });

        if (!response.ok) {
          throw new Error('添加失败');
        }
        setSuccess('分类已添加');
        // 添加成功后保留表单，方便连续添加（只清除名称）
        setCategoryName('');
        // 重新加载分类
        await loadCategories();
      }
    } catch (err) {
      console.error('保存分类失败:', err);
      setError('保存失败，请重试');
    }
  };

  // 删除分类（包括子分类）
  // 删除分类（从数据库）
  const deleteCategory = async (category: Category) => {
    // 收集所有要删除的分类ID（包括子分类）
    const idsToDelete = new Set<string>();
    idsToDelete.add(category.id);
    
    // 递归查找子分类
    const findChildren = (parentId: string) => {
      categories.forEach((c: Category) => {
        if (c.parentId === parentId) {
          idsToDelete.add(c.id);
          findChildren(c.id);
        }
      });
    };
    findChildren(category.id);
    
    try {
      // 逐个删除分类
      const token = localStorage.getItem('admin_token');
      for (const id of idsToDelete) {
        const response = await fetch(`/api/admin/categories/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const data = await response.json();
          setError(data.error || '删除失败');
          return;
        }
      }
      
      // 重新加载分类
      await loadCategories();
      setSuccess('分类已删除');
    } catch (err) {
      console.error('删除分类失败:', err);
      setError('删除失败，请重试');
    }
  };

  // 开始编辑题库名称（点击名称直接进入编辑）
  const startEditBankName = (bank: QuestionBank) => {
    setEditingBankId(bank.id);
    setEditingBankName(bank.name);
  };

  // 保存题库名称
  const saveBankName = async () => {
    if (!editingBankId || !editingBankName.trim()) {
      setEditingBankId(null);
      setEditingBankName('');
      return;
    }

    // 如果名称没变化，直接取消
    const currentBank = banks.find(b => b.id === editingBankId);
    if (currentBank && currentBank.name === editingBankName.trim()) {
      setEditingBankId(null);
      setEditingBankName('');
      return;
    }

    try {
      // 调用 API 更新数据库
      const response = await fetch(`/api/admin/banks/${editingBankId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({
          name: editingBankName.trim()
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '更新失败');
      }

      // 更新本地状态
      setBanks(prevBanks => prevBanks.map(b => 
        b.id === editingBankId 
          ? { ...b, name: editingBankName.trim(), updatedAt: Date.now() }
          : b
      ));
      setSuccess('题库名称已更新');
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setEditingBankId(null);
      setEditingBankName('');
    }
  };

  // 取消编辑
  const cancelEditBankName = () => {
    setEditingBankId(null);
    setEditingBankName('');
    setEditingBankDesc('');
  };

  // 打开编辑题库对话框
  const openEditBankDialog = (bank: QuestionBank) => {
    setEditingBankId(bank.id);
    setEditingBankName(bank.name);
    setEditingBankDesc(bank.description || '');
  };

  // 保存题库信息
  const saveBankInfo = async () => {
    if (!editingBankId || !editingBankName.trim()) {
      setEditingBankId(null);
      return;
    }

    try {
      // 调用 API 更新数据库
      const response = await fetch(`/api/admin/banks/${editingBankId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({
          name: editingBankName.trim(),
          description: editingBankDesc.trim()
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '更新失败');
      }

      // 更新本地状态
      setBanks(prevBanks => prevBanks.map(b => 
        b.id === editingBankId 
          ? { ...b, name: editingBankName.trim(), description: editingBankDesc.trim(), updatedAt: Date.now() }
          : b
      ));
      setSuccess('题库信息已更新');
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setEditingBankId(null);
    }
  };

  // 删除题库
  // DnD 传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 处理拖拽结束
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = banks.findIndex((b) => b.id === active.id);
      const newIndex = banks.findIndex((b) => b.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // 重新排序
        const newBanks = arrayMove(banks, oldIndex, newIndex);
        
        // 更新状态
        setBanks(newBanks);

        // 保存排序到数据库
        try {
          const token = localStorage.getItem('admin_token');
          const response = await fetch('/api/admin/banks/reorder', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              orders: newBanks.map((bank, index) => ({
                id: bank.id,
                sortOrder: index
              }))
            })
          });

          if (!response.ok) {
            console.error('保存排序失败');
            // 失败后重新加载
            loadBanks();
          }
        } catch (error) {
          console.error('保存排序失败:', error);
          loadBanks();
        }
      }
    }
  }, [banks, loadBanks]);

  const handleDeleteBank = async () => {
    if (!bankToDelete) return;

    setIsDeleteDialogOpen(false);
    
    try {
      // 删除数据库中的题库和题目
      const response = await fetch(`/api/admin/banks/${bankToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除失败');
      }

      // 删除 localStorage 中的数据
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
      setBankToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  // 导出题库为 Word
  const handleExportBank = async (bank: QuestionBank) => {
    try {
      setError('');
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setError('请先登录');
        return;
      }

      console.log('[Export] Starting export for bank:', bank.id);
      const response = await fetch(`/api/admin/banks/export/${bank.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('[Export] Response status:', response.status);
      
      // 检查响应状态
      if (!response.ok) {
        let errorMsg = '导出失败';
        try {
          const data = await response.json();
          errorMsg = data.error || errorMsg;
        } catch {
          errorMsg = `导出失败 (HTTP ${response.status})`;
        }
        console.error('[Export] Error response:', errorMsg);
        setError(errorMsg);
        return;
      }
      
      // 检查 Content-Type
      const contentType = response.headers.get('Content-Type');
      console.log('[Export] Content-Type:', contentType);
      
      if (!contentType?.includes('application/vnd.openxmlformats')) {
        // 可能是错误响应
        const text = await response.text();
        console.error('[Export] Unexpected content:', text.substring(0, 200));
        setError('导出失败：服务器返回了非预期格式');
        return;
      }
      
      // 获取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${bank.name}.docx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match) {
          filename = decodeURIComponent(match[1].replace(/['"]/g, ''));
        }
      }
      
      // 下载文件
      const blob = await response.blob();
      console.log('[Export] Blob size:', blob.size);
      
      if (blob.size === 0) {
        setError('导出失败：文件为空');
        return;
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      console.log('[Export] Success!');
    } catch (err) {
      console.error('[Export] Exception:', err);
      setError(err instanceof Error ? err.message : '导出失败，请重试');
    }
  };

  // 移动题库到指定分类
  const handleMoveCategory = async () => {
    if (!bankToMove) return;
    
    try {
      // 调用 API 更新数据库
      const response = await fetch(`/api/admin/banks/${bankToMove.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({
          categoryId: selectedCategoryId === 'uncategorized' ? null : selectedCategoryId
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '移动失败');
      }

      // 更新本地状态
      setBanks(prevBanks => prevBanks.map(b => 
        b.id === bankToMove.id 
          ? { ...b, categoryId: selectedCategoryId === 'uncategorized' ? undefined : selectedCategoryId, updatedAt: Date.now() }
          : b
      ));
      
      const targetCategory = selectedCategoryId === 'uncategorized' 
        ? '未分类' 
        : categories.find(c => c.id === selectedCategoryId)?.name || '指定分类';
      
      setSuccess(`题库已移动到「${targetCategory}」`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '移动失败');
    } finally {
      setIsMoveCategoryDialogOpen(false);
      setBankToMove(null);
    }
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

  // 计算分页
  const totalPages = Math.ceil(filteredBanks.length / pageSize);
  const paginatedBanks = filteredBanks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // 按分类分组（使用分页后的数据）
  const groupedBanks = paginatedBanks.reduce((acc, bank) => {
    const categoryId = bank.categoryId || 'uncategorized';
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(bank);
    return acc;
  }, {} as Record<string, QuestionBank[]>);

  // 切换分页时滚动到顶部
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 搜索或筛选变化时重置页码
  const handleFilterChange = () => {
    setCurrentPage(1);
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
                    {/* 按层级显示分类 */}
                    {categories.filter(c => !c.parentId).map((cat) => (
                      <div key={`parent-${cat.id}`}>
                        <SelectItem value={cat.id}>{cat.name}</SelectItem>
                        {/* 子分类 - 缩进显示 */}
                        {categories.filter(c => c.parentId === cat.id).map((child) => (
                          <SelectItem key={`child-${child.id}`} value={child.id}>
                            &nbsp;&nbsp;&nbsp;&nbsp;├ {child.name}
                          </SelectItem>
                        ))}
                      </div>
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
                <CardDescription>共 {filteredBanks.length} 个题库（第 {currentPage}/{totalPages} 页）</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="搜索题库..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); handleFilterChange(); }}
                    className="pl-9"
                  />
                </div>
                <Select value={filterCategory} onValueChange={(val) => { setFilterCategory(val); handleFilterChange(); }}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="筛选分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部分类</SelectItem>
                    <SelectItem value="uncategorized">未分类</SelectItem>
                    {/* 一级分类 */}
                    {categories.filter(c => !c.parentId).map((cat) => (
                      <div key={`parent-${cat.id}`}>
                        <SelectItem value={cat.id}>
                          {cat.name}
                        </SelectItem>
                        {/* 子分类 - 缩进显示 */}
                        {categories.filter(c => c.parentId === cat.id).map((child) => (
                          <SelectItem key={`child-${child.id}`} value={child.id}>
                            &nbsp;&nbsp;&nbsp;&nbsp;├ {child.name}
                          </SelectItem>
                        ))}
                      </div>
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
                        <span className="text-xs text-slate-400 ml-2">（拖拽排序）</span>
                      </div>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={categoryBanks.map(b => b.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10"></TableHead>
                                <TableHead>题库名称</TableHead>
                                <TableHead>题目数量</TableHead>
                                <TableHead>创建时间</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {categoryBanks.map((bank) => (
                                <SortableBankRow
                                  key={bank.id}
                                  bank={bank}
                                  onEdit={() => startEditBankName(bank)}
                                  onDelete={() => {
                                    setBankToDelete(bank);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                  onClick={() => goToBankEdit(bank)}
                                  onMoveCategory={() => openMoveCategoryDialog(bank)}
                                  onEditQuestions={() => goToBankEdit(bank)}
                                  isEditing={editingBankId === bank.id}
                                  editingName={editingBankId === bank.id ? editingBankName : ''}
                                  onEditingNameChange={setEditingBankName}
                                  onSave={saveBankName}
                                  onCancel={cancelEditBankName}
                                />
                              ))}
                            </TableBody>
                          </Table>
                        </SortableContext>
                      </DndContext>
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
                            setCategoryParentId(cat.parentId || null);
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
                                setCategoryParentId(child.parentId || null);
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
                  value={categoryParentId === null ? 'root' : (categoryParentId || 'root')} 
                  onValueChange={(v) => setCategoryParentId(v === 'root' ? null : v)}
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
                <Button variant="outline" onClick={() => resetCategoryForm(true)} className="w-full">
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

      {/* 编辑题库对话框 */}
      <Dialog open={!!editingBankId} onOpenChange={(open) => !open && cancelEditBankName()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑题库</DialogTitle>
            <DialogDescription>
              修改题库的名称和描述
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bank-name">题库名称</Label>
              <Input
                id="bank-name"
                value={editingBankName}
                onChange={(e) => setEditingBankName(e.target.value)}
                placeholder="请输入题库名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-desc">描述（可选）</Label>
              <Textarea
                id="bank-desc"
                value={editingBankDesc}
                onChange={(e) => setEditingBankDesc(e.target.value)}
                placeholder="请输入题库描述"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelEditBankName}>
              取消
            </Button>
            <Button onClick={saveBankInfo} disabled={!editingBankName.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分页组件 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            首页
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            上一页
          </Button>
          <div className="flex items-center gap-1">
            {/* 页码按钮 */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
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
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(pageNum)}
                  className="w-10"
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            下一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            末页
          </Button>
        </div>
      )}
    </div>
  );
}
