'use client';

import { useState, useCallback } from 'react';
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
  FileText
} from 'lucide-react';
import { questionStore, recordStore, generateId } from '@/lib/quiz-store';
import { Question, QuestionType, Difficulty } from '@/lib/types';
import { useEffect } from 'react';

export default function QuizApp() {
  const {
    quizState,
    currentQuestion,
    currentAnswer,
    isAnswerCorrect,
    isLoading,
    startQuiz,
    selectAnswer,
    nextQuestion,
    prevQuestion,
    submitAnswer,
    goToQuestion,
    restartQuiz,
    getStats,
  } = useQuiz();
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
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

  // 从文本导入
  const handleTextImport = () => {
    if (!importText.trim()) return;
    
    const lines = importText.split('\n').filter(l => l.trim());
    const newQuestions: Question[] = [];
    
    let currentContent = '';
    let currentOptions: { id: string; text: string }[] = [];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // 检测是否为新题目
      if (/^\d+[.、)]/.test(trimmed) && currentContent) {
        // 保存上一题
        if (currentOptions.length > 0) {
          newQuestions.push({
            id: generateId(),
            type: 'single',
            content: currentContent.replace(/^\d+[.、)]\s*/, ''),
            options: currentOptions,
            answer: 'a',
            difficulty: 'medium',
            tags: [],
            createdAt: Date.now(),
          });
        }
        currentContent = trimmed;
        currentOptions = [];
      } else if (/^[A-D][.、)]/.test(trimmed)) {
        const match = trimmed.match(/^([A-D])[.、)]\s*(.+)/i);
        if (match) {
          currentOptions.push({
            id: match[1].toLowerCase(),
            text: match[2].trim(),
          });
        }
      } else if (currentContent && !/^[A-D]/.test(trimmed)) {
        currentContent += ' ' + trimmed;
      } else if (!currentContent) {
        currentContent = trimmed;
      }
    });
    
    // 保存最后一题
    if (currentContent && currentOptions.length > 0) {
      newQuestions.push({
        id: generateId(),
        type: 'single',
        content: currentContent.replace(/^\d+[.、)]\s*/, ''),
        options: currentOptions,
        answer: 'a',
        difficulty: 'medium',
        tags: [],
        createdAt: Date.now(),
      });
    }
    
    if (newQuestions.length > 0) {
      questionStore.addMultiple(newQuestions);
      loadQuestions();
      setImportText('');
      setImportModalOpen(false);
    }
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

  // WORK 文本导入
  const handleWorkTextImport = () => {
    if (!importText.trim()) return;
    
    fetch('/api/parse-work', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: importText }),
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          loadQuestions();
          setImportText('');
          setImportModalOpen(false);
          alert(`成功导入 ${result.total} 道题目！`);
        } else {
          alert(result.error || '导入失败');
        }
      })
      .catch(err => {
        console.error('WORK 文本导入错误:', err);
        alert('导入失败，请检查格式是否正确');
      });
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
            className="min-h-[100px]"
          />
        </div>
      );
    }
    
    if (currentQuestion.type === 'true-false') {
      return (
        <RadioGroup
          value={(currentAnswer as string) || ''}
          onValueChange={handleTrueFalseSelect}
          disabled={quizState.showResult}
          className="space-y-3"
        >
          {currentQuestion.options?.map((option) => {
            const isCorrectAnswer = currentQuestion.answer === option.id;
            const isSelected = currentAnswer === option.id;
            
            return (
              <div
                key={option.id}
                className={`flex items-center p-4 rounded-lg border transition-all cursor-pointer ${
                  isSelected 
                    ? quizState.showResult 
                      ? isCorrectAnswer 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-red-500 bg-red-50'
                      : 'border-blue-500 bg-blue-50'
                    : quizState.showResult && isCorrectAnswer
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleTrueFalseSelect(option.id)}
              >
                <RadioGroupItem value={option.id} id={option.id} className="mr-3" />
                <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                  {option.text}
                </Label>
                {quizState.showResult && isCorrectAnswer && (
                  <Check className="w-5 h-5 text-green-500" />
                )}
                {quizState.showResult && isSelected && !isCorrectAnswer && (
                  <X className="w-5 h-5 text-red-500" />
                )}
              </div>
            );
          })}
        </RadioGroup>
      );
    }
    
    if (currentQuestion.type === 'multiple') {
      return (
        <div className="space-y-3">
          {currentQuestion.options?.map((option) => {
            const correctAnswers = Array.isArray(currentQuestion.answer) 
              ? currentQuestion.answer 
              : [currentQuestion.answer];
            const isCorrectAnswer = correctAnswers.includes(option.id);
            const isSelected = Array.isArray(currentAnswer) && currentAnswer.includes(option.id);
            
            return (
              <div
                key={option.id}
                className={`flex items-center p-4 rounded-lg border transition-all cursor-pointer ${
                  isSelected 
                    ? quizState.showResult 
                      ? isCorrectAnswer 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-red-500 bg-red-50'
                      : 'border-blue-500 bg-blue-50'
                    : quizState.showResult && isCorrectAnswer
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleMultiSelect(option.id, !isSelected)}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => handleMultiSelect(option.id, !!checked)}
                  disabled={quizState.showResult}
                  className="mr-3"
                />
                <span className="flex-1">{option.text}</span>
                {quizState.showResult && isCorrectAnswer && (
                  <Check className="w-5 h-5 text-green-500" />
                )}
                {quizState.showResult && isSelected && !isCorrectAnswer && (
                  <X className="w-5 h-5 text-red-500" />
                )}
              </div>
            );
          })}
          <p className="text-sm text-gray-500">* 此题为多选题</p>
        </div>
      );
    }
    
    // 单选题
    return (
      <RadioGroup
        value={(currentAnswer as string) || ''}
        onValueChange={handleSingleSelect}
        disabled={quizState.showResult}
        className="space-y-3"
      >
        {currentQuestion.options?.map((option) => {
          const isCorrectAnswer = currentQuestion.answer === option.id;
          const isSelected = currentAnswer === option.id;
          
          return (
            <div
              key={option.id}
              className={`flex items-center p-4 rounded-lg border transition-all cursor-pointer ${
                isSelected 
                  ? quizState.showResult 
                    ? isCorrectAnswer 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-red-500 bg-red-50'
                    : 'border-blue-500 bg-blue-50'
                  : quizState.showResult && isCorrectAnswer
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleSingleSelect(option.id)}
            >
              <RadioGroupItem value={option.id} id={option.id} className="mr-3" />
              <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                {option.text}
              </Label>
              {quizState.showResult && isCorrectAnswer && (
                <Check className="w-5 h-5 text-green-500" />
              )}
              {quizState.showResult && isSelected && !isCorrectAnswer && (
                <X className="w-5 h-5 text-red-500" />
              )}
            </div>
          );
        })}
      </RadioGroup>
    );
  };

  // 渲染题目类型标签
  const renderTypeBadge = (type: QuestionType) => {
    const config: Record<QuestionType, { label: string; color: string }> = {
      single: { label: '单选', color: 'bg-blue-100 text-blue-700' },
      multiple: { label: '多选', color: 'bg-purple-100 text-purple-700' },
      'true-false': { label: '判断', color: 'bg-orange-100 text-orange-700' },
      'fill-blank': { label: '填空', color: 'bg-green-100 text-green-700' },
    };
    return (
      <Badge className={config[type].color}>{config[type].label}</Badge>
    );
  };

  // 渲染难度标签
  const renderDifficultyBadge = (difficulty: Difficulty) => {
    const config: Record<Difficulty, { label: string; color: string }> = {
      easy: { label: '简单', color: 'bg-green-100 text-green-700' },
      medium: { label: '中等', color: 'bg-yellow-100 text-yellow-700' },
      hard: { label: '困难', color: 'bg-red-100 text-red-700' },
    };
    return (
      <Badge variant="outline" className={config[difficulty].color}>
        {config[difficulty].label}
      </Badge>
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
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">智能刷题助手</h1>
              <p className="text-xs text-gray-500">{questions.length} 道题目</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" />
                  导入题库
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>导入题库</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="text">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="text">文本导入</TabsTrigger>
                    <TabsTrigger value="work">WORK 题库</TabsTrigger>
                    <TabsTrigger value="pdf">PDF 导入</TabsTrigger>
                  </TabsList>
                  <TabsContent value="text" className="space-y-4">
                    <div>
                      <Label htmlFor="import-text">粘贴题目文本</Label>
                      <Textarea
                        id="import-text"
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder="格式示例：
1. 以下哪个是 JavaScript 的数据类型？
A. String
B. Integer
C. Character
D. Boolean

2. React 使用什么语言编写？
A. JavaScript
B. TypeScript
C. Python
D. Java"
                        className="min-h-[200px] mt-2"
                      />
                    </div>
                    <Button onClick={handleTextImport} className="w-full">
                      开始导入
                    </Button>
                  </TabsContent>
                  <TabsContent value="work" className="space-y-4">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-orange-800">
                        <strong>WORK 题库格式说明：</strong>
                        <br />
                        支持驾考类题库（如驾校宝典、科目一/科目四等）的 JSON 格式文件导入。
                        <br />
                        常见字段：question、options、answer、type 等。
                      </p>
                    </div>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <FileText className="w-12 h-12 text-orange-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">选择 WORK/JSON 题库文件</p>
                      <Input
                        type="file"
                        accept=".json,.work,.txt"
                        onChange={handleWorkImport}
                        className="max-w-xs mx-auto"
                      />
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-2">或者粘贴 JSON 题库文本：</p>
                      <Textarea
                        id="import-work-text"
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder='粘贴 JSON 格式题库...
[{"question": "题目内容", "options": {"A": "选项A", "B": "选项B"}, "answer": "a"}]'
                        className="min-h-[120px] text-sm"
                      />
                      <Button onClick={handleWorkTextImport} className="w-full mt-2" variant="secondary">
                        导入 WORK 题库
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="pdf" className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">选择 PDF 文件导入题库</p>
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={handlePdfImport}
                        className="max-w-xs mx-auto"
                      />
                    </div>
                    <p className="text-xs text-gray-500 text-center">
                      支持从教材、试卷等 PDF 文档中提取题目
                    </p>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="practice" className="gap-2">
              <Play className="w-4 h-4" />
              练习
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-2">
              <Library className="w-4 h-4" />
              题库
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              统计
            </TabsTrigger>
          </TabsList>

          {/* 练习页面 */}
          <TabsContent value="practice">
            {!quizState.isComplete && quizState.questions.length > 0 ? (
              <div className="grid lg:grid-cols-3 gap-6">
                {/* 题目区域 */}
                <div className="lg:col-span-2 space-y-6">
                  {/* 开始练习选择 */}
                  {!quizState.questions.length || (quizState.questions.length > 0 && quizState.currentIndex === 0 && !quizState.answers[quizState.questions[0]?.id]) ? (
                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-blue-500" />
                          选择练习模式
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid sm:grid-cols-3 gap-4">
                          <Button
                            variant="outline"
                            className="h-auto py-6 flex-col gap-2"
                            onClick={() => startQuiz('sequential')}
                          >
                            <Target className="w-8 h-8 text-blue-500" />
                            <span>顺序练习</span>
                            <span className="text-xs text-gray-500">按题目顺序</span>
                          </Button>
                          <Button
                            variant="outline"
                            className="h-auto py-6 flex-col gap-2"
                            onClick={() => startQuiz('random')}
                          >
                            <RefreshCw className="w-8 h-8 text-purple-500" />
                            <span>随机练习</span>
                            <span className="text-xs text-gray-500">打乱题目顺序</span>
                          </Button>
                          <Button
                            variant="outline"
                            className="h-auto py-6 flex-col gap-2"
                            onClick={() => startQuiz('wrong')}
                          >
                            <Star className="w-8 h-8 text-orange-500" />
                            <span>错题重练</span>
                            <span className="text-xs text-gray-500">专攻错题</span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* 进度条 */}
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">
                              进度 {quizState.currentIndex + 1} / {quizState.questions.length}
                            </span>
                            <span className="text-sm text-gray-500">
                              {Math.round(((quizState.currentIndex + 1) / quizState.questions.length) * 100)}%
                            </span>
                          </div>
                          <Progress 
                            value={((quizState.currentIndex + 1) / quizState.questions.length) * 100} 
                            className="h-2"
                          />
                        </CardContent>
                      </Card>

                      {/* 题目卡片 */}
                      {currentQuestion && (
                        <Card className="shadow-lg">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {renderTypeBadge(currentQuestion.type)}
                                {renderDifficultyBadge(currentQuestion.difficulty)}
                              </div>
                              <span className="text-sm text-gray-500">
                                第 {quizState.currentIndex + 1} 题
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            <p className="text-lg font-medium leading-relaxed">
                              {currentQuestion.content}
                            </p>
                            
                            {renderOptions()}
                            
                            {/* 解析 */}
                            {quizState.showResult && currentQuestion.explanation && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                                <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                                  <BookOpen className="w-4 h-4" />
                                  题目解析
                                </h4>
                                <p className="text-blue-700">{currentQuestion.explanation}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* 操作按钮 */}
                      <div className="flex items-center justify-between">
                        <Button
                          variant="outline"
                          onClick={prevQuestion}
                          disabled={quizState.currentIndex === 0}
                          className="gap-2"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          上一题
                        </Button>
                        
                        <div className="flex gap-2">
                          {!quizState.showResult ? (
                            <Button
                              onClick={submitAnswer}
                              disabled={!currentAnswer}
                              className="gap-2"
                            >
                              提交答案
                            </Button>
                          ) : (
                            <Button
                              onClick={nextQuestion}
                              className="gap-2"
                            >
                              {quizState.currentIndex === quizState.questions.length - 1 ? '完成练习' : '下一题'}
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* 题目导航 */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">题目导航</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-10 gap-2">
                            {quizState.questions.map((q, idx) => {
                              const answered = !!quizState.answers[q.id];
                              const isCurrent = idx === quizState.currentIndex;
                              
                              return (
                                <button
                                  key={q.id}
                                  onClick={() => goToQuestion(idx)}
                                  className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${
                                    isCurrent
                                      ? 'bg-blue-500 text-white'
                                      : answered
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  {idx + 1}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-4 mt-4 text-sm">
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 rounded bg-gray-100"></div>
                              <span className="text-gray-500">未答</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 rounded bg-green-100"></div>
                              <span className="text-gray-500">已答</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 rounded bg-blue-500"></div>
                              <span className="text-gray-500">当前</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>

                {/* 侧边栏 */}
                <div className="space-y-6">
                  {/* 快捷操作 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">快捷操作</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          setActiveTab('library');
                        }}
                      >
                        <Library className="w-4 h-4 mr-2" />
                        查看题库
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={restartQuiz}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        重新开始
                      </Button>
                    </CardContent>
                  </Card>

                  {/* 今日统计 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        今日统计
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="text-center">
                          <p className="text-3xl font-bold text-blue-600">{getStats().accuracy}%</p>
                          <p className="text-sm text-gray-500">正确率</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <p className="text-2xl font-bold text-green-600">{getStats().correctCount}</p>
                            <p className="text-xs text-gray-500">正确</p>
                          </div>
                          <div className="text-center p-3 bg-red-50 rounded-lg">
                            <p className="text-2xl font-bold text-red-600">{getStats().wrongCount}</p>
                            <p className="text-xs text-gray-500">错误</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
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
            )}

            {/* 空状态 */}
            {questions.length === 0 && (
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
              <h2 className="text-xl font-bold">题库管理</h2>
              <div className="flex gap-2">
                <Dialog open={addQuestionOpen} onOpenChange={setAddQuestionOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
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
                            <div key={opt.id} className="flex gap-2">
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
                              {newQuestion.options?.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
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

            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-500">#{idx + 1}</span>
                            {renderTypeBadge(q.type)}
                            {renderDifficultyBadge(q.difficulty)}
                          </div>
                          <p className="font-medium text-gray-900 mb-2">{q.content}</p>
                          {q.options && (
                            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                              {q.options.map((opt) => (
                                <div key={opt.id} className="flex items-center gap-1">
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
          </TabsContent>

          {/* 统计页面 */}
          <TabsContent value="stats">
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{getStats().totalCount}</p>
                      <p className="text-sm text-gray-500">总练习次数</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <Check className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{getStats().correctCount}</p>
                      <p className="text-sm text-gray-500">正确次数</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <X className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{getStats().wrongCount}</p>
                      <p className="text-sm text-gray-500">错误次数</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Target className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{getStats().accuracy}%</p>
                      <p className="text-sm text-gray-500">正确率</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>正确率趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>练习数据将在你开始刷题后显示</p>
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
