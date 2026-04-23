'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';

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

interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  questionIds: string[];
  createdAt: number;
  updatedAt: number;
}

// 生成 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 题型显示映射
const typeLabels: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  'true-false': '判断题',
  'fill-blank': '填空题',
  comprehensive: '综合题'
};

const typeColors: Record<string, string> = {
  single: 'bg-blue-100 text-blue-700',
  multiple: 'bg-purple-100 text-purple-700',
  'true-false': 'bg-green-100 text-green-700',
  'fill-blank': 'bg-orange-100 text-orange-700',
  comprehensive: 'bg-red-100 text-red-700'
};

export default function BankEditPage() {
  const router = useRouter();
  const params = useParams();
  const bankId = params.id as string;
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 编辑弹窗状态
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);

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

  // 从数据库加载数据
  const loadData = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      // 从数据库加载题库
      const bankResponse = await fetch('/api/admin/banks', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!bankResponse.ok) {
        throw new Error('获取题库失败');
      }
      const bankData = await bankResponse.json();
      const dbBanks = bankData.banks || [];
      const foundBank = dbBanks.find((b: { id: string }) => b.id === bankId);
      
      if (foundBank) {
        setBank({
          id: foundBank.id,
          name: foundBank.name,
          description: foundBank.description || undefined,
          questionIds: [],
          createdAt: new Date(foundBank.created_at).getTime(),
          updatedAt: new Date(foundBank.updated_at).getTime()
        });
      } else {
        router.push('/admin');
        return;
      }
      
      // 从数据库加载题目
      const questionsResponse = await fetch(`/api/admin/banks/${bankId}/questions`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!questionsResponse.ok) {
        throw new Error('获取题目失败');
      }
      const questionsData = await questionsResponse.json();
      const dbQuestions: Question[] = questionsData.questions || [];
      
      setQuestions(dbQuestions);
      setFilteredQuestions(dbQuestions);
    } catch (error) {
      console.error('加载数据失败:', error);
      setError('加载数据失败，请刷新重试');
    }
  }, [bankId, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  // 搜索和筛选
  useEffect(() => {
    let filtered = questions;
    
    if (searchTerm) {
      filtered = filtered.filter(q => 
        (q.content?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (q.caseBackground?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (q.explanation?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterType !== 'all') {
      filtered = filtered.filter(q => q.type === filterType);
    }
    
    setFilteredQuestions(filtered);
  }, [questions, searchTerm, filterType]);

  // 保存题目（更新到数据库）
  const saveQuestion = async (question: Question) => {
    try {
      const token = localStorage.getItem('admin_token');
      
      // 如果是综合题，先保存父题，再处理子题
      if (question.type === 'comprehensive') {
        // 保存父题
        const parentResponse = await fetch(`/api/admin/questions/${question.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            type: question.type,
            content: '', // 综合题内容为空，案例背景存 case_background
            case_background: question.caseBackground,
            explanation: question.explanation,
            difficulty: question.difficulty,
            tags: question.tags,
          }),
        });

        if (!parentResponse.ok) {
          throw new Error('保存父题失败');
        }

        // 获取现有子题
        const existingChildren = questions.filter(q => q.parentId === question.id);
        
        // 处理子题：更新或新增
        const currentChildIds = question.children?.map(c => c.id) || [];
        const existingChildIds = existingChildren.map(c => c.id);
        
        // 删除被移除的子题
        const toDelete = existingChildren.filter(c => !currentChildIds.includes(c.id));
        for (const child of toDelete) {
          await fetch(`/api/admin/questions/${child.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }

        // 保存/更新子题
        if (question.children) {
          for (const child of question.children) {
            const isExisting = existingChildIds.includes(child.id);
            const childData = {
              ...child,
              parentId: question.id,
              bankId: bankId,
              type: child.type,
              content: child.content || '',
              options: ['single', 'multiple'].includes(child.type) ? child.options : undefined,
              answer: child.answer,
              difficulty: child.difficulty || 'medium',
              tags: child.tags || [],
            };

            if (isExisting) {
              await fetch(`/api/admin/questions/${child.id}`, {
                method: 'PUT',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(childData),
              });
            } else {
              await fetch(`/api/admin/banks/${bankId}/questions`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ question: childData }),
              });
            }
          }
        }
      } else {
        // 非综合题，直接保存
        const response = await fetch(`/api/admin/questions/${question.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            type: question.type,
            content: question.content,
            options: question.options,
            answer: question.answer,
            explanation: question.explanation,
            difficulty: question.difficulty,
            tags: question.tags,
          }),
        });

        if (!response.ok) {
          throw new Error('保存失败');
        }
      }

      await loadData();
      setSuccess('题目保存成功');
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('保存题目失败:', error);
      setError('保存题目失败，请重试');
    }
  };

  // 添加题目
  const addQuestion = async (question: Question) => {
    try {
      const newQuestion = { ...question, id: generateId(), bankId, createdAt: Date.now() };
      const token = localStorage.getItem('admin_token');
      
      // 如果是综合题
      if (question.type === 'comprehensive' && question.children && question.children.length > 0) {
        // 先创建父题
        const parentData = {
          type: question.type,
          content: '',
          case_background: question.caseBackground,
          explanation: question.explanation,
          difficulty: question.difficulty,
          tags: question.tags || [],
        };
        
        const parentResponse = await fetch(`/api/admin/banks/${bankId}/questions`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ question: { ...parentData, id: newQuestion.id, bankId, createdAt: Date.now() } }),
        });

        if (!parentResponse.ok) {
          throw new Error('添加综合题失败');
        }

        const parentResult = await parentResponse.json();
        const parentId = parentResult.id || newQuestion.id;

        // 创建子题
        for (const child of question.children) {
          const childData = {
            ...child,
            id: child.id || generateId(),
            parentId: parentId,
            bankId: bankId,
            type: child.type,
            content: child.content || '',
            options: ['single', 'multiple'].includes(child.type) ? child.options : undefined,
            answer: child.answer,
            difficulty: child.difficulty || 'medium',
            tags: child.tags || [],
            createdAt: Date.now(),
          };

          await fetch(`/api/admin/banks/${bankId}/questions`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ question: childData }),
          });
        }
      } else {
        // 非综合题，直接添加
        const response = await fetch(`/api/admin/banks/${bankId}/questions`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ question: newQuestion }),
        });

        if (!response.ok) {
          throw new Error('添加失败');
        }
      }

      await loadData();
      setSuccess('题目添加成功');
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('添加题目失败:', error);
      setError('添加题目失败，请重试');
    }
  };

  // 更新题目
  const updateQuestion = (question: Question) => {
    saveQuestion(question);
    setSuccess('题目更新成功');
    setIsEditModalOpen(false);
    setEditingQuestion(null);
  };

  // 删除题目
  const deleteQuestion = async () => {
    if (!questionToDelete) return;
    
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/questions/${questionToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('删除失败');
      }

      await loadData();
      setSuccess('题目已删除');
      setIsDeleteDialogOpen(false);
      setQuestionToDelete(null);
    } catch (error) {
      console.error('删除题目失败:', error);
      setError('删除题目失败，请重试');
    }
  };

  // 打开编辑弹窗
  const openEditModal = (question: Question) => {
    // 如果是综合题，获取所有子题
    if (question.type === 'comprehensive') {
      const childQuestions = questions.filter(q => q.parentId === question.id);
      setEditingQuestion({ ...question, children: childQuestions });
    } else {
      setEditingQuestion({ ...question });
    }
    setIsEditModalOpen(true);
  };

  // 返回列表
  const goBack = () => {
    router.push('/admin');
  };

  if (!isAuthenticated || !bank) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={goBack} className="p-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{bank.name}</h1>
              <p className="text-sm text-slate-500">{questions.length} 道题目</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              添加题目
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  setError('');
                  const token = localStorage.getItem('admin_token');
                  const response = await fetch(`/api/admin/banks/export/${bankId}`, {
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  });
                  
                  if (!response.ok) {
                    throw new Error('导出失败');
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
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                  setSuccess('导出成功');
                } catch (err) {
                  console.error('导出失败:', err);
                  setError('导出失败，请重试');
                }
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              导出Word
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

        {/* 搜索和筛选 */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索题目内容..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="筛选题型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部题型</SelectItem>
                  <SelectItem value="single">单选题</SelectItem>
                  <SelectItem value="multiple">多选题</SelectItem>
                  <SelectItem value="true-false">判断题</SelectItem>
                  <SelectItem value="fill-blank">填空题</SelectItem>
                  <SelectItem value="comprehensive">综合题</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 题目列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              题目列表
            </CardTitle>
            <CardDescription>
              共 {filteredQuestions.length} 道题目
              {filteredQuestions.length !== questions.length && (
                <span className="text-orange-600">（已筛选）</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredQuestions.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>暂无题目</p>
                <p className="text-sm mt-1">点击上方按钮添加题目</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">题型</TableHead>
                    <TableHead>题目内容</TableHead>
                    <TableHead className="w-32 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuestions.map((question) => (
                    <TableRow key={question.id}>
                      <TableCell>
                        <Badge className={typeColors[question.type] || 'bg-gray-100'}>
                          {typeLabels[question.type] || question.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          {question.type === 'comprehensive' ? (
                            <span className="text-slate-600 line-clamp-2">
                              {question.caseBackground?.slice(0, 100)}
                              {question.caseBackground && question.caseBackground.length > 100 && '...'}
                            </span>
                          ) : (
                            <span className="line-clamp-2">{question.content}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => openEditModal(question)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setQuestionToDelete(question);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* 添加/编辑题目弹窗 */}
      <QuestionEditModal
        open={isAddModalOpen || isEditModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
          setEditingQuestion(null);
        }}
        question={editingQuestion}
        onSave={editingQuestion ? updateQuestion : addQuestion}
        mode={editingQuestion ? 'edit' : 'add'}
      />

      {/* 删除确认对话框 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除这道题目吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={deleteQuestion}>
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 题目编辑弹窗组件
interface QuestionEditModalProps {
  open: boolean;
  onClose: () => void;
  question: Question | null;
  onSave: (question: Question) => void;
  mode: 'add' | 'edit';
}

function QuestionEditModal({ open, onClose, question, onSave, mode }: QuestionEditModalProps) {
  const [type, setType] = useState<QuestionType>('single');
  const [content, setContent] = useState('');
  const [options, setOptions] = useState<{ id: string; text: string }[]>([
    { id: 'a', text: '' },
    { id: 'b', text: '' },
    { id: 'c', text: '' },
    { id: 'd', text: '' },
  ]);
  const [answer, setAnswer] = useState<string | string[]>('a');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  
  // 子题列表（综合题用）
  const [children, setChildren] = useState<Question[]>([]);

  // 初始化数据
  useEffect(() => {
    if (question) {
      setType(question.type);
      // 综合题的案例背景存储在 caseBackground 字段
      setContent(question.type === 'comprehensive' ? (question.caseBackground || '') : (question.content || ''));
      setOptions(question.options || [
        { id: 'a', text: '' },
        { id: 'b', text: '' },
        { id: 'c', text: '' },
        { id: 'd', text: '' },
      ]);
      setAnswer(question.answer || 'a');
      setExplanation(question.explanation || '');
      setDifficulty(question.difficulty || 'medium');
      // 综合题的子题
      setChildren(question.children || []);
    } else {
      setType('single');
      setContent('');
      setOptions([
        { id: 'a', text: '' },
        { id: 'b', text: '' },
        { id: 'c', text: '' },
        { id: 'd', text: '' },
      ]);
      setAnswer('a');
      setExplanation('');
      setDifficulty('medium');
      setChildren([]);
    }
  }, [question, open]);

  // 处理选项变更
  const handleOptionChange = (id: string, text: string) => {
    setOptions(prev => prev.map(opt => opt.id === id ? { ...opt, text } : opt));
  };

  // 添加子题
  const addChildQuestion = () => {
    const newChild: Question = {
      id: generateId(),
      type: 'single',
      content: '',
      options: [
        { id: 'a', text: '' },
        { id: 'b', text: '' },
        { id: 'c', text: '' },
        { id: 'd', text: '' },
      ],
      answer: 'a',
      difficulty: 'medium',
      tags: [],
      createdAt: Date.now(),
    };
    setChildren([...children, newChild]);
  };

  // 删除子题
  const removeChildQuestion = (index: number) => {
    setChildren(children.filter((_, i) => i !== index));
  };

  // 更新子题
  const updateChildQuestion = (index: number, updates: Partial<Question>) => {
    setChildren(children.map((child, i) => 
      i === index ? { ...child, ...updates } : child
    ));
  };

  // 提交
  const handleSubmit = () => {
    if (!content.trim()) {
      alert('请输入题目内容');
      return;
    }

    // 综合题必须至少有一个子题
    if (type === 'comprehensive' && children.length === 0) {
      alert('综合题至少需要添加一道子题');
      return;
    }

    // 验证子题
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child.content.trim()) {
        alert(`子题 ${i + 1} 的内容不能为空`);
        return;
      }
    }

    const filteredOptions = options.filter(opt => opt.text.trim());
    
    const questionData: Question = {
      id: question?.id || generateId(),
      type,
      content: type === 'comprehensive' ? '' : content,
      caseBackground: type === 'comprehensive' ? content : undefined,
      options: ['single', 'multiple'].includes(type) ? filteredOptions : undefined,
      answer: type === 'fill-blank' ? answer : (Array.isArray(answer) ? answer : answer),
      explanation: explanation || undefined,
      difficulty,
      tags: [],
      bankId: question?.bankId,
      createdAt: question?.createdAt || Date.now(),
      children: type === 'comprehensive' ? children : undefined,
    };

    onSave(questionData);
  };

  const showOptions = ['single', 'multiple'].includes(type);
  const showAnswer = type !== 'comprehensive';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? '添加题目' : '编辑题目'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 题型 */}
          <div className="space-y-2">
            <Label>题型</Label>
            <Select value={type} onValueChange={(v) => setType(v as QuestionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">单选题</SelectItem>
                <SelectItem value="multiple">多选题</SelectItem>
                <SelectItem value="true-false">判断题</SelectItem>
                <SelectItem value="fill-blank">填空题</SelectItem>
                <SelectItem value="comprehensive">综合题</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 案例背景（综合题） */}
          {type === 'comprehensive' && (
            <>
              <div className="space-y-2">
                <Label>案例背景</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="请输入案例背景材料..."
                  rows={4}
                />
              </div>

              {/* 子题列表 */}
              <div className="space-y-3 border rounded-lg p-4 bg-slate-50">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">子题列表 ({children.length})</Label>
                  <Button size="sm" onClick={addChildQuestion}>
                    <Plus className="h-4 w-4 mr-1" />
                    添加子题
                  </Button>
                </div>
                
                {children.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    暂无子题，请点击上方按钮添加
                  </p>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    {children.map((child, index) => (
                      <div key={child.id} className="border rounded-lg p-3 bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">子题 {index + 1}</span>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => removeChildQuestion(index)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {/* 子题题型 */}
                        <div className="mb-2">
                          <Select 
                            value={child.type} 
                            onValueChange={(v) => updateChildQuestion(index, { type: v as QuestionType })}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single">单选题</SelectItem>
                              <SelectItem value="multiple">多选题</SelectItem>
                              <SelectItem value="true-false">判断题</SelectItem>
                              <SelectItem value="fill-blank">填空题</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* 子题内容 */}
                        <Textarea
                          value={child.content}
                          onChange={(e) => updateChildQuestion(index, { content: e.target.value })}
                          placeholder="请输入子题内容..."
                          rows={2}
                          className="mb-2"
                        />
                        
                        {/* 子题选项（单选/多选） */}
                        {['single', 'multiple'].includes(child.type) && (
                          <div className="space-y-1 mb-2">
                            <Label className="text-xs text-slate-500">选项</Label>
                            <div className="grid grid-cols-1 gap-1">
                              {child.options?.map((opt) => (
                                <div key={opt.id} className="flex items-center gap-2">
                                  <span className="w-5 text-xs font-medium">{opt.id}.</span>
                                  <Input
                                    value={opt.text}
                                    onChange={(e) => {
                                      const newOptions = child.options?.map(o => 
                                        o.id === opt.id ? { ...o, text: e.target.value } : o
                                      );
                                      updateChildQuestion(index, { options: newOptions });
                                    }}
                                    placeholder={`选项 ${opt.id.toUpperCase()}`}
                                    className="h-7 text-sm"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* 子题答案 */}
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-slate-500 whitespace-nowrap">答案：</Label>
                          <Input
                            value={typeof child.answer === 'string' ? child.answer : child.answer?.join(', ')}
                            onChange={(e) => updateChildQuestion(index, { 
                              answer: child.type === 'multiple' 
                                ? e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                : e.target.value 
                            })}
                            placeholder={child.type === 'multiple' ? '多个答案用逗号分隔，如: a,b' : '如: a'}
                            className="h-7 text-sm flex-1"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* 题目内容（非综合题） */}
          {type !== 'comprehensive' && (
            <div className="space-y-2">
              <Label>题目内容</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="请输入题目内容..."
                rows={4}
              />
            </div>
          )}

          {/* 选项 */}
          {showOptions && (
            <div className="space-y-2">
              <Label>选项</Label>
              <div className="space-y-2">
                {options.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <span className="w-6 font-medium">{opt.id.toUpperCase()}.</span>
                    <Input
                      value={opt.text}
                      onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                      placeholder={`选项 ${opt.id.toUpperCase()}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 答案 */}
          {showAnswer && (
            <div className="space-y-2">
              <Label>正确答案</Label>
              {type === 'single' || type === 'true-false' ? (
                <Input
                  value={answer as string}
                  onChange={(e) => setAnswer(e.target.value.toLowerCase())}
                  placeholder="如: a"
                  className="max-w-[200px]"
                />
              ) : type === 'multiple' ? (
                <div className="flex flex-wrap gap-2">
                  {options.filter(opt => opt.text.trim()).map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(answer as string[]).includes(opt.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAnswer([...(answer as string[]), opt.id]);
                          } else {
                            setAnswer((answer as string[]).filter(a => a !== opt.id));
                          }
                        }}
                      />
                      <span>{opt.id.toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <Input
                  value={answer as string}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="请输入答案"
                />
              )}
            </div>
          )}

          {/* 解析 */}
          <div className="space-y-2">
            <Label>解析（可选）</Label>
            <Textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="请输入题目解析..."
              rows={3}
            />
          </div>

          {/* 难度 */}
          <div className="space-y-2">
            <Label>难度</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="max-w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">简单</SelectItem>
                <SelectItem value="medium">中等</SelectItem>
                <SelectItem value="hard">困难</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="h-4 w-4 mr-2" />
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
