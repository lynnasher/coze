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
  FileCheck,
  Grid3X3,
  Clock,
  ArrowLeft
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
    setHasStarted,
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
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0); // 答题用时（秒）
  const [timeRemaining, setTimeRemaining] = useState(7200); // 剩余时间（默认2小时）
  
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

  // JSON 题库导入
  const handleJsonImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // 验证 JSON 格式
      if (!data.questions || !Array.isArray(data.questions)) {
        alert('JSON 格式错误：缺少 questions 数组');
        e.target.value = '';
        return;
      }
      
      // 提取题库名称
      const bankName = data.subjectName || data.bankName || file.name.replace(/\.json$/i, '') || '导入题库';
      
      // 生成题库 ID
      const bankId = generateId();
      
      // 类型映射：数字 -> 字符串
      const typeMap: Record<number, QuestionType> = {
        1: 'single',
        2: 'multiple',
        3: 'true-false',
        4: 'fill-blank',
      };
      
      // 处理每道题目
      const questionsWithBankId = data.questions.map((q: Record<string, unknown>) => {
        // 转换类型
        let questionType: QuestionType = 'single';
        const qType = q.type;
        if (typeof qType === 'number') {
          questionType = typeMap[qType as number] || 'single';
        } else if (typeof qType === 'string') {
          const t = qType.toLowerCase();
          if (t.includes('多选')) questionType = 'multiple';
          else if (t.includes('判断')) questionType = 'true-false';
          else if (t.includes('填空')) questionType = 'fill-blank';
          else questionType = 'single';
        }
        
        // 转换选项：从对象格式 { "A": "选项A" } 转为数组格式
        let options: { id: string; text: string }[] | undefined;
        const qOptions = q.options;
        if (qOptions && typeof qOptions === 'object') {
          if (Array.isArray(qOptions)) {
            options = qOptions as { id: string; text: string }[];
          } else {
            // 对象格式 { "A": "选项A", "B": "选项B" }
            options = Object.entries(qOptions).map(([key, val]) => ({
              id: key.toLowerCase(),
              text: String(val),
            })).sort((a, b) => a.id.localeCompare(b.id));
          }
        }
        
        // 处理答案
        let answer: string | string[] = 'a';
        const qAnswer = q.answer;
        if (qAnswer) {
          if (typeof qAnswer === 'string') {
            // 多选题答案可能是 "ABC"
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
        
        return {
          id: generateId(),
          type: questionType,
          content: (q.question as string) || (q.content as string) || '',
          options,
          answer,
          explanation: (q.explanation as string) || '',
          difficulty: (q.difficulty as Difficulty) || 'medium',
          tags: (q.tags as string[]) || [],
          bankId,
          createdAt: Date.now(),
        } as Question;
      });
      
      if (questionsWithBankId.length === 0) {
        alert('JSON 中没有有效的题目');
        e.target.value = '';
        return;
      }
      
      // 保存题目到 localStorage
      questionStore.addMultiple(questionsWithBankId);
      
      // 创建题库
      const bank = bankStore.createWithId(bankId, bankName, file.name);
      bank.questionIds = questionsWithBankId.map((q: Question) => q.id);
      bankStore.update(bank);
      
      // 统计类型
      const typeStats = {
        single: questionsWithBankId.filter((q: Question) => q.type === 'single').length,
        multiple: questionsWithBankId.filter((q: Question) => q.type === 'multiple').length,
        'true-false': questionsWithBankId.filter((q: Question) => q.type === 'true-false').length,
        'fill-blank': questionsWithBankId.filter((q: Question) => q.type === 'fill-blank').length,
      };
      
      loadQuestions();
      setImportModalOpen(false);
      alert(`成功导入题库「${bankName}」\n共 ${questionsWithBankId.length} 道题目\n\n题目类型：\n单选题: ${typeStats.single} 道\n多选题: ${typeStats.multiple} 道\n判断题: ${typeStats['true-false']} 道\n填空题: ${typeStats['fill-blank']} 道`);
    } catch (error) {
      console.error('JSON 导入错误:', error);
      alert('导入失败，请检查 JSON 格式是否正确');
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
      const options = Array.isArray(currentQuestion.options) ? currentQuestion.options : [];
      return (
        <div className="space-y-2 sm:space-y-3">
          {options.map((option: { id: string; text: string }, index: number) => {
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
    const options = Array.isArray(currentQuestion.options) ? currentQuestion.options : [];
    return (
      <div className="space-y-2 sm:space-y-3">
        {options.map((option: { id: string; text: string }, index: number) => {
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
  const renderTypeBadge = (type: string) => {
    const config: Record<string, { label: string; color: string }> = {
      single: { label: '单选', color: 'bg-blue-100 text-blue-700 text-xs' },
      multiple: { label: '多选', color: 'bg-purple-100 text-purple-700 text-xs' },
      'true-false': { label: '判断', color: 'bg-orange-100 text-orange-700 text-xs' },
      'fill-blank': { label: '填空', color: 'bg-green-100 text-green-700 text-xs' },
    };
    const safeType = type || 'single';
    const cfg = config[safeType] || { label: safeType, color: 'bg-gray-100 text-gray-700 text-xs' };
    return (
      <Badge className={`${cfg.color} px-1.5 py-0.5 sm:px-2 sm:py-0.5`}>{cfg.label}</Badge>
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
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" />
                    </div>
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">导入 JSON 题库</h3>
                    <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">选择 .json 格式的题库文件</p>
                    <Input
                      type="file"
                      accept=".json"
                      onChange={handleJsonImport}
                      className="max-w-xs mx-auto text-sm"
                    />
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-2 text-sm">JSON 格式说明</h4>
                    <div className="text-xs text-gray-600 bg-gray-100 p-3 rounded-lg overflow-x-auto">
                      <p className="font-medium mb-2">支持的两种格式：</p>
                      
                      <p className="font-medium mt-3 text-blue-600">格式一（推荐）：</p>
                      <pre className="mt-1 mb-2">{`{
  "bankName": "题库名称",
  "questions": [{
    "type": "single",
    "content": "题目内容",
    "options": [{"id":"a","text":"选项A"}],
    "answer": "a",
    "explanation": "解析"
  }]
}`}</pre>
                      
                      <p className="font-medium mt-3 text-green-600">格式二（导出格式）：</p>
                      <pre className="mt-1">{`{
  "subjectName": "科目名称",
  "questions": [{
    "type": 1,  // 1单选 2多选 3判断 4填空
    "question": "题目内容",
    "options": {"A":"选项A","B":"选项B"},
    "answer": "A",
    "explanation": "解析"
  }]
}`}</pre>
                    </div>
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

          {/* 练习页面 - 新布局 */}
          <TabsContent value="practice">
            {!quizState.isComplete && quizState.questions.length > 0 && hasStarted ? (
              <div className="min-h-screen bg-gray-100 -mx-4 sm:mx-0">
                {/* 顶部蓝色导航栏 */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-4 sticky top-0 z-20">
                  <div className="flex items-center justify-between mb-3">
                    {/* 左侧：返回按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('确定要退出练习吗？')) {
                          setHasStarted(false);
                          setPracticeBankId(null);
                        }
                      }}
                      className="text-white hover:bg-white/20 px-2 -ml-2"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    
                    {/* 中间：考试名称 */}
                    <div className="text-center flex-1">
                      <h2 className="text-base sm:text-lg font-semibold">
                        {practiceBankId 
                          ? banks.find(b => b.id === practiceBankId)?.name || '练习' 
                          : '智能刷题'}
                      </h2>
                    </div>
                    
                    {/* 右侧：答题卡 + 交卷 */}
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAnswerSheet(true)}
                        className="text-white hover:bg-white/20 px-2"
                      >
                        <Grid3X3 className="w-5 h-5" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          const answeredCount = Object.keys(quizState.answers).length;
                          if (confirm(`已回答 ${answeredCount}/${quizState.questions.length} 道题目，确定要交卷吗？`)) {
                            finishQuiz();
                          }
                        }}
                        className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 h-8 font-medium"
                      >
                        交卷
                      </Button>
                    </div>
                  </div>
                  
                  {/* 进度信息 */}
                  <div className="flex items-center justify-between text-sm mb-2">
                    <div className="flex items-center gap-3">
                      <span>答题 {Object.keys(quizState.answers).length}/{quizState.questions.length}</span>
                      <button 
                        onClick={() => setShowAnswerSheet(true)}
                        className="underline underline-offset-2 hover:text-white/80"
                      >
                        答题卡
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}</span>
                    </div>
                  </div>
                  
                  {/* 进度条 */}
                  <div className="h-1.5 bg-blue-400 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white rounded-full transition-all duration-300"
                      style={{ width: `${(Object.keys(quizState.answers).length / quizState.questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* 题目内容区域 */}
                <div className="p-4 pb-28 sm:max-w-2xl sm:mx-auto sm:py-6">
                  {currentQuestion && (
                    <div ref={questionCardRef} tabIndex={-1}>
                      {/* 题型标签 */}
                      <div className="mb-3 flex items-center gap-2">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                          currentQuestion.type === 'single' ? 'bg-blue-500 text-white' :
                          currentQuestion.type === 'multiple' ? 'bg-purple-500 text-white' :
                          currentQuestion.type === 'true-false' ? 'bg-orange-500 text-white' :
                          'bg-green-500 text-white'
                        }`}>
                          {currentQuestion.type === 'single' ? '单选题' :
                           currentQuestion.type === 'multiple' ? '多选题' :
                           currentQuestion.type === 'true-false' ? '判断题' : '填空题'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {quizState.currentIndex + 1} / {quizState.questions.length}
                        </span>
                      </div>
                      
                      {/* 题干 */}
                      <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
                        <p className="text-base sm:text-lg text-gray-900 leading-relaxed">
                          {currentQuestion.content}
                        </p>
                      </div>
                      
                      {/* 选项列表 */}
                      <div className="space-y-2.5">
                        {renderOptions()}
                      </div>
                      
                      {/* 答案与解析 */}
                      {quizState.showResult && (
                        <div className="mt-4 space-y-3">
                          {/* 答案对比 */}
                          <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="flex flex-wrap gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">正确答案：</span>
                                <span className="font-semibold text-emerald-600 ml-1">
                                  {Array.isArray(currentQuestion.answer) 
                                    ? currentQuestion.answer.map(a => a.toUpperCase()).join(', ')
                                    : currentQuestion.answer.toUpperCase()}
                                </span>
                              </div>
                              {!isAnswerCorrect && currentAnswer && (
                                <div>
                                  <span className="text-gray-500">已选答案：</span>
                                  <span className="font-semibold text-rose-600 ml-1">
                                    {Array.isArray(currentAnswer) 
                                      ? currentAnswer.map(a => a.toUpperCase()).join(', ')
                                      : currentAnswer.toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                            {/* 对错提示 */}
                            <div className={`mt-3 flex items-center gap-2 ${
                              isAnswerCorrect ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {isAnswerCorrect ? (
                                <>
                                  <Check className="w-5 h-5" />
                                  <span className="font-medium">回答正确</span>
                                </>
                              ) : (
                                <>
                                  <X className="w-5 h-5" />
                                  <span className="font-medium">回答错误</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* 解析 */}
                          {currentQuestion.explanation && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                              <div className="flex items-center gap-2 text-amber-800 mb-2">
                                <BookOpen className="w-4 h-4" />
                                <span className="font-medium text-sm">解析</span>
                              </div>
                              <p className="text-amber-900 text-sm leading-relaxed">
                                {currentQuestion.explanation}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 底部固定操作栏 */}
                <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg p-3 sm:static sm:max-w-2xl sm:mx-auto sm:mt-4 sm:bg-transparent sm:border-0 sm:p-0 sm:shadow-none rounded-t-2xl sm:rounded-none">
                  <div className="flex items-center justify-between gap-2 max-w-2xl mx-auto">
                    {/* 左侧：上一题 */}
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (quizState.currentIndex > 0) {
                          prevQuestion();
                          setTimeout(() => {
                            questionCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 50);
                        }
                      }}
                      disabled={quizState.currentIndex === 0}
                      className="flex-1 h-11 border-gray-200"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      <span>上一题</span>
                    </Button>
                    
                    {/* 中间：查看解析（答题后显示） */}
                    {currentAnswer && !quizState.showResult && (
                      <Button
                        variant="outline"
                        onClick={submitAnswer}
                        className="flex-1 h-11 border-amber-200 text-amber-700 hover:bg-amber-50"
                      >
                        <BookOpen className="w-4 h-4 mr-1" />
                        <span>查看解析</span>
                      </Button>
                    )}
                    
                    {/* 中间：答题进度提示（答题后且显示结果时） */}
                    {quizState.showResult && (
                      <div className={`flex-1 h-11 flex items-center justify-center rounded-lg px-3 ${
                        isAnswerCorrect 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {isAnswerCorrect ? (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            <span>回答正确</span>
                          </>
                        ) : (
                          <>
                            <X className="w-4 h-4 mr-1" />
                            <span>回答错误</span>
                          </>
                        )}
                      </div>
                    )}
                    
                    {/* 右侧：下一题 / 交卷 */}
                    {quizState.currentIndex === quizState.questions.length - 1 ? (
                      <Button
                        onClick={() => finishQuiz()}
                        className="flex-1 h-12 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-bold shadow-lg shadow-emerald-500/30 rounded-xl"
                      >
                        <FileCheck className="w-5 h-5 mr-2" />
                        交卷
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          if (currentAnswer && !quizState.showResult) {
                            submitAnswer();
                          }
                          nextQuestion();
                          setTimeout(() => {
                            questionCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 50);
                        }}
                        className="flex-1 h-11 bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
                      >
                        <span>下一题</span>
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* 答题卡弹窗 */}
                <Dialog open={showAnswerSheet} onOpenChange={setShowAnswerSheet}>
                  <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-base">答题卡</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {quizState.questions.map((q, idx) => {
                          const answered = !!quizState.answers[q.id];
                          const record = recordStore.getByQuestionId(q.id);
                          const isWrong = answered && record.length > 0 && !record[record.length - 1].isCorrect;
                          const isCurrent = idx === quizState.currentIndex;
                          
                          return (
                            <button
                              key={q.id}
                              onClick={() => {
                                goToQuestion(idx);
                                setShowAnswerSheet(false);
                              }}
                              className={`w-9 h-9 rounded-lg text-sm font-medium transition-all flex items-center justify-center ${
                                isCurrent
                                  ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                                  : answered
                                    ? isWrong
                                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                      : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                              }`}
                            >
                              {idx + 1}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded bg-blue-500"></div>
                          <span>当前</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300"></div>
                          <span>正确</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded bg-rose-100 border border-rose-300"></div>
                          <span>错误</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300"></div>
                          <span>未答</span>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ) : quizState.isComplete ? (
              /* 完成页面 - 新布局 */
              <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Trophy className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">练习完成</h2>
                  <p className="text-gray-600 mb-8">你已完成本次练习，继续加油</p>
                  
                  <div className="grid grid-cols-3 gap-3 mb-8">
                    <div className="p-4 bg-blue-50 rounded-xl">
                      <p className="text-2xl font-bold text-blue-600">{quizState.questions.length}</p>
                      <p className="text-sm text-gray-500">总题数</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-xl">
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
                    <div className="p-4 bg-orange-50 rounded-xl">
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
                </div>
              </div>
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
            {/* 移动端：紧凑的头部布局 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <Library className="w-5 h-5" />
                <span className="hidden sm:inline">题库管理</span>
                <span className="sm:hidden">题库 ({banks.length})</span>
              </h2>
              <div className="flex items-center gap-2">
                {banks.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleClearAll}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs px-2"
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                    <span className="hidden sm:inline">清空</span>
                  </Button>
                )}
                <Button onClick={() => setImportModalOpen(true)} size="sm" className="gap-1">
                  <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">导入题库</span>
                  <span className="sm:hidden">导入</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAddQuestionOpen(true)} className="gap-1">
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">添加题目</span>
                </Button>
              </div>
            </div>

            {/* 题库列表 */}
            <div className="mb-6 sm:mb-8">
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
                /* 题库列表 - 移动端垂直列表，桌面端网格 */
                <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
                  {banks.map((bank) => (
                    <Card key={bank.id} className="sm:hover:shadow-md transition-shadow">
                      <CardContent className="p-3 sm:p-4">
                        {/* 题库名称行 */}
                        <div className="flex items-start gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            {editingBankId === bank.id ? (
                              <div className="flex gap-2">
                                <Input
                                  value={editingBankName}
                                  onChange={(e) => setEditingBankName(e.target.value)}
                                  className="h-8 text-sm"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveBankName();
                                    if (e.key === 'Escape') setEditingBankId(null);
                                  }}
                                />
                                <Button size="sm" onClick={handleSaveBankName}>保存</Button>
                              </div>
                            ) : (
                              <div 
                                className="cursor-pointer group"
                                onClick={() => handleViewBankQuestions(bank.id)}
                              >
                                <h4 className="font-medium text-gray-900 text-sm sm:text-base leading-tight line-clamp-2 group-hover:text-blue-600">
                                  {bank.name}
                                </h4>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 sm:h-8 sm:w-8"
                              onClick={() => handleStartEditBank(bank)}
                            >
                              <FileText className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 sm:h-8 sm:w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleDeleteBank(bank.id)}
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* 题库信息 */}
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                          <span>{bank.questionIds.length} 道题目</span>
                          <span>{new Date(bank.createdAt).toLocaleDateString()}</span>
                        </div>
                        
                        {/* 操作按钮 - 移动端紧凑布局 */}
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs"
                            onClick={() => handleViewBankQuestions(bank.id)}
                          >
                            <Library className="w-3 h-3 mr-1" />
                            题目
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1 h-8 text-xs bg-blue-500 hover:bg-blue-600"
                            onClick={() => {
                              setPracticeBankId(bank.id);
                              setActiveTab('practice');
                              setTimeout(() => startQuiz('sequential', bank.id), 100);
                            }}
                            disabled={bank.questionIds.length === 0}
                          >
                            <Target className="w-3 h-3 mr-0.5" />
                            顺序
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1 h-8 text-xs bg-purple-500 hover:bg-purple-600"
                            onClick={() => {
                              setPracticeBankId(bank.id);
                              setActiveTab('practice');
                              setTimeout(() => startQuiz('random', bank.id), 100);
                            }}
                            disabled={bank.questionIds.length === 0}
                          >
                            <RefreshCw className="w-3 h-3 mr-0.5" />
                            随机
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1 h-8 text-xs bg-orange-500 hover:bg-orange-600"
                            onClick={() => {
                              setPracticeBankId(bank.id);
                              setActiveTab('practice');
                              setTimeout(() => startQuiz('wrong', bank.id), 100);
                            }}
                            disabled={bank.questionIds.length === 0}
                          >
                            <Star className="w-3 h-3 mr-0.5" />
                            错题
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* 题库内题目列表 */}
            {showBankQuestions && selectedBankId && (
              <div className="border-t pt-4 sm:pt-6 mt-4 sm:mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">题库题目</span>
                    <span className="sm:hidden">题目</span>
                    ({questions.filter(q => q.bankId === selectedBankId).length})
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => setShowBankQuestions(false)}>
                    关闭
                  </Button>
                </div>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y max-h-[60vh] overflow-y-auto">
                      {questions
                        .filter(q => q.bankId === selectedBankId)
                        .map((q, idx) => (
                          <div key={q.id} className="p-3 sm:p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 sm:mb-2 flex-wrap">
                                  <span className="text-xs sm:text-sm font-medium text-gray-500">#{idx + 1}</span>
                                  {renderTypeBadge(q.type)}
                                </div>
                                <p className="font-medium text-gray-900 mb-2 text-sm sm:text-base line-clamp-2">{q.content}</p>
                                {q.options && Array.isArray(q.options) && q.options.length > 0 && (
                                  <div className="grid grid-cols-2 gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600">
                                    {q.options.map((opt: { id: string; text: string }, optIdx: number) => (
                                      <div key={`opt-${optIdx}-${opt.id}`} className="flex items-center gap-1">
                                        <span className="font-medium">{opt.id.toUpperCase()}.</span>
                                        <span className="truncate">{opt.text}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-1 sm:mt-2 text-xs sm:text-sm">
                                  <span className="text-gray-500">答案：</span>
                                  <span className="font-medium text-green-600">
                                    {Array.isArray(q.answer) ? q.answer.map(a => a.toUpperCase()).join(', ') : q.answer.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 flex-shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                    {questions.filter(q => q.bankId === selectedBankId).length === 0 && (
                      <div className="p-8 sm:p-12 text-center">
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
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-500">#{idx + 1}</span>
                                {renderTypeBadge(q.type)}
                                {q.bankId && banks.find(b => b.id === q.bankId) && (
                                  <Badge variant="secondary" className="text-xs line-clamp-1 max-w-[150px]">
                                    {banks.find(b => b.id === q.bankId)?.name}
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium text-gray-900 mb-2 line-clamp-2">{q.content}</p>
                              {q.options && Array.isArray(q.options) && q.options.length > 0 && (
                                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                                  {q.options.map((opt: { id: string; text: string }, optIdx: number) => (
                                    <div key={`q-opt-${optIdx}-${opt.id}`} className="flex items-center gap-1">
                                      <span className="font-medium">{opt.id.toUpperCase()}.</span>
                                      <span className="truncate">{opt.text}</span>
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

            {/* 添加题目弹窗 */}
            <Dialog open={addQuestionOpen} onOpenChange={setAddQuestionOpen}>
              <DialogContent className="max-w-[calc(100%-32px)] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
                  
                  {newQuestion.type !== 'fill-blank' && Array.isArray(newQuestion.options) && (
                    <div className="space-y-2">
                      <Label>选项</Label>
                      {newQuestion.options.map((opt: { id: string; text: string }, idx: number) => (
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
                          {Array.isArray(newQuestion.options) && newQuestion.options.map((opt: { id: string; text: string }, idx: number) => (
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
