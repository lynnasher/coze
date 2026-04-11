'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuiz } from '@/hooks/use-quiz';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Play, 
  Library, 
  BarChart3, 
  Upload, 
  ChevronLeft, 
  ChevronRight,
  Check,
  X,
  Trophy,
  Target,
  Brain,
  BookOpen,
  Star,
  RefreshCw,
  Plus,
  Trash2,
  FileText,
  FileCheck
} from 'lucide-react';
import { questionStore, recordStore, bankStore, generateId } from '@/lib/quiz-store';
import { Question, QuestionType, Difficulty, QuestionBank } from '@/lib/types';

export default function QuizApp() {
  const {
    quizState,
    currentQuestion,
    currentAnswer,
    isAnswerCorrect,
    isLoading,
    hasStarted,
    startQuiz,
    selectAnswer,
    nextQuestion,
    prevQuestion,
    submitAnswer,
    finishQuiz,
    goToQuestion,
    restartQuiz,
    getStats,
  } = useQuiz();
  const questionCardRef = useRef<HTMLDivElement>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('practice');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState<Partial<Question>>({
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
  });
  
  // 题库管理状态
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [editingBankName, setEditingBankName] = useState('');
  const [showBankQuestions, setShowBankQuestions] = useState(false);
  
  // 练习模式状态
  const [practiceBankId, setPracticeBankId] = useState<string | null>(null);
  
  // 加载题库
  const banks = useMemo(() => bankStore.getAll(), [questions]);
  
  // 加载题目
  const loadQuestions = useCallback(() => {
    setQuestions(questionStore.getAll());
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // 处理单选答案
  const handleSingleSelect = (value: string) => {
    if (currentQuestion && !quizState.showResult) {
      selectAnswer(currentQuestion.id, value);
    }
  };

  // 处理多选答案
  const handleMultiSelect = (optionId: string, checked: boolean) => {
    if (currentQuestion && !quizState.showResult) {
      const current = (currentAnswer as string[]) || [];
      if (checked) {
        selectAnswer(currentQuestion.id, [...current, optionId]);
      } else {
        selectAnswer(currentQuestion.id, current.filter(id => id !== optionId));
      }
    }
  };

  // 处理判断题答案
  const handleTrueFalseSelect = (value: string) => {
    if (currentQuestion && !quizState.showResult) {
      selectAnswer(currentQuestion.id, value);
    }
  };

  // 处理填空题答案
  const handleFillBlankChange = (value: string) => {
    if (currentQuestion && !quizState.showResult) {
      selectAnswer(currentQuestion.id, value);
    }
  };

  // 文档导入（Word 文档）
  const handleDocumentImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.pdf') && !fileName.endsWith('.docx')) {
      alert('仅支持 PDF 或 DOCX 格式文件');
      e.target.value = '';
      return;
    }
    
    // 从文件名提取题库名称（去掉扩展名）
    const bankName = file.name.replace(/\.(pdf|docx)$/i, '');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bankName', bankName);
      
      const response = await fetch('/api/parse-document', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 将解析的题目保存到 localStorage，并关联题库ID
        if (result.questions && result.questions.length > 0) {
          // 添加题库ID到每道题目（由服务端生成的bankId）
          const questionsWithBankId = result.questions.map((q: Question) => ({
            ...q,
            bankId: result.bankId,
          }));
          questionStore.addMultiple(questionsWithBankId);
          
          // 创建题库
          const bank = bankStore.createWithId(result.bankId, result.bankName || bankName, file.name);
          bank.questionIds = questionsWithBankId.map((q: Question) => q.id);
          bankStore.update(bank);
        }
        loadQuestions();
        setImportModalOpen(false);
        alert(`成功导入题库「${result.bankName || bankName}」\n共 ${result.total} 道题目\n\n题目类型：\n单选题: ${result.typeStats?.single || 0} 道\n多选题: ${result.typeStats?.multiple || 0} 道\n判断题: ${result.typeStats?.['true-false'] || 0} 道\n填空题: ${result.typeStats?.['fill-blank'] || 0} 道`);
      } else {
        alert(result.error || '导入失败');
      }
    } catch (error) {
      console.error('文档导入错误:', error);
      alert('导入失败，请检查文件格式是否正确');
    }
    
    e.target.value = '';
  };

  // PDF 导入
  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/parse-pdf', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success) {
        loadQuestions();
        setImportModalOpen(false);
      } else {
        alert(result.error || '导入失败');
      }
    } catch (error) {
      console.error('导入错误:', error);
      alert('导入失败，请重试');
    }
    
    e.target.value = '';
  };

  // WORK 题库导入
  const handleWorkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/parse-work', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 将解析的题目保存到 localStorage
        if (result.questions && result.questions.length > 0) {
          questionStore.addMultiple(result.questions);
        }
        loadQuestions();
        setImportModalOpen(false);
        alert(`成功导入 ${result.total} 道题目！\n\n题目类型统计：\n单选题: ${result.typeStats?.single || 0} 道\n多选题: ${result.typeStats?.multiple || 0} 道\n判断题: ${result.typeStats?.['true-false'] || 0} 道\n填空题: ${result.typeStats?.['fill-blank'] || 0} 道`);
      } else {
        alert(result.error || '导入失败');
      }
    } catch (error) {
      console.error('WORK 题库导入错误:', error);
      alert('导入失败，请检查文件格式是否正确');
    }
    
    e.target.value = '';
  };

  // 添加题目
  const handleAddQuestion = () => {
    if (!newQuestion.content || !newQuestion.answer) {
      alert('请填写题目内容和答案');
      return;
    }
    
    const question: Question = {
      id: generateId(),
      type: newQuestion.type as QuestionType,
      content: newQuestion.content,
      options: newQuestion.type !== 'fill-blank' ? newQuestion.options : undefined,
      answer: newQuestion.answer,
      difficulty: newQuestion.difficulty as Difficulty,
      tags: newQuestion.tags || [],
      createdAt: Date.now(),
    };
    
    questionStore.add(question);
    loadQuestions();
    setAddQuestionOpen(false);
    setNewQuestion({
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
    });
  };

  // 删除题目
  const handleDeleteQuestion = (id: string) => {
    questionStore.remove(id);
    loadQuestions();
  };
  
  // 删除题库（同时删除题库内的所有题目）
  const handleDeleteBank = (bankId: string) => {
    const bank = bankStore.getById(bankId);
    if (!bank) return;
    
    if (confirm(`确定要删除题库「${bank.name}」吗？\n这将同时删除该题库中的 ${bank.questionIds.length} 道题目。`)) {
      // 删除题库内的所有题目
      bank.questionIds.forEach(qId => {
        questionStore.remove(qId);
      });
      // 删除题库
      bankStore.remove(bankId);
      loadQuestions();
      setSelectedBankId(null);
    }
  };
  
  // 开始编辑题库名称
  const handleStartEditBank = (bank: QuestionBank) => {
    setEditingBankId(bank.id);
    setEditingBankName(bank.name);
  };
  
  // 保存题库名称
  const handleSaveBankName = () => {
    if (editingBankId && editingBankName.trim()) {
      bankStore.rename(editingBankId, editingBankName.trim());
      setEditingBankId(null);
      setEditingBankName('');
    }
  };
  
  // 查看题库内的题目
  const handleViewBankQuestions = (bankId: string) => {
    setSelectedBankId(bankId);
    setShowBankQuestions(true);
  };
  
  // 清空所有题库和题目
  const handleClearAll = () => {
    if (confirm('确定要清空所有题库和题目吗？\n此操作不可恢复！')) {
      questionStore.clear();
      bankStore.clear();
      recordStore.clear();
      loadQuestions();
      setSelectedBankId(null);
      setShowBankQuestions(false);
      alert('已清空所有题库和题目');
    }
  };

  // 渲染选项
  const renderOptions = () => {
    if (!currentQuestion) return null;
    
    if (currentQuestion.type === 'fill-blank') {
      return (
        <div className="space-y-2">
          <Textarea
            placeholder="请输入你的答案..."
            value={(currentAnswer as string) || ''}
            onChange={(e) => handleFillBlankChange(e.target.value)}
            disabled={quizState.showResult}
            className="min-h-[100px] border-gray-200 focus:border-blue-300"
          />
        </div>
      );
    }
    
    // 选项样式配置
    const getOptionStyle = (isSelected: boolean, isCorrectAnswer: boolean, showResult: boolean) => {
      if (showResult) {
        if (isSelected && isCorrectAnswer) {
          return 'border-emerald-400 bg-emerald-50 shadow-sm';
        }
        if (isSelected && !isCorrectAnswer) {
          return 'border-rose-400 bg-rose-50 shadow-sm';
        }
        if (isCorrectAnswer) {
          return 'border-emerald-400 bg-emerald-50/50';
        }
      }
      if (isSelected) {
        return 'border-blue-400 bg-blue-50 shadow-sm';
      }
      return 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50';
    };
    
    if (currentQuestion.type === 'true-false') {
      // 判断题：如果没有选项，默认提供"正确/错误"选项
      const defaultOptions = currentQuestion.options?.length === 2 
        ? currentQuestion.options 
        : [
            { id: 'a', text: '正确' },
            { id: 'b', text: '错误' }
          ];
      
      return (
        <div className="space-y-2 sm:space-y-3">
          {defaultOptions.map((option, index) => {
            const isCorrectAnswer = currentQuestion.answer === option.id;
            const isSelected = currentAnswer === option.id;
            
            return (
              <div
                key={`tf-${index}-${option.id}`}
                className={`flex items-center p-3 sm:p-4 rounded-xl border-2 transition-all cursor-pointer ${getOptionStyle(isSelected, isCorrectAnswer, quizState.showResult)}`}
                onClick={() => !quizState.showResult && handleTrueFalseSelect(option.id)}
              >
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mr-3 sm:mr-4 font-semibold text-sm ${
                  isSelected 
                    ? quizState.showResult 
                      ? isCorrectAnswer 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-rose-500 text-white'
                      : 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {option.id.toUpperCase()}
                </div>
                <span className="flex-1 text-sm sm:text-base font-medium">{option.text}</span>
                {quizState.showResult && isCorrectAnswer && (
                  <Check className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
                )}
                {quizState.showResult && isSelected && !isCorrectAnswer && (
                  <X className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500" />
                )}
              </div>
            );
          })}
        </div>
      );
    }
    
    if (currentQuestion.type === 'multiple') {
      return (
        <div className="space-y-2 sm:space-y-3">
          {currentQuestion.options?.map((option, index) => {
            const correctAnswers = Array.isArray(currentQuestion.answer) 
              ? currentQuestion.answer 
              : [currentQuestion.answer];
            const isCorrectAnswer = correctAnswers.includes(option.id);
            const isSelected = Array.isArray(currentAnswer) && currentAnswer.includes(option.id);
            
            return (
              <div
                key={`multi-${index}-${option.id}`}
                className={`flex items-center p-3 sm:p-4 rounded-xl border-2 transition-all cursor-pointer ${getOptionStyle(isSelected, isCorrectAnswer, quizState.showResult)}`}
                onClick={() => !quizState.showResult && handleMultiSelect(option.id, !isSelected)}
              >
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mr-3 sm:mr-4 font-semibold text-sm ${
                  isSelected 
                    ? quizState.showResult 
                      ? isCorrectAnswer 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-rose-500 text-white'
                      : 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {option.id.toUpperCase()}
                </div>
                <span className="flex-1 text-sm sm:text-base font-medium">{option.text}</span>
                {quizState.showResult && isCorrectAnswer && (
                  <Check className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
                )}
                {quizState.showResult && isSelected && !isCorrectAnswer && (
                  <X className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500" />
                )}
              </div>
            );
          })}
          <p className="text-xs sm:text-sm text-gray-400 mt-2">* 此题为多选题，可选择多个答案</p>
        </div>
      );
    }
    
    // 单选题
    return (
      <div className="space-y-2 sm:space-y-3">
        {currentQuestion.options?.map((option, index) => {
          const isCorrectAnswer = currentQuestion.answer === option.id;
          const isSelected = currentAnswer === option.id;
          
          return (
            <div
              key={`single-${index}-${option.id}`}
              className={`flex items-center p-3 sm:p-4 rounded-xl border-2 transition-all cursor-pointer ${getOptionStyle(isSelected, isCorrectAnswer, quizState.showResult)}`}
              onClick={() => !quizState.showResult && handleSingleSelect(option.id)}
            >
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mr-3 sm:mr-4 font-semibold text-sm ${
                isSelected 
                  ? quizState.showResult 
                    ? isCorrectAnswer 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-rose-500 text-white'
                    : 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {option.id.toUpperCase()}
              </div>
              <span className="flex-1 text-sm sm:text-base font-medium">{option.text}</span>
              {quizState.showResult && isCorrectAnswer && (
                <Check className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
              )}
              {quizState.showResult && isSelected && !isCorrectAnswer && (
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // 渲染题目类型标签
  const renderTypeBadge = (type: QuestionType) => {
    const config: Record<QuestionType, { label: string; color: string }> = {
      single: { label: '单选', color: 'bg-blue-100 text-blue-700 text-xs' },
      multiple: { label: '多选', color: 'bg-purple-100 text-purple-700 text-xs' },
      'true-false': { label: '判断', color: 'bg-orange-100 text-orange-700 text-xs' },
      'fill-blank': { label: '填空', color: 'bg-green-100 text-green-700 text-xs' },
    };
    return (
      <Badge className={`${config[type].color} px-1.5 py-0.5 sm:px-2 sm:py-0.5`}>{config[type].label}</Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Brain className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-gray-900">智能刷题助手</h1>
              <p className="text-[10px] sm:text-xs text-gray-500">{questions.length} 道题目</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">导入题库</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-w-[calc(100%-16px)]">
                <DialogHeader>
                  <DialogTitle className="text-lg sm:text-xl">导入题库</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="text-center py-6 sm:py-8">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
                    </div>
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">导入 Word 文档</h3>
                    <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">选择 .docx 格式的 Word 文档，系统将自动提取题目</p>
                    <Input
                      type="file"
                      accept=".docx"
                      onChange={handleDocumentImport}
                      className="max-w-xs mx-auto text-sm"
                    />
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-2 text-sm">文档格式要求</h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>题目编号格式：<code className="bg-gray-200 px-1 rounded">1. 题目内容</code></li>
                      <li>选项格式：<code className="bg-gray-200 px-1 rounded">A. 选项内容</code></li>
                      <li>答案格式：<code className="bg-gray-200 px-1 rounded">正确答案：B</code></li>
                      <li>解析格式：<code className="bg-gray-200 px-1 rounded">名师解析：...</code></li>
                    </ul>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-[320px] sm:max-w-md grid-cols-3">
            <TabsTrigger value="practice" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Play className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>练习</span>
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Library className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>题库</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>统计</span>
            </TabsTrigger>
          </TabsList>

          {/* 练习页面 */}
          <TabsContent value="practice">
            {!quizState.isComplete && quizState.questions.length > 0 && hasStarted ? (
              <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 pb-28 sm:pb-6">
                {/* 进度条 - 移动端固定在顶部 */}
                <Card className="border-0 shadow-sm bg-white/80 backdrop-blur sticky top-16 z-10">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-sm font-medium text-gray-700">
                          {quizState.currentIndex + 1} / {quizState.questions.length}
                        </span>
                        {currentQuestion && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                            {currentQuestion.type === 'single' ? '单选' : 
                             currentQuestion.type === 'multiple' ? '多选' : 
                             currentQuestion.type === 'true-false' ? '判断' : '填空'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-blue-600">
                          {Math.round(((quizState.currentIndex + 1) / quizState.questions.length) * 100)}%
                        </span>
                        {/* 提交试卷按钮 */}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            // 计算已答题目数量
                            const answeredCount = Object.keys(quizState.answers).length;
                            if (answeredCount === 0) {
                              alert('请先作答至少一道题目');
                              return;
                            }
                            // 直接提交并显示结果
                            if (confirm(`已回答 ${answeredCount} 道题目，确定要提交试卷吗？`)) {
                              finishQuiz();
                            }
                          }}
                          className="text-xs h-7 px-2 border-orange-300 text-orange-600 hover:bg-orange-50"
                        >
                          <FileCheck className="w-3 h-3 mr-1" />
                          提交试卷
                        </Button>
                      </div>
                    </div>
                    <Progress 
                      value={((quizState.currentIndex + 1) / quizState.questions.length) * 100} 
                      className="h-1.5 bg-gray-100"
                    />
                  </CardContent>
                </Card>

                {/* 题目卡片 */}
                {currentQuestion && (
                  <Card ref={questionCardRef} className="border border-gray-200 shadow-sm" tabIndex={-1}>
                    <CardContent className="p-4 sm:p-6 lg:p-8">
                      <div className="flex items-start gap-2 mb-4 sm:mb-6">
                        <span className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm sm:text-base font-semibold">
                          {quizState.currentIndex + 1}
                        </span>
                        <p className="text-base sm:text-xl font-medium text-gray-900 leading-relaxed flex-1">
                          {currentQuestion.content}
                        </p>
                      </div>
                      
                      <div className="space-y-2 sm:space-y-3 ml-0 sm:ml-10">
                        {renderOptions()}
                      </div>
                      
                      {/* 答案反馈 */}
                      {quizState.showResult && (
                        <div className={`mt-4 sm:mt-6 p-3 sm:p-4 rounded-xl ${
                          isAnswerCorrect 
                            ? 'bg-emerald-50 border border-emerald-200' 
                            : 'bg-rose-50 border border-rose-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-1 sm:mb-2">
                            {isAnswerCorrect ? (
                              <>
                                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                                <span className="font-semibold text-emerald-700 text-sm sm:text-base">回答正确</span>
                              </>
                            ) : (
                              <>
                                <X className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
                                <span className="font-semibold text-rose-700 text-sm sm:text-base">回答错误</span>
                              </>
                            )}
                          </div>
                          {!isAnswerCorrect && (
                            <p className="text-xs sm:text-sm text-rose-600 pl-6 sm:pl-7">
                              正确答案：
                              <span className="font-semibold ml-1">
                                {Array.isArray(currentQuestion.answer) 
                                  ? currentQuestion.answer.map(a => a.toUpperCase()).join(', ')
                                  : currentQuestion.answer.toUpperCase()}
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* 解析 */}
                      {quizState.showResult && currentQuestion.explanation && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 mt-4">
                          <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2 text-sm sm:text-base">
                            <BookOpen className="w-4 h-4" />
                            题目解析
                          </h4>
                          <p className="text-amber-700 text-xs sm:text-sm leading-relaxed">{currentQuestion.explanation}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* 操作按钮 - 移动端固定底部 */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 sm:relative sm:bg-transparent sm:border-0 sm:p-0">
                  <div className="flex items-center justify-between gap-2">
                    {/* 左侧：上一题 */}
                    <Button
                      variant="ghost"
                      onClick={prevQuestion}
                      disabled={quizState.currentIndex === 0}
                      className="gap-1 text-gray-600 hover:text-gray-900 px-2 min-w-[60px]"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">上一题</span>
                    </Button>
                    
                    {/* 中间：答案与解析按钮 */}
                    <Button
                      variant="outline"
                      onClick={submitAnswer}
                      disabled={!currentAnswer}
                      className="flex-1 max-w-[160px] sm:max-w-[200px] text-sm h-9 shadow-sm border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                    >
                      {quizState.showResult ? (
                        <>
                          <BookOpen className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">查看解析</span>
                          <span className="sm:hidden">解析</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          提交答案
                        </>
                      )}
                    </Button>
                    
                    {/* 右侧：下一题 */}
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (quizState.showResult) {
                          nextQuestion();
                          setTimeout(() => {
                            questionCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            questionCardRef.current?.focus();
                          }, 50);
                        } else {
                          submitAnswer();
                        }
                      }}
                      className="gap-1 text-gray-600 hover:text-gray-900 px-2 min-w-[60px]"
                    >
                      <span className="hidden sm:inline">
                        {quizState.showResult 
                          ? (quizState.currentIndex === quizState.questions.length - 1 ? '完成' : '下一题')
                          : '提交'}
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* 题目导航 */}
                <Card className="border border-gray-200 shadow-sm hidden sm:block">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-gray-500 mb-3">题目导航</p>
                    <div className="flex flex-wrap gap-2">
                      {quizState.questions.map((q, idx) => {
                        const answered = !!quizState.answers[q.id];
                        const isCurrent = idx === quizState.currentIndex;
                        const record = recordStore.getByQuestionId(q.id);
                        const isWrong = record.length > 0 && !record[record.length - 1].isCorrect;
                        
                        return (
                          <button
                            key={q.id}
                            onClick={() => goToQuestion(idx)}
                            className={`w-9 h-9 rounded-lg font-medium text-sm transition-all ${
                              isCurrent
                                ? 'bg-blue-500 text-white shadow-md'
                                : answered
                                  ? isWrong
                                    ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200"></div>
                        <span className="text-gray-500">未答</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></div>
                        <span className="text-gray-500">正确</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-rose-100 border border-rose-200"></div>
                        <span className="text-gray-500">错误</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-blue-500"></div>
                        <span className="text-gray-500">当前</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : quizState.isComplete ? (
              /* 完成页面 */
              <Card className="shadow-lg max-w-2xl mx-auto">
                <CardContent className="pt-8 pb-8 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Trophy className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">练习完成！</h2>
                  <p className="text-gray-600 mb-6">你已完成所有题目</p>
                  
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{quizState.questions.length}</p>
                      <p className="text-sm text-gray-500">总题数</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {Object.values(quizState.answers).filter((_, idx) => {
                          const q = quizState.questions[idx];
                          const ans = quizState.answers[q.id];
                          if (Array.isArray(q.answer)) {
                            return Array.isArray(ans) && q.answer.every(a => ans.includes(a));
                          }
                          return ans === q.answer;
                        }).length}
                      </p>
                      <p className="text-sm text-gray-500">正确</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">
                        {Math.round(
                          (Object.values(quizState.answers).filter((_, idx) => {
                            const q = quizState.questions[idx];
                            const ans = quizState.answers[q.id];
                            if (Array.isArray(q.answer)) {
                              return Array.isArray(ans) && q.answer.every(a => ans.includes(a));
                            }
                            return ans === q.answer;
                          }).length / quizState.questions.length) * 100
                        )}%
                      </p>
                      <p className="text-sm text-gray-500">正确率</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 justify-center">
                    <Button onClick={restartQuiz} className="gap-2">
                      <RefreshCw className="w-4 h-4" />
                      再练一次
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab('stats')}>
                      查看统计
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : questions.length > 0 ? (
              /* 未开始练习 - 显示选择模式 */
              <div className="max-w-2xl mx-auto space-y-6">
                {/* 题库选择 */}
                {banks.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Library className="w-4 h-4" />
                        选择题库
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={practiceBankId === null ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPracticeBankId(null)}
                        >
                          全部题目 ({questions.length})
                        </Button>
                        {banks.map((bank) => {
                          const bankQuestions = questions.filter(q => q.bankId === bank.id);
                          return (
                            <Button
                              key={bank.id}
                              variant={practiceBankId === bank.id ? "default" : "outline"}
                              size="sm"
                              onClick={() => setPracticeBankId(bank.id)}
                              disabled={bankQuestions.length === 0}
                            >
                              {bank.name} ({bankQuestions.length})
                            </Button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* 练习模式选择 */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-500" />
                      选择练习模式
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-center text-gray-600">
                      共 <strong>{practiceBankId ? questions.filter(q => q.bankId === practiceBankId).length : questions.length}</strong> 道题目
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                      <Button
                        variant="outline"
                        className="h-auto py-4 sm:py-6 flex-col gap-1.5 sm:gap-2"
                        onClick={() => startQuiz('sequential', practiceBankId)}
                      >
                        <Target className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                        <span className="text-xs sm:text-sm">顺序练习</span>
                        <span className="text-[10px] sm:text-xs text-gray-500 hidden sm:inline">按题目顺序</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto py-4 sm:py-6 flex-col gap-1.5 sm:gap-2"
                        onClick={() => startQuiz('random', practiceBankId)}
                      >
                        <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
                        <span className="text-xs sm:text-sm">随机练习</span>
                        <span className="text-[10px] sm:text-xs text-gray-500 hidden sm:inline">打乱题目顺序</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto py-4 sm:py-6 flex-col gap-1.5 sm:gap-2"
                        onClick={() => startQuiz('wrong', practiceBankId)}
                      >
                        <Star className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
                        <span className="text-xs sm:text-sm">错题重练</span>
                        <span className="text-[10px] sm:text-xs text-gray-500 hidden sm:inline">专攻错题</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* 题库为空 */
              <Card className="shadow-lg max-w-2xl mx-auto">
                <CardContent className="pt-12 pb-12 text-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <BookOpen className="w-10 h-10 text-gray-400" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">题库为空</h2>
                  <p className="text-gray-600 mb-6">请先导入题目或添加新题目</p>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={() => setImportModalOpen(true)} className="gap-2">
                      <Upload className="w-4 h-4" />
                      导入题库
                    </Button>
                    <Button variant="outline" onClick={() => setAddQuestionOpen(true)} className="gap-2">
                      <Plus className="w-4 h-4" />
                      添加题目
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 题库页面 */}
          <TabsContent value="library">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold">题库管理</h2>
                {banks.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleClearAll}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    清空全部
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setImportModalOpen(true)} className="gap-2">
                  <Upload className="w-4 h-4" />
                  导入题库
                </Button>
                <Dialog open={addQuestionOpen} onOpenChange={setAddQuestionOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Plus className="w-4 h-4" />
                      添加题目
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>添加新题目</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>题目类型</Label>
                        <Select
                          value={newQuestion.type}
                          onValueChange={(v) => setNewQuestion({ ...newQuestion, type: v as QuestionType })}
                        >
                          <SelectTrigger>
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
                      
                      <div>
                        <Label>题目内容</Label>
                        <Textarea
                          value={newQuestion.content}
                          onChange={(e) => setNewQuestion({ ...newQuestion, content: e.target.value })}
                          placeholder="请输入题目内容..."
                          className="mt-1"
                        />
                      </div>
                      
                      {newQuestion.type !== 'fill-blank' && (
                        <div className="space-y-2">
                          <Label>选项</Label>
                          {newQuestion.options?.map((opt, idx) => (
                            <div key={`new-opt-${idx}-${opt.id}`} className="flex gap-2">
                              <span className="w-6 py-2 text-gray-500">{opt.id.toUpperCase()}.</span>
                              <Input
                                value={opt.text}
                                onChange={(e) => {
                                  const opts = [...(newQuestion.options || [])];
                                  opts[idx] = { ...opts[idx], text: e.target.value };
                                  setNewQuestion({ ...newQuestion, options: opts });
                                }}
                                placeholder={`选项 ${opt.id.toUpperCase()}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div>
                        <Label>正确答案</Label>
                        {newQuestion.type === 'fill-blank' ? (
                          <Input
                            value={newQuestion.answer as string}
                            onChange={(e) => setNewQuestion({ ...newQuestion, answer: e.target.value })}
                            placeholder="输入正确答案"
                            className="mt-1"
                          />
                        ) : newQuestion.type === 'multiple' ? (
                          <div className="flex gap-4 mt-2">
                            {['a', 'b', 'c', 'd'].map((opt) => (
                              <label key={opt} className="flex items-center gap-2">
                                <Checkbox
                                  checked={(newQuestion.answer as string[])?.includes(opt)}
                                  onCheckedChange={(checked) => {
                                    const current = (newQuestion.answer as string[]) || [];
                                    if (checked) {
                                      setNewQuestion({ ...newQuestion, answer: [...current, opt] });
                                    } else {
                                      setNewQuestion({ ...newQuestion, answer: current.filter(a => a !== opt) });
                                    }
                                  }}
                                />
                                <span>{opt.toUpperCase()}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <Select
                            value={newQuestion.answer as string}
                            onValueChange={(v) => setNewQuestion({ ...newQuestion, answer: v })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="选择正确答案" />
                            </SelectTrigger>
                            <SelectContent>
                              {newQuestion.options?.map((opt, idx) => (
                                <SelectItem key={`select-opt-${idx}-${opt.id}`} value={opt.id}>
                                  {opt.id.toUpperCase()}. {opt.text}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      
                      <div>
                        <Label>难度</Label>
                        <Select
                          value={newQuestion.difficulty}
                          onValueChange={(v) => setNewQuestion({ ...newQuestion, difficulty: v as Difficulty })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">简单</SelectItem>
                            <SelectItem value="medium">中等</SelectItem>
                            <SelectItem value="hard">困难</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <Button onClick={handleAddQuestion} className="w-full">
                        保存题目
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* 题库列表 */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Library className="w-5 h-5" />
                题库列表 ({banks.length})
              </h3>
              {banks.length === 0 ? (
                <Card className="bg-gray-50 border-dashed">
                  <CardContent className="py-8 text-center">
                    <Library className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 mb-4">暂无题库，请导入文档创建题库</p>
                    <Button onClick={() => setImportModalOpen(true)} className="gap-2">
                      <Upload className="w-4 h-4" />
                      导入题库
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {banks.map((bank) => (
                    <Card key={bank.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            {editingBankId === bank.id ? (
                              <div className="flex gap-2">
                                <Input
                                  value={editingBankName}
                                  onChange={(e) => setEditingBankName(e.target.value)}
                                  className="h-8"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveBankName();
                                    if (e.key === 'Escape') setEditingBankId(null);
                                  }}
                                />
                                <Button size="sm" onClick={handleSaveBankName}>保存</Button>
                              </div>
                            ) : (
                              <h4 
                                className="font-semibold text-gray-900 truncate cursor-pointer hover:text-blue-600"
                                onClick={() => handleViewBankQuestions(bank.id)}
                              >
                                {bank.name}
                              </h4>
                            )}
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleStartEditBank(bank)}
                            >
                              <FileText className="w-4 h-4 text-gray-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleDeleteBank(bank.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">{bank.questionIds.length} 道题目</span>
                          <span className="text-gray-400 text-xs">
                            {new Date(bank.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2 mt-3">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleViewBankQuestions(bank.id)}
                            >
                              查看题目
                            </Button>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="default"
                              size="sm"
                              className="flex-1 text-xs h-8 bg-blue-500 hover:bg-blue-600"
                              onClick={() => {
                                setPracticeBankId(bank.id);
                                setActiveTab('practice');
                                setTimeout(() => startQuiz('sequential', bank.id), 100);
                              }}
                              disabled={bank.questionIds.length === 0}
                            >
                              <Target className="w-3 h-3 mr-1" />
                              顺序
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              className="flex-1 text-xs h-8 bg-purple-500 hover:bg-purple-600"
                              onClick={() => {
                                setPracticeBankId(bank.id);
                                setActiveTab('practice');
                                setTimeout(() => startQuiz('random', bank.id), 100);
                              }}
                              disabled={bank.questionIds.length === 0}
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              随机
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              className="flex-1 text-xs h-8 bg-orange-500 hover:bg-orange-600"
                              onClick={() => {
                                setPracticeBankId(bank.id);
                                setActiveTab('practice');
                                setTimeout(() => startQuiz('wrong', bank.id), 100);
                              }}
                              disabled={bank.questionIds.length === 0}
                            >
                              <Star className="w-3 h-3 mr-1" />
                              错题
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* 题库内题目列表 */}
            {showBankQuestions && selectedBankId && (
              <div className="border-t pt-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    题库题目 ({questions.filter(q => q.bankId === selectedBankId).length})
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => setShowBankQuestions(false)}>
                    关闭
                  </Button>
                </div>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y max-h-[500px] overflow-y-auto">
                      {questions
                        .filter(q => q.bankId === selectedBankId)
                        .map((q, idx) => (
                          <div key={q.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm font-medium text-gray-500">#{idx + 1}</span>
                                  {renderTypeBadge(q.type)}
                                </div>
                                <p className="font-medium text-gray-900 mb-2">{q.content}</p>
                                {q.options && (
                                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                                    {q.options.map((opt, optIdx) => (
                                      <div key={`opt-${optIdx}-${opt.id}`} className="flex items-center gap-1">
                                        <span className="font-medium">{opt.id.toUpperCase()}.</span>
                                        <span>{opt.text}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-2 text-sm">
                                  <span className="text-gray-500">正确答案：</span>
                                  <span className="font-medium text-green-600">
                                    {Array.isArray(q.answer) ? q.answer.map(a => a.toUpperCase()).join(', ') : q.answer.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                    {questions.filter(q => q.bankId === selectedBankId).length === 0 && (
                      <div className="p-12 text-center">
                        <p className="text-gray-500">该题库暂无题目</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 所有题目列表 */}
            {!showBankQuestions && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  所有题目 ({questions.length})
                </h3>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y max-h-[500px] overflow-y-auto">
                      {questions.map((q, idx) => (
                        <div key={q.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-gray-500">#{idx + 1}</span>
                                {renderTypeBadge(q.type)}
                                {q.bankId && banks.find(b => b.id === q.bankId) && (
                                  <Badge variant="secondary" className="text-xs">
                                    {banks.find(b => b.id === q.bankId)?.name}
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium text-gray-900 mb-2">{q.content}</p>
                              {q.options && (
                                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                                  {q.options.map((opt, optIdx) => (
                                    <div key={`q-opt-${optIdx}-${opt.id}`} className="flex items-center gap-1">
                                      <span className="font-medium">{opt.id.toUpperCase()}.</span>
                                      <span>{opt.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="mt-2 text-sm">
                                <span className="text-gray-500">正确答案：</span>
                                <span className="font-medium text-green-600">
                                  {Array.isArray(q.answer) ? q.answer.map(a => a.toUpperCase()).join(', ') : q.answer.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {questions.length === 0 && (
                      <div className="p-12 text-center">
                        <p className="text-gray-500">暂无题目，请先导入或添加题目</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* 统计页面 */}
          <TabsContent value="stats">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
              <Card>
                <CardContent className="p-3 sm:pt-6">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold text-gray-900">{getStats().totalCount}</p>
                      <p className="text-xs sm:text-sm text-gray-500">总练习</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-3 sm:pt-6">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 sm:w-6 sm:h-6 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold text-gray-900">{getStats().correctCount}</p>
                      <p className="text-xs sm:text-sm text-gray-500">正确</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-3 sm:pt-6">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <X className="w-4 h-4 sm:w-6 sm:h-6 text-red-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold text-gray-900">{getStats().wrongCount}</p>
                      <p className="text-xs sm:text-sm text-gray-500">错误</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-3 sm:pt-6">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Target className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold text-gray-900">{getStats().accuracy}%</p>
                      <p className="text-xs sm:text-sm text-gray-500">正确率</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-base sm:text-lg">正确率趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] sm:h-[300px] flex items-center justify-center text-gray-400">
                  <div className="text-center px-4">
                    <BarChart3 className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-50" />
                    <p className="text-sm sm:text-base">练习数据将在你开始刷题后显示</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 错题本 */}
            {getStats().wrongQuestionIds.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-orange-500" />
                    错题本 ({getStats().wrongQuestionIds.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {getStats().wrongQuestionIds.map((id, idx) => {
                      const q = questions.find(q => q.id === id);
                      if (!q) return null;
                      return (
                        <Badge
                          key={id}
                          variant="outline"
                          className="px-3 py-1 cursor-pointer hover:bg-orange-50"
                          onClick={() => {
                            startQuiz('wrong');
                            setActiveTab('practice');
                          }}
                        >
                          {idx + 1}. {q.content.slice(0, 20)}...
                        </Badge>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      startQuiz('wrong');
                      setActiveTab('practice');
                    }}
                  >
                    重新练习错题
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
