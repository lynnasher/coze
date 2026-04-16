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
      const payload = JSON.parse(atob(token));
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
      // 从数据库加载题库
      const bankResponse = await fetch('/api/admin/banks');
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
      const questionsResponse = await fetch(`/api/admin/banks/${bankId}/questions`);
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
        q.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.caseBackground?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.explanation?.toLowerCase().includes(searchTerm.toLowerCase())
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
      const response = await fetch(`/api/admin/questions/${question.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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

      await loadData();
    } catch (error) {
      console.error('保存题目失败:', error);
      setError('保存题目失败，请重试');
    }
  };

  // 添加题目
  const addQuestion = async (question: Question) => {
    try {
      const newQuestion = { ...question, id: generateId(), bankId, createdAt: Date.now() };
      
      const response = await fetch(`/api/admin/banks/${bankId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: newQuestion }),
      });

      if (!response.ok) {
        throw new Error('添加失败');
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
      const response = await fetch(`/api/admin/questions/${questionToDelete.id}`, {
        method: 'DELETE',
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
    setEditingQuestion({ ...question });
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

  // 初始化数据
  useEffect(() => {
    if (question) {
      setType(question.type);
      setContent(question.content || '');
      setOptions(question.options || [
        { id: 'a', text: '' },
        { id: 'b', text: '' },
        { id: 'c', text: '' },
        { id: 'd', text: '' },
      ]);
      setAnswer(question.answer || 'a');
      setExplanation(question.explanation || '');
      setDifficulty(question.difficulty || 'medium');
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
    }
  }, [question, open]);

  // 处理选项变更
  const handleOptionChange = (id: string, text: string) => {
    setOptions(prev => prev.map(opt => opt.id === id ? { ...opt, text } : opt));
  };

  // 提交
  const handleSubmit = () => {
    if (!content.trim()) {
      alert('请输入题目内容');
      return;
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

          {/* 题目内容 */}
          <div className="space-y-2">
            <Label>{type === 'comprehensive' ? '案例背景' : '题目内容'}</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={type === 'comprehensive' ? '请输入案例背景材料...' : '请输入题目内容...'}
              rows={4}
            />
          </div>

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
