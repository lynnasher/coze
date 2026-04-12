'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuiz } from '@/hooks/use-quiz';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  BookOpen,
  Star,
  RefreshCw,
  Plus,
  Trash2,
  FileText,
  FileCheck,
  Grid3X3,
  Clock,
  ArrowLeft,
  Sparkles,
  Zap,
  Crown,
  Flame,
  BookMarked,
  TrendingUp,
  PartyPopper,
  RotateCcw,
  ListTodo,
  Dumbbell
} from 'lucide-react';
import { questionStore, recordStore, bankStore, generateId } from '@/lib/quiz-store';
import { Question, QuestionType, Difficulty, QuestionBank } from '@/lib/types';

// Duolingo 风格颜色
const COLORS = {
  purple: 'from-purple-500 to-violet-600',
  green: 'from-emerald-500 to-teal-500',
  blue: 'from-blue-500 to-cyan-500',
  orange: 'from-orange-500 to-amber-500',
  pink: 'from-pink-500 to-rose-500',
  red: 'from-red-500 to-pink-500',
};

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
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
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
  const [timeRemaining, setTimeRemaining] = useState(7200);
  
  // 练习模式状态
  const [practiceBankId, setPracticeBankId] = useState<string | null>(null);
  
  const banks = useMemo(() => bankStore.getAll(), [questions]);
  
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
      
      if (!data.questions || !Array.isArray(data.questions)) {
        alert('JSON 格式错误：缺少 questions 数组');
        e.target.value = '';
        return;
      }
      
      const bankName = data.subjectName || data.bankName || data.title || file.name.replace(/\.json$/i, '') || '导入题库';
      const bankId = generateId();
      
      const typeMap: Record<number, QuestionType> = {
        1: 'single',
        2: 'multiple',
        3: 'true-false',
        4: 'fill-blank',
        5: 'comprehensive',
      };
      
      const processQuestion = (q: Record<string, unknown>, parentId?: string): Question | null => {
        const isExportFormat = !!q.stem;
        
        let questionType: QuestionType = 'single';
        const qType = q.type || q.qtype;
        if (typeof qType === 'number') {
          questionType = typeMap[qType as number] || 'single';
        } else if (typeof qType === 'string') {
          const t = qType.toLowerCase().trim();
          if (t === 'single') questionType = 'single';
          else if (t === 'multiple') questionType = 'multiple';
          else if (t === 'true-false' || t === 'truefalse' || t === 'judge') questionType = 'true-false';
          else if (t === 'fill-blank' || t === 'fillblank' || t === 'fill') questionType = 'fill-blank';
          else if (t === 'comprehensive') questionType = 'comprehensive';
          else if (t.includes('多选')) questionType = 'multiple';
          else if (t.includes('判断')) questionType = 'true-false';
          else if (t.includes('填空')) questionType = 'fill-blank';
          else if (t.includes('综合') || t.includes('案例')) questionType = 'comprehensive';
          else questionType = 'single';
        }
        
        let options: { id: string; text: string }[] | undefined;
        
        if (isExportFormat) {
          const opts: { id: string; text: string }[] = [];
          if (q.optiona) opts.push({ id: 'a', text: String(q.optiona) });
          if (q.optionb) opts.push({ id: 'b', text: String(q.optionb) });
          if (q.optionc) opts.push({ id: 'c', text: String(q.optionc) });
          if (q.optiond) opts.push({ id: 'd', text: String(q.optiond) });
          if (opts.length > 0) options = opts;
        } else {
          const qOptions = q.options;
          if (qOptions && typeof qOptions === 'object') {
            if (Array.isArray(qOptions)) {
              options = qOptions as { id: string; text: string }[];
            } else {
              options = Object.entries(qOptions).map(([key, val]) => ({
                id: key.toLowerCase(),
                text: String(val),
              })).sort((a, b) => a.id.localeCompare(b.id));
            }
          }
        }
        
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
        
        const questionId = generateId();
        const content = (q.question as string) || (q.content as string) || (q.stem as string) || '';
        const explanation = (q.explanation as string) || (q.parsetext as string) || '';
        
        return {
          id: questionId,
          parentId: parentId,
          type: questionType,
          content,
          options,
          answer,
          explanation,
          difficulty: (q.difficulty as Difficulty) || 'medium',
          tags: (q.tags as string[]) || [],
          bankId,
          createdAt: Date.now(),
        } as Question;
      };
      
      const flattenQuestions = (questions: Record<string, unknown>[], parentId?: string): Question[] => {
        const result: Question[] = [];
        for (const q of questions) {
          const processed = processQuestion(q, parentId);
          if (processed) {
            result.push(processed);
            const children = q.children as Record<string, unknown>[] | undefined;
            if (Array.isArray(children) && children.length > 0) {
              const childQuestions = flattenQuestions(children, processed.id);
              result.push(...childQuestions);
            }
          }
        }
        return result;
      };
      
      const questionsWithBankId = flattenQuestions(data.questions);
      
      if (questionsWithBankId.length === 0) {
        alert('JSON 中没有有效的题目');
        e.target.value = '';
        return;
      }
      
      questionStore.addMultiple(questionsWithBankId);
      const bank = bankStore.createWithId(bankId, bankName, file.name);
      bank.questionIds = questionsWithBankId.map((q: Question) => q.id);
      bankStore.update(bank);
      
      loadQuestions();
      setImportModalOpen(false);
      alert(`成功导入题库「${bankName}」\n共 ${questionsWithBankId.length} 道题目`);
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
  
  // 编辑题目
  const handleEditQuestion = (q: Question) => {
    setEditingQuestion({ ...q });
  };
  
  // 保存编辑的题目
  const handleSaveEditQuestion = () => {
    if (!editingQuestion) return;
    if (!editingQuestion.content || !editingQuestion.answer) {
      alert('请填写题目内容和答案');
      return;
    }
    questionStore.update(editingQuestion);
    loadQuestions();
    setEditingQuestion(null);
    alert('题目已更新');
  };
  
  // 删除题库
  const handleDeleteBank = (bankId: string) => {
    const bank = bankStore.getById(bankId);
    if (!bank) return;
    
    if (confirm(`确定要删除题库「${bank.name}」吗？\n这将同时删除该题库中的 ${bank.questionIds.length} 道题目。`)) {
      bank.questionIds.forEach(qId => {
        questionStore.remove(qId);
      });
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
            placeholder="输入你的答案..."
            value={(currentAnswer as string) || ''}
            onChange={(e) => handleFillBlankChange(e.target.value)}
            disabled={quizState.showResult}
            className="min-h-[100px] rounded-2xl border-2 border-gray-200 focus:border-orange-300 bg-white"
          />
        </div>
      );
    }
    
    const getOptionStyle = (isSelected: boolean, isCorrectAnswer: boolean, showResult: boolean) => {
      if (showResult) {
        if (isSelected && isCorrectAnswer) {
          return 'border-emerald-400 bg-emerald-50 shadow-md';
        }
        if (isSelected && !isCorrectAnswer) {
          return 'border-red-400 bg-red-50 shadow-md';
        }
        if (isCorrectAnswer) {
          return 'border-emerald-300 bg-emerald-25';
        }
      }
      if (isSelected) {
        return 'border-orange-400 bg-orange-50 shadow-lg shadow-orange-100';
      }
      return 'border-gray-200 bg-white hover:border-orange-200 hover:shadow-md';
    };
    
    if (currentQuestion.type === 'true-false') {
      const defaultOptions = currentQuestion.options?.length === 2 
        ? currentQuestion.options 
        : [
            { id: 'a', text: '正确' },
            { id: 'b', text: '错误' }
          ];
      
      return (
        <div className="space-y-3">
          {defaultOptions.map((option, index) => {
            const isCorrectAnswer = currentQuestion.answer === option.id;
            const isSelected = currentAnswer === option.id;
            
            return (
              <div
                key={`tf-${index}-${option.id}`}
                className={`flex items-center p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${getOptionStyle(isSelected, isCorrectAnswer, quizState.showResult)}`}
                onClick={() => !quizState.showResult && handleTrueFalseSelect(option.id)}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 font-bold text-lg transition-colors ${
                  isSelected 
                    ? quizState.showResult 
                      ? isCorrectAnswer 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-red-500 text-white'
                      : 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {isSelected ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    option.id.toUpperCase()
                  )}
                </div>
                <span className="flex-1 text-base font-medium">{option.text}</span>
                {quizState.showResult && isCorrectAnswer && (
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
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
        <div className="space-y-3">
          {options.map((option: { id: string; text: string }, index: number) => {
            const correctAnswers = Array.isArray(currentQuestion.answer) 
              ? currentQuestion.answer 
              : [currentQuestion.answer];
            const isCorrectAnswer = correctAnswers.includes(option.id);
            const isSelected = Array.isArray(currentAnswer) && currentAnswer.includes(option.id);
            
            return (
              <div
                key={`multi-${index}-${option.id}`}
                className={`flex items-center p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${getOptionStyle(isSelected, isCorrectAnswer, quizState.showResult)}`}
                onClick={() => !quizState.showResult && handleMultiSelect(option.id, !isSelected)}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 font-bold text-lg transition-colors ${
                  isSelected 
                    ? quizState.showResult 
                      ? isCorrectAnswer 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-red-500 text-white'
                      : 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {option.id.toUpperCase()}
                </div>
                <span className="flex-1 text-base font-medium">{option.text}</span>
                {quizState.showResult && isCorrectAnswer && (
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                )}
                {quizState.showResult && isSelected && !isCorrectAnswer && (
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                    <X className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-sm text-gray-400 mt-2">* 此题为多选题，可选择多个答案</p>
        </div>
      );
    }
    
    // 单选题
    const options = Array.isArray(currentQuestion.options) ? currentQuestion.options : [];
    return (
      <div className="space-y-3">
        {options.map((option: { id: string; text: string }, index: number) => {
          const isCorrectAnswer = currentQuestion.answer === option.id;
          const isSelected = currentAnswer === option.id;
          
          return (
            <div
              key={`single-${index}-${option.id}`}
              className={`flex items-center p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${getOptionStyle(isSelected, isCorrectAnswer, quizState.showResult)}`}
              onClick={() => !quizState.showResult && handleSingleSelect(option.id)}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 font-bold text-lg transition-colors ${
                isSelected 
                  ? quizState.showResult 
                    ? isCorrectAnswer 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-red-500 text-white'
                    : 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {isSelected ? (
                  <Check className="w-6 h-6" />
                ) : (
                  option.id.toUpperCase()
                )}
              </div>
              <span className="flex-1 text-base font-medium">{option.text}</span>
              {quizState.showResult && isCorrectAnswer && (
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check className="w-5 h-5 text-white" />
                </div>
              )}
              {quizState.showResult && isSelected && !isCorrectAnswer && (
                <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                  <X className="w-5 h-5 text-white" />
                </div>
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
      single: { label: '单选', color: 'bg-blue-100 text-blue-700' },
      multiple: { label: '多选', color: 'bg-purple-100 text-purple-700' },
      'true-false': { label: '判断', color: 'bg-orange-100 text-orange-700' },
      'fill-blank': { label: '填空', color: 'bg-green-100 text-green-700' },
      comprehensive: { label: '综合', color: 'bg-red-100 text-red-700' },
    };
    const safeType = type || 'single';
    const cfg = config[safeType] || { label: safeType, color: 'bg-gray-100 text-gray-700' };
    return (
      <Badge className={`${cfg.color} px-2 py-0.5 rounded-full text-xs font-medium`}>{cfg.label}</Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4">
            <img 
              src="https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2Fimage.png&nonce=bc2e0f4c-de39-48cf-9d38-20a43bfc7403&project_id=7627388236024889398&sign=825d4212b0c347b0fa3190a3c738f8d9a0e3439cb0e9b73425ec607230854602" 
              alt="Logo" 
              className="w-full h-full rounded-2xl object-contain animate-pulse"
            />
          </div>
          <p className="text-gray-600 font-medium">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-white">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-orange-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2Fimage.png&nonce=bc2e0f4c-de39-48cf-9d38-20a43bfc7403&project_id=7627388236024889398&sign=825d4212b0c347b0fa3190a3c738f8d9a0e3439cb0e9b73425ec607230854602" 
              alt="Logo" 
              className="w-12 h-12 rounded-2xl object-contain"
            />
            <div>
              <h1 className="text-xl font-bold text-gray-800">智能刷题</h1>
              <p className="text-xs text-gray-400">{questions.length} 道题目</p>
            </div>
          </div>
          
          <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-lg shadow-orange-200 gap-2">
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">导入</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-w-[calc(100%-32px)] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  导入题库
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">选择 JSON 题库文件</h3>
                  <p className="text-sm text-gray-500 mb-4">支持标准格式、导出格式和题库.json格式</p>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleJsonImport}
                    className="max-w-xs mx-auto rounded-xl"
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-2xl mx-auto px-4 py-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Duolingo 风格 Tab 切换 */}
        <div className="flex gap-2 p-1.5 bg-gray-100 rounded-2xl">
          {[
            { key: 'practice', icon: Play, label: '练习', color: 'from-green-500 to-emerald-500' },
            { key: 'library', icon: Library, label: '题库', color: 'from-blue-500 to-cyan-500' },
            { key: 'stats', icon: BarChart3, label: '统计', color: 'from-purple-500 to-violet-500' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
              }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                    : 'text-gray-600 hover:bg-white/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* 练习页面 */}
          <TabsContent value="practice">
            {!quizState.isComplete && quizState.questions.length > 0 && hasStarted ? (
              <div className="min-h-screen -mx-4 sm:mx-0">
                {/* 顶部渐变导航栏 */}
                <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 text-white px-4 py-4 sticky top-0 z-20 rounded-b-3xl shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('确定要退出练习吗？')) {
                          setHasStarted(false);
                          setPracticeBankId(null);
                        }
                      }}
                      className="text-white hover:bg-white/20 rounded-xl px-3"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    
                    <div className="text-center flex-1">
                      <h2 className="text-base font-semibold">
                        {practiceBankId 
                          ? banks.find(b => b.id === practiceBankId)?.name || '练习' 
                          : '智能刷题'}
                      </h2>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAnswerSheet(true)}
                        className="text-white hover:bg-white/20 rounded-xl px-3"
                      >
                        <Grid3X3 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* 进度信息 */}
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="flex items-center gap-2">
                      <ListTodo className="w-4 h-4" />
                      {Object.keys(quizState.answers).length}/{quizState.questions.length}
                    </span>
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  
                  {/* 进度条 */}
                  <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white rounded-full transition-all duration-500"
                      style={{ width: `${(Object.keys(quizState.answers).length / quizState.questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* 题目内容区域 */}
                <div className="p-4 pb-32">
                  {currentQuestion && (
                    <div ref={questionCardRef} tabIndex={-1}>
                      {/* 题型标签 */}
                      <div className="mb-4 flex items-center gap-2">
                        <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-bold ${
                          currentQuestion.type === 'single' ? 'bg-blue-500 text-white' :
                          currentQuestion.type === 'multiple' ? 'bg-purple-500 text-white' :
                          currentQuestion.type === 'true-false' ? 'bg-orange-500 text-white' :
                          currentQuestion.type === 'comprehensive' ? 'bg-red-500 text-white' :
                          'bg-green-500 text-white'
                        }`}>
                          {currentQuestion.type === 'single' ? '单选题' :
                           currentQuestion.type === 'multiple' ? '多选题' :
                           currentQuestion.type === 'true-false' ? '判断题' :
                           currentQuestion.type === 'comprehensive' ? '综合题' : '填空题'}
                        </span>
                        <span className="text-sm text-gray-400 font-medium">
                          {quizState.currentIndex + 1} / {quizState.questions.length}
                        </span>
                      </div>
                      
                      {/* 综合题背景材料 */}
                      {currentQuestion.parentId && (
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-4 mb-4">
                          <div className="flex items-center gap-2 text-amber-700 mb-2">
                            <BookMarked className="w-5 h-5" />
                            <span className="font-semibold text-sm">案例背景</span>
                          </div>
                          <p className="text-amber-900 text-sm leading-relaxed">
                            {(() => {
                              const parentQuestion = questions.find(q => q.id === currentQuestion.parentId);
                              return parentQuestion?.content || '（背景材料）';
                            })()}
                          </p>
                        </div>
                      )}
                      
                      {/* 题干 */}
                      <div className="bg-white rounded-2xl p-5 mb-5 shadow-lg shadow-gray-100">
                        <p className="text-lg text-gray-800 leading-relaxed font-medium">
                          {currentQuestion.type === 'comprehensive' ? currentQuestion.content : currentQuestion.content}
                        </p>
                      </div>
                      
                      {/* 选项列表 */}
                      <div className="space-y-3">
                        {renderOptions()}
                      </div>
                      
                      {/* 答案与解析 */}
                      {quizState.showResult && (
                        <div className="mt-5 space-y-4">
                          {/* 结果卡片 */}
                          <div className={`rounded-2xl p-5 ${isAnswerCorrect ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200' : 'bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200'}`}>
                            <div className="flex items-center gap-3 mb-4">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isAnswerCorrect ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                {isAnswerCorrect ? <Check className="w-8 h-8 text-white" /> : <X className="w-8 h-8 text-white" />}
                              </div>
                              <div>
                                <h3 className={`text-xl font-bold ${isAnswerCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {isAnswerCorrect ? '太棒了！' : '再接再厉！'}
                                </h3>
                                <p className="text-sm text-gray-500">
                                  {isAnswerCorrect ? '继续保持，好记性！' : '别灰心，继续努力！'}
                                </p>
                              </div>
                            </div>
                            
                            <div className="bg-white rounded-xl p-4">
                              <p className="text-sm text-gray-500 mb-1">正确答案</p>
                              <p className="text-2xl font-bold text-emerald-600">
                                {Array.isArray(currentQuestion.answer) 
                                  ? currentQuestion.answer.map(a => a.toUpperCase()).join(', ')
                                  : currentQuestion.answer.toUpperCase()}
                              </p>
                            </div>
                          </div>
                          
                          {/* 解析 */}
                          {currentQuestion.explanation && (
                            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border-2 border-amber-200">
                              <div className="flex items-center gap-2 text-amber-700 mb-2">
                                <BookOpen className="w-5 h-5" />
                                <span className="font-semibold text-sm">解析</span>
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
                <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] p-4 sm:static sm:max-w-2xl sm:mx-auto sm:mt-4 sm:bg-transparent sm:border-0 sm:p-0 sm:shadow-none rounded-t-3xl">
                  <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
                    {/* 上一题 */}
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
                      className="h-12 px-4 rounded-xl border-2 border-gray-200"
                    >
                      <ChevronLeft className="w-5 h-5 mr-1" />
                      <span className="hidden sm:inline">上一题</span>
                    </Button>
                    
                    {/* 查看解析 */}
                    {currentAnswer && !quizState.showResult && (
                      <Button
                        onClick={submitAnswer}
                        className="h-12 px-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-semibold shadow-lg shadow-orange-200"
                      >
                        <BookOpen className="w-5 h-5 mr-2" />
                        查看解析
                      </Button>
                    )}
                    
                    {/* 结果提示 */}
                    {quizState.showResult && (
                      <div className={`h-12 flex items-center justify-center px-4 rounded-xl font-semibold ${
                        isAnswerCorrect 
                          ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-200' 
                          : 'bg-red-100 text-red-700 border-2 border-red-200'
                      }`}>
                        {isAnswerCorrect ? (
                          <>
                            <Check className="w-5 h-5 mr-2" />
                            正确
                          </>
                        ) : (
                          <>
                            <X className="w-5 h-5 mr-2" />
                            错误
                          </>
                        )}
                      </div>
                    )}

                    {/* 下一题 / 交卷 */}
                    {quizState.currentIndex === quizState.questions.length - 1 ? (
                      <Button
                        onClick={() => finishQuiz()}
                        className="h-12 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200"
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
                        className="h-12 px-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-200"
                      >
                        <span>下一题</span>
                        <ChevronRight className="w-5 h-5 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* 答题卡弹窗 */}
                <Dialog open={showAnswerSheet} onOpenChange={setShowAnswerSheet}>
                  <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[80vh] overflow-y-auto rounded-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-base flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                          <Grid3X3 className="w-4 h-4 text-white" />
                        </div>
                        答题卡
                      </DialogTitle>
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
                              className={`w-10 h-10 rounded-xl text-sm font-bold transition-all flex items-center justify-center ${
                                isCurrent
                                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                                  : answered
                                    ? isWrong
                                      ? 'bg-red-100 text-red-700 border-2 border-red-300'
                                      : 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                                    : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200'
                              }`}
                            >
                              {idx + 1}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded bg-gradient-to-r from-orange-500 to-amber-500"></div>
                          <span>当前</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300"></div>
                          <span>正确</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
                          <span>错误</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200"></div>
                          <span>未答</span>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ) : quizState.isComplete ? (
              /* 完成页面 - Duolingo 风格庆祝 */
              <div className="min-h-screen -mx-4 sm:mx-0 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center relative overflow-hidden">
                  {/* 庆祝动画背景 */}
                  <div className="absolute inset-0 bg-gradient-to-b from-orange-50 to-white pointer-events-none" />
                  
                  <div className="relative z-10">
                    {/* 奖杯图标 */}
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl flex items-center justify-center shadow-xl shadow-amber-200 animate-bounce">
                      <Trophy className="w-12 h-12 text-white" />
                    </div>
                    
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">练习完成!</h2>
                    <p className="text-gray-500 mb-8">你已完成本次练习，继续加油！</p>
                    
                    {/* 统计卡片 */}
                    <div className="grid grid-cols-3 gap-3 mb-8">
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-100">
                        <p className="text-3xl font-bold text-blue-600">{quizState.questions.length}</p>
                        <p className="text-xs text-gray-500 mt-1">总题数</p>
                      </div>
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100">
                        <p className="text-3xl font-bold text-emerald-600">
                          {Object.values(quizState.answers).filter((_, idx) => {
                            const q = quizState.questions[idx];
                            const ans = quizState.answers[q.id];
                            if (Array.isArray(q.answer)) {
                              return Array.isArray(ans) && q.answer.every(a => ans.includes(a));
                            }
                            return ans === q.answer;
                          }).length}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">正确</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-4 border border-purple-100">
                        <p className="text-3xl font-bold text-purple-600">
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
                        <p className="text-xs text-gray-500 mt-1">正确率</p>
                      </div>
                    </div>
                    
                    {/* 按钮 */}
                    <div className="flex gap-3 justify-center">
                      <Button 
                        onClick={restartQuiz} 
                        className="gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl shadow-lg"
                      >
                        <RotateCcw className="w-4 h-4" />
                        再练一次
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setActiveTab('stats')}
                        className="gap-2 rounded-xl border-2"
                      >
                        <BarChart3 className="w-4 h-4" />
                        查看统计
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : questions.length > 0 ? (
              /* 练习开始页面 - Duolingo 风格 */
              <div className="space-y-6">
                {/* 题库选择 */}
                {banks.length > 0 && (
                  <Card className="overflow-hidden border-0 shadow-lg rounded-2xl">
                    <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-cyan-50">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                          <Library className="w-4 h-4 text-white" />
                        </div>
                        选择题库
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={practiceBankId === null ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPracticeBankId(null)}
                          className={`rounded-xl ${practiceBankId === null ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : ''}`}
                        >
                          全部 ({questions.length})
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
                              className={`rounded-xl ${practiceBankId === bank.id ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : ''}`}
                            >
                              {bank.name} ({bankQuestions.length})
                            </Button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* 练习模式选择 - Duolingo 风格大卡片 */}
                <Card className="overflow-hidden border-0 shadow-xl rounded-2xl">
                  <CardHeader className="pb-2 bg-gradient-to-r from-purple-50 via-pink-50 to-orange-50">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                        <Dumbbell className="w-5 h-5 text-white" />
                      </div>
                      选择练习模式
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <p className="text-center text-gray-600">
                      共 <strong className="text-purple-600">{practiceBankId ? questions.filter(q => q.bankId === practiceBankId).length : questions.length}</strong> 道题目
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* 顺序练习 */}
                      <button
                        onClick={() => startQuiz('sequential', practiceBankId)}
                        className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border-2 border-blue-100 hover:border-blue-300 transition-all hover:shadow-lg hover:shadow-blue-100"
                      >
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg shadow-blue-200">
                          <Target className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="font-bold text-gray-800 mb-1">顺序练习</h3>
                        <p className="text-xs text-gray-500">按顺序逐一攻克</p>
                      </button>
                      
                      {/* 随机练习 */}
                      <button
                        onClick={() => startQuiz('random', practiceBankId)}
                        className="group relative overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 border-2 border-purple-100 hover:border-purple-300 transition-all hover:shadow-lg hover:shadow-purple-100"
                      >
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg shadow-purple-200">
                          <RefreshCw className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="font-bold text-gray-800 mb-1">随机练习</h3>
                        <p className="text-xs text-gray-500">打乱顺序挑战自我</p>
                      </button>
                      
                      {/* 错题重练 */}
                      <button
                        onClick={() => startQuiz('wrong', practiceBankId)}
                        className="group relative overflow-hidden bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-5 border-2 border-orange-100 hover:border-orange-300 transition-all hover:shadow-lg hover:shadow-orange-100"
                      >
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg shadow-orange-200">
                          <Star className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="font-bold text-gray-800 mb-1">错题重练</h3>
                        <p className="text-xs text-gray-500">专攻易错题目</p>
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* 题库为空 - Duolingo 风格空状态 */
              <Card className="shadow-xl rounded-2xl border-0">
                <CardContent className="pt-12 pb-12 text-center">
                  <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-gray-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">开始你的学习之旅</h2>
                  <p className="text-gray-500 mb-8">导入题库或手动添加题目开始练习</p>
                  <div className="flex gap-3 justify-center">
                    <Button 
                      onClick={() => setImportModalOpen(true)} 
                      className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl shadow-lg shadow-emerald-200"
                    >
                      <Upload className="w-4 h-4" />
                      导入题库
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setAddQuestionOpen(true)} 
                      className="gap-2 rounded-xl border-2"
                    >
                      <Plus className="w-4 h-4" />
                      添加题目
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 题库页面 - Duolingo 风格 */}
          <TabsContent value="library">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
                  <Library className="w-5 h-5 text-white" />
                </div>
                题库管理
              </h2>
              <div className="flex gap-2">
                {banks.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleClearAll}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    清空
                  </Button>
                )}
                <Button 
                  onClick={() => setImportModalOpen(true)} 
                  size="sm" 
                  className="gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl"
                >
                  <Upload className="w-4 h-4" />
                  导入
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setAddQuestionOpen(true)} 
                  className="gap-1 rounded-xl"
                >
                  <Plus className="w-4 h-4" />
                  添加
                </Button>
              </div>
            </div>

            {/* 题库列表 */}
            <div className="space-y-4">
              {banks.length === 0 ? (
                <Card className="bg-gradient-to-br from-gray-50 to-white border-dashed border-2 rounded-2xl">
                  <CardContent className="py-10 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center">
                      <Library className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 mb-4">暂无题库，导入题库开始学习</p>
                    <Button 
                      onClick={() => setImportModalOpen(true)} 
                      className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl"
                    >
                      <Upload className="w-4 h-4" />
                      导入题库
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {banks.map((bank) => (
                    <Card key={bank.id} className="overflow-hidden border-0 shadow-lg rounded-2xl hover:shadow-xl transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            {editingBankId === bank.id ? (
                              <div className="flex gap-2">
                                <Input
                                  value={editingBankName}
                                  onChange={(e) => setEditingBankName(e.target.value)}
                                  className="h-9 text-sm rounded-xl"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveBankName();
                                    if (e.key === 'Escape') setEditingBankId(null);
                                  }}
                                />
                                <Button size="sm" onClick={handleSaveBankName} className="rounded-xl">保存</Button>
                              </div>
                            ) : (
                              <div className="cursor-pointer group" onClick={() => handleViewBankQuestions(bank.id)}>
                                <h4 className="font-semibold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                                  {bank.name}
                                </h4>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl"
                              onClick={() => handleStartEditBank(bank)}
                            >
                              <FileText className="w-4 h-4 text-gray-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleDeleteBank(bank.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            {bank.questionIds.length} 道题
                          </span>
                          <span>{new Date(bank.createdAt).toLocaleDateString()}</span>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-9 text-xs rounded-xl border-gray-200"
                            onClick={() => handleViewBankQuestions(bank.id)}
                          >
                            <Library className="w-3 h-3 mr-1" />
                            查看
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 h-9 text-xs bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-xl"
                            onClick={() => {
                              setPracticeBankId(bank.id);
                              setActiveTab('practice');
                              setTimeout(() => startQuiz('sequential', bank.id), 100);
                            }}
                            disabled={bank.questionIds.length === 0}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            练习
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
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-white" />
                    </div>
                    {banks.find(b => b.id === selectedBankId)?.name}
                    <Badge variant="secondary" className="rounded-full">{questions.filter(q => q.bankId === selectedBankId).length}</Badge>
                  </h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowBankQuestions(false)} className="h-8 w-8 rounded-xl">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                  <CardContent className="p-0 divide-y">
                    {questions
                      .filter(q => q.bankId === selectedBankId)
                      .map((q, idx) => (
                        <div key={q.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="text-xs font-medium text-gray-400">#{idx + 1}</span>
                                {renderTypeBadge(q.type)}
                              </div>
                              <p className="font-medium text-gray-900 mb-2 line-clamp-2 text-sm">{q.content}</p>
                              {q.options && Array.isArray(q.options) && q.options.length > 0 && (
                                <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                                  {q.options.map((opt, optIdx) => (
                                    <div key={`opt-${optIdx}-${opt.id}`} className="flex items-center gap-1">
                                      <span className="font-medium">{opt.id.toUpperCase()}.</span>
                                      <span className="truncate">{opt.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="mt-2 text-xs">
                                <span className="text-gray-400">答案：</span>
                                <span className="font-medium text-emerald-600">
                                  {Array.isArray(q.answer) ? q.answer.map(a => a.toUpperCase()).join(', ') : q.answer.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditQuestion(q)}
                                className="h-8 w-8 rounded-xl text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                              >
                                <FileCheck className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="h-8 w-8 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    {questions.filter(q => q.bankId === selectedBankId).length === 0 && (
                      <div className="p-8 text-center">
                        <p className="text-gray-400">该题库暂无题目</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 所有题目列表 */}
            {!showBankQuestions && questions.length > 0 && (
              <div className="mt-6">
                <h3 className="font-bold flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  所有题目
                  <Badge variant="secondary" className="rounded-full">{questions.length}</Badge>
                </h3>
                <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                  <CardContent className="p-0 divide-y max-h-[400px] overflow-y-auto">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-400">#{idx + 1}</span>
                              {renderTypeBadge(q.type)}
                              {q.bankId && banks.find(b => b.id === q.bankId) && (
                                <Badge variant="secondary" className="text-xs rounded-full line-clamp-1 max-w-[120px]">
                                  {banks.find(b => b.id === q.bankId)?.name}
                                </Badge>
                              )}
                            </div>
                            <p className="font-medium text-gray-900 mb-2 line-clamp-2 text-sm">{q.content}</p>
                            <div className="text-xs">
                              <span className="text-gray-400">答案：</span>
                              <span className="font-medium text-emerald-600">
                                {Array.isArray(q.answer) ? q.answer.map(a => a.toUpperCase()).join(', ') : q.answer.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditQuestion(q)}
                              className="h-8 w-8 rounded-xl text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                            >
                              <FileCheck className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="h-8 w-8 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 添加题目弹窗 */}
            <Dialog open={addQuestionOpen} onOpenChange={setAddQuestionOpen}>
              <DialogContent className="max-w-[calc(100%-32px)] sm:max-w-[500px] max-h-[90vh] overflow-y-auto rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                    添加题目
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">题目类型</Label>
                    <Select
                      value={newQuestion.type}
                      onValueChange={(v) => setNewQuestion({ ...newQuestion, type: v as QuestionType })}
                    >
                      <SelectTrigger className="mt-1 rounded-xl">
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
                    <Label className="text-sm font-medium">题目内容</Label>
                    <Textarea
                      value={newQuestion.content}
                      onChange={(e) => setNewQuestion({ ...newQuestion, content: e.target.value })}
                      placeholder="请输入题目内容..."
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  
                  {newQuestion.type !== 'fill-blank' && Array.isArray(newQuestion.options) && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">选项</Label>
                      {newQuestion.options.map((opt, idx) => (
                        <div key={`new-opt-${idx}-${opt.id}`} className="flex gap-2 items-center">
                          <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-bold text-gray-500">{opt.id.toUpperCase()}</span>
                          <Input
                            value={opt.text}
                            onChange={(e) => {
                              const opts = [...(newQuestion.options || [])];
                              opts[idx] = { ...opts[idx], text: e.target.value };
                              setNewQuestion({ ...newQuestion, options: opts });
                            }}
                            placeholder={`选项 ${opt.id.toUpperCase()}`}
                            className="flex-1 rounded-xl"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div>
                    <Label className="text-sm font-medium">正确答案</Label>
                    {newQuestion.type === 'fill-blank' ? (
                      <Input
                        value={newQuestion.answer as string}
                        onChange={(e) => setNewQuestion({ ...newQuestion, answer: e.target.value })}
                        placeholder="输入正确答案"
                        className="mt-1 rounded-xl"
                      />
                    ) : newQuestion.type === 'multiple' ? (
                      <div className="flex gap-4 mt-2">
                        {['a', 'b', 'c', 'd'].map((opt) => (
                          <label key={opt} className="flex items-center gap-2 cursor-pointer">
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
                            <span className="font-medium">{opt.toUpperCase()}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <Select
                        value={newQuestion.answer as string}
                        onValueChange={(v) => setNewQuestion({ ...newQuestion, answer: v })}
                      >
                        <SelectTrigger className="mt-1 rounded-xl">
                          <SelectValue placeholder="选择正确答案" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(newQuestion.options) && newQuestion.options.map((opt, idx) => (
                            <SelectItem key={`select-opt-${idx}-${opt.id}`} value={opt.id}>
                              {opt.id.toUpperCase()}. {opt.text}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">难度</Label>
                    <Select
                      value={newQuestion.difficulty}
                      onValueChange={(v) => setNewQuestion({ ...newQuestion, difficulty: v as Difficulty })}
                    >
                      <SelectTrigger className="mt-1 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">简单</SelectItem>
                        <SelectItem value="medium">中等</SelectItem>
                        <SelectItem value="hard">困难</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button onClick={handleAddQuestion} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl">
                    保存题目
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* 编辑题目弹窗 */}
            <Dialog open={!!editingQuestion} onOpenChange={(open) => !open && setEditingQuestion(null)}>
              <DialogContent className="max-w-[calc(100%-32px)] sm:max-w-[500px] max-h-[90vh] overflow-y-auto rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                      <FileCheck className="w-5 h-5 text-white" />
                    </div>
                    编辑题目
                  </DialogTitle>
                </DialogHeader>
                {editingQuestion && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">题目类型</Label>
                      <Select
                        value={editingQuestion.type}
                        onValueChange={(v) => setEditingQuestion({ ...editingQuestion, type: v as QuestionType })}
                      >
                        <SelectTrigger className="mt-1 rounded-xl">
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
                      <Label className="text-sm font-medium">题目内容</Label>
                      <Textarea
                        value={editingQuestion.content || ''}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, content: e.target.value })}
                        placeholder="请输入题目内容"
                        className="mt-1 rounded-xl min-h-[80px]"
                      />
                    </div>
                    
                    {(editingQuestion.type === 'single' || editingQuestion.type === 'multiple') && (
                      <div>
                        <Label className="text-sm font-medium">选项</Label>
                        <div className="space-y-2 mt-1">
                          {(editingQuestion.options || []).map((opt, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-bold text-gray-500">{opt.id.toUpperCase()}</span>
                              <Input
                                value={opt.text}
                                onChange={(e) => {
                                  const newOpts = [...(editingQuestion.options || [])];
                                  newOpts[idx] = { ...newOpts[idx], text: e.target.value };
                                  setEditingQuestion({ ...editingQuestion, options: newOpts });
                                }}
                                placeholder={`选项${opt.id.toUpperCase()}`}
                                className="flex-1 rounded-xl"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <Label className="text-sm font-medium">正确答案</Label>
                      <Input
                        value={Array.isArray(editingQuestion.answer) ? editingQuestion.answer.join('') : editingQuestion.answer}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase();
                          if (val.length > 1) {
                            setEditingQuestion({ ...editingQuestion, answer: val.split('') });
                          } else {
                            setEditingQuestion({ ...editingQuestion, answer: val });
                          }
                        }}
                        placeholder="如 A 或 ABC"
                        className="mt-1 rounded-xl"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">解析（可选）</Label>
                      <Textarea
                        value={editingQuestion.explanation || ''}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                        placeholder="请输入题目解析"
                        className="mt-1 rounded-xl"
                      />
                    </div>
                    
                    <Button onClick={handleSaveEditQuestion} className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl">
                      保存修改
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* 统计页面 - Duolingo 风格 */}
          <TabsContent value="stats">
            <div className="space-y-4">
              {/* 统计卡片网格 */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                  <CardContent className="p-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-blue-200">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{getStats().totalCount}</p>
                    <p className="text-sm text-gray-400">总练习</p>
                  </CardContent>
                </Card>
                
                <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                  <CardContent className="p-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-emerald-200">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{getStats().correctCount}</p>
                    <p className="text-sm text-gray-400">正确</p>
                  </CardContent>
                </Card>
                
                <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                  <CardContent className="p-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-red-200">
                      <X className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{getStats().wrongCount}</p>
                    <p className="text-sm text-gray-400">错误</p>
                  </CardContent>
                </Card>
                
                <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                  <CardContent className="p-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-500 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-purple-200">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{getStats().accuracy}%</p>
                    <p className="text-sm text-gray-400">正确率</p>
                  </CardContent>
                </Card>
              </div>

              {/* 趋势图表区域 */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="pb-2 bg-gradient-to-r from-purple-50 to-pink-50">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-white" />
                    </div>
                    正确率趋势
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] flex items-center justify-center text-gray-400">
                    <div className="text-center px-4">
                      <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center">
                        <BarChart3 className="w-8 h-8 text-gray-300" />
                      </div>
                      <p className="text-sm">开始刷题后显示趋势</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
