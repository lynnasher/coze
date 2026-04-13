'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuiz } from '@/hooks/use-quiz';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Trash2,
  FileText,
  FileCheck,
  Grid3X3,
  ArrowLeft,
  TrendingUp,
  RotateCcw,
  BookMarked
} from 'lucide-react';
import { questionStore, recordStore, bankStore, generateId } from '@/lib/quiz-store';
import { Question, QuestionType, Difficulty } from '@/lib/types';

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
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('practice');
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // 题库管理状态
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
    }
  };
  
  // 清空所有题库和题目
  const handleClearAll = () => {
    if (confirm('确定要清空所有题库和题目吗？\n此操作不可恢复！')) {
      questionStore.clear();
      bankStore.clear();
      recordStore.clear();
      loadQuestions();
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
            className="min-h-[60px] sm:min-h-[100px] rounded-xl sm:rounded-2xl border-2 border-gray-200 focus:border-orange-300 bg-white text-sm sm:text-base"
          />
        </div>
      );
    }
    
    const getOptionStyle = (isSelected: boolean, isCorrectAnswer: boolean, showResult: boolean) => {
      if (showResult) {
        if (isSelected && isCorrectAnswer) {
          return 'border-emerald-400 bg-emerald-50';
        }
        if (isSelected && !isCorrectAnswer) {
          return 'border-red-400 bg-red-50';
        }
        if (isCorrectAnswer) {
          return 'border-emerald-300 bg-emerald-25';
        }
      }
      if (isSelected) {
        return 'border-orange-400 bg-orange-50';
      }
      return 'border-gray-200 bg-white hover:border-orange-200';
    };
    
    if (currentQuestion.type === 'true-false') {
      const defaultOptions = currentQuestion.options?.length === 2 
        ? currentQuestion.options 
        : [
            { id: 'a', text: '正确' },
            { id: 'b', text: '错误' }
          ];
      
      return (
        <div className="grid grid-cols-2 gap-3">
          {defaultOptions.map((option, index) => {
            const isCorrectAnswer = currentQuestion.answer === option.id;
            const isSelected = currentAnswer === option.id;
            
            return (
              <div
                key={`tf-${index}-${option.id}`}
                className={`flex items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${getOptionStyle(isSelected, isCorrectAnswer, quizState.showResult)}`}
                onClick={() => !quizState.showResult && handleTrueFalseSelect(option.id)}
              >
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center mr-2 sm:mr-3 font-bold text-sm sm:text-base transition-colors ${
                  isSelected 
                    ? quizState.showResult 
                      ? isCorrectAnswer 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-red-500 text-white'
                      : 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {isSelected ? (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    option.id.toUpperCase()
                  )}
                </div>
                <span className="flex-1 text-sm sm:text-base font-medium">{option.text}</span>
                {quizState.showResult && isCorrectAnswer && (
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
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
                <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center mr-2 sm:mr-3 font-bold text-xs sm:text-base transition-colors ${
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
                <span className="flex-1 text-xs sm:text-base font-medium leading-tight">{option.text}</span>
                {quizState.showResult && isCorrectAnswer && (
                  <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-emerald-500 flex items-center justify-center ml-1">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                )}
                {quizState.showResult && isSelected && !isCorrectAnswer && (
                  <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-red-500 flex items-center justify-center ml-1">
                    <X className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-gray-400 mt-1 sm:mt-2">* 此题为多选题，可选择多个答案</p>
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
              <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center mr-2 sm:mr-3 font-bold text-xs sm:text-base transition-colors ${
                isSelected 
                  ? quizState.showResult 
                    ? isCorrectAnswer 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-red-500 text-white'
                    : 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {isSelected ? (
                  <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  option.id.toUpperCase()
                )}
              </div>
              <span className="flex-1 text-xs sm:text-base font-medium leading-tight">{option.text}</span>
              {quizState.showResult && isCorrectAnswer && (
                <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-emerald-500 flex items-center justify-center ml-1">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
              )}
              {quizState.showResult && isSelected && !isCorrectAnswer && (
                <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-red-500 flex items-center justify-center ml-1">
                  <X className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-white" />
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
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
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
        {/* 当 hasStarted 为 true 时，隐藏 Tabs，直接显示练习页面 */}
        {hasStarted ? (
          <PracticeView />
        ) : (
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
              <div className="min-h-screen sm:-mx-4">
                {/* 顶部导航栏 - 超精简版 */}
                <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 text-white px-2 py-2 sm:px-4 sm:py-4 sticky top-0 z-20 rounded-b-3xl shadow-lg">
                  <div className="flex items-center justify-between">
                    {/* 退出按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('确定要退出练习吗？')) {
                          setHasStarted(false);
                          setPracticeBankId(null);
                        }
                      }}
                      className="text-white hover:bg-white/20 rounded-lg px-2 h-8"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    
                    {/* 进度信息 */}
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                      {quizState.currentIndex + 1}/{quizState.questions.length}
                    </span>
                    
                    {/* 右侧按钮组 */}
                    <div className="flex items-center gap-1">
                      {/* 答题卡按钮 */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAnswerSheet(true)}
                        className="text-white hover:bg-white/20 rounded-lg px-2 h-8"
                      >
                        <Grid3X3 className="w-4 h-4" />
                      </Button>
                      
                      {/* 交卷按钮 */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('确定要交卷吗？')) {
                            finishQuiz();
                          }
                        }}
                        className="text-white hover:bg-white/20 rounded-lg px-3 h-8 font-medium"
                      >
                        <FileCheck className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 题目内容区域 */}
                <div className="pb-24 sm:pb-32">
                  {currentQuestion && (
                    <div>
                      {/* 题干 - 显眼设计 + 固定顶部 */}
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-b border-orange-100 sticky top-[56px] sm:top-[56px] z-10 shadow-sm">
                        <div className="max-w-2xl mx-auto px-4 py-3 sm:py-4">
                          {/* 题型标签 + 题号 */}
                          <div className="mb-2 flex items-center gap-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                              currentQuestion.type === 'single' ? 'bg-blue-500 text-white' :
                              currentQuestion.type === 'multiple' ? 'bg-purple-500 text-white' :
                              currentQuestion.type === 'true-false' ? 'bg-orange-500 text-white' :
                              currentQuestion.type === 'comprehensive' ? 'bg-red-500 text-white' :
                              'bg-green-500 text-white'
                            }`}>
                              {currentQuestion.type === 'single' ? '单选' :
                               currentQuestion.type === 'multiple' ? '多选' :
                               currentQuestion.type === 'true-false' ? '判断' :
                               currentQuestion.type === 'comprehensive' ? '综合' : '填空'}
                            </span>
                            <span className="text-xs text-gray-500 font-medium">
                              第 {quizState.currentIndex + 1} 题 / 共 {quizState.questions.length} 题
                            </span>
                          </div>
                          
                          {/* 综合题背景材料 */}
                          {currentQuestion.parentId && (
                            <div className="bg-white border border-amber-200 rounded-xl p-3 sm:p-4 mb-3">
                              <div className="flex items-center gap-2 text-amber-600 mb-2">
                                <BookMarked className="w-4 h-4" />
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
                          
                          <p className="text-base sm:text-xl text-gray-800 leading-relaxed font-semibold">
                            {currentQuestion.content}
                          </p>
                        </div>
                      </div>
                      
                      {/* 选项列表 */}
                      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-1.5 sm:space-y-3">
                        {renderOptions()}
                      </div>
                      
                      {/* 答案与解析 - 精简版 */}
                      {quizState.showResult && (
                        <div className="max-w-2xl mx-auto px-4 sm:px-0 mt-3 sm:mt-4 space-y-2 sm:space-y-3">
                          {/* 结果卡片 */}
                          <div className={`rounded-xl p-3 sm:p-4 ${isAnswerCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${isAnswerCorrect ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                  {isAnswerCorrect ? <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> : <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
                                </div>
                                <span className={`text-sm sm:text-base font-bold ${isAnswerCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {isAnswerCorrect ? '太棒了！' : '再接再厉！'}
                                </span>
                              </div>
                              <div className="bg-white rounded-lg px-2 py-1 sm:px-3 sm:py-1">
                                <span className="text-xs sm:text-sm text-gray-500">答案：</span>
                                <span className="text-sm sm:text-lg font-bold text-emerald-600 ml-1">
                                  {Array.isArray(currentQuestion.answer) 
                                    ? currentQuestion.answer.map(a => a.toUpperCase()).join(', ')
                                    : currentQuestion.answer.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* 解析 */}
                          {currentQuestion.explanation && (
                            <div className="bg-amber-50 rounded-xl p-2 sm:p-3 border border-amber-200">
                              <div className="flex items-center gap-1 sm:gap-2 text-amber-700 mb-1">
                                <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="font-semibold text-xs sm:text-sm">解析</span>
                              </div>
                              <p className="text-amber-900 text-xs sm:text-sm leading-relaxed">
                                {currentQuestion.explanation}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 底部固定操作栏 - 超精简版 */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 sm:static sm:max-w-2xl sm:mx-auto sm:mt-4 sm:bg-transparent sm:border-0 sm:p-0 sm:shadow-none">
                  <div className="flex items-center justify-between gap-1 sm:gap-2 max-w-2xl mx-auto">
                    {/* 上一题 */}
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (quizState.currentIndex > 0) {
                          prevQuestion();
                          setTimeout(() => {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }, 50);
                        }
                      }}
                      disabled={quizState.currentIndex === 0}
                      className="h-10 sm:h-11 px-2 rounded-lg border border-gray-200 flex-shrink-0"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline ml-1 text-sm">上一题</span>
                    </Button>
                    
                    {/* 查看解析 */}
                    {currentAnswer && !quizState.showResult && (
                      <Button
                        onClick={submitAnswer}
                        className="h-10 sm:h-11 px-2 sm:px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-medium text-sm sm:font-semibold flex-1 sm:flex-none"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span className="ml-1 sm:ml-2 text-xs sm:text-sm">查看解析</span>
                      </Button>
                    )}
                    
                    {/* 结果提示 */}
                    {quizState.showResult && (
                      <div className={`h-10 sm:h-11 flex items-center justify-center px-2 sm:px-3 rounded-xl font-medium text-sm ${
                        isAnswerCorrect 
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                          : 'bg-red-100 text-red-700 border border-red-300'
                      }`}>
                        {isAnswerCorrect ? (
                          <Check className="w-4 h-4 mr-1" />
                        ) : (
                          <X className="w-4 h-4 mr-1" />
                        )}
                        <span className="text-xs sm:text-sm">{isAnswerCorrect ? '正确' : '错误'}</span>
                      </div>
                    )}

                    {/* 下一题 / 交卷 */}
                    {quizState.currentIndex === quizState.questions.length - 1 ? (
                      <Button
                        onClick={() => finishQuiz()}
                        className="h-10 sm:h-11 px-2 sm:px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl flex-1 sm:flex-none"
                      >
                        <FileCheck className="w-4 h-4" />
                        <span className="ml-1 sm:ml-2 text-xs sm:text-sm">交卷</span>
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          if (currentAnswer && !quizState.showResult) {
                            submitAnswer();
                          }
                          nextQuestion();
                          setTimeout(() => {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }, 50);
                        }}
                        className="h-10 sm:h-11 px-2 sm:px-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl flex-1 sm:flex-none"
                      >
                        <span className="text-xs sm:text-sm">下一题</span>
                        <ChevronRight className="w-4 h-4 ml-1" />
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
                      {/* 按题型分组显示 */}
                      {['single', 'multiple', 'true-false', 'fill-blank', 'comprehensive'].map(type => {
                        const typeQuestions = quizState.questions
                          .map((q, idx) => ({ q, idx }))
                          .filter(item => item.q.type === type);
                        
                        if (typeQuestions.length === 0) return null;
                        
                        const typeLabel = type === 'single' ? '单选题' : 
                                         type === 'multiple' ? '多选题' : 
                                         type === 'true-false' ? '判断题' : 
                                         type === 'fill-blank' ? '填空题' : '综合题';
                        const typeColor = type === 'single' ? 'bg-blue-500' : 
                                         type === 'multiple' ? 'bg-purple-500' : 
                                         type === 'true-false' ? 'bg-orange-500' : 
                                         type === 'fill-blank' ? 'bg-green-500' : 'bg-red-500';
                        
                        return (
                          <div key={type}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`w-2 h-2 rounded-full ${typeColor}`}></span>
                              <span className="text-sm font-medium text-gray-700">{typeLabel}</span>
                              <span className="text-xs text-gray-400">({typeQuestions.length}题)</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {typeQuestions.map(({ q, idx }) => {
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
                                    className={`w-9 h-9 rounded-xl text-sm font-bold transition-all flex items-center justify-center ${
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
                          </div>
                        );
                      })}
                      
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
              /* 练习开始页面 - 题库管理风格 */
              <div className="space-y-5">
                {/* 题库选择区域 - 卡片列表 */}
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                      <Library className="w-4 h-4 text-white" />
                    </div>
                    选择题库
                  </h2>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 全部题目卡片 */}
                    <Card 
                      className={`cursor-pointer transition-all border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl ${
                        practiceBankId === null ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setPracticeBankId(null)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-gray-900 leading-tight mb-1">全部题目</h3>
                            <div className="flex items-center gap-1 text-sm text-gray-400">
                              <BookOpen className="w-3 h-3" />
                              <span>{questions.length} 道题</span>
                            </div>
                          </div>
                          {practiceBankId === null && (
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* 题库卡片 */}
                    {banks.map((bank) => {
                      const bankQuestions = questions.filter(q => q.bankId === bank.id);
                      const isSelected = practiceBankId === bank.id;
                      return (
                        <Card 
                          key={bank.id}
                          className={`cursor-pointer transition-all border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl ${
                            isSelected ? 'ring-2 ring-blue-500' : ''
                          }`}
                          onClick={() => setPracticeBankId(bank.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-base font-semibold text-gray-900 leading-tight line-clamp-2">{bank.name}</h3>
                                <div className="flex items-center gap-3 text-sm text-gray-400">
                                  <span className="flex items-center gap-1">
                                    <BookOpen className="w-3 h-3" />
                                    {bankQuestions.length} 道题
                                  </span>
                                  <span>{new Date(bank.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                              {isSelected && (
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                                  <Check className="w-4 h-4 text-white" />
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
                
                {/* 练习模式选择 - 简约卡片 */}
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                      <Play className="w-4 h-4 text-white" />
                    </div>
                    选择练习模式
                    <span className="text-sm font-normal text-gray-400 ml-2">
                      共 {practiceBankId ? questions.filter(q => q.bankId === practiceBankId).length : questions.length} 道题
                    </span>
                  </h2>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 顺序练习 */}
                    <Card 
                      className="cursor-pointer transition-all border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl hover:scale-[1.02]"
                      onClick={() => startQuiz('sequential', practiceBankId)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Target className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">顺序练习</h3>
                            <p className="text-xs text-gray-400">按顺序逐一攻克</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* 随机练习 */}
                    <Card 
                      className="cursor-pointer transition-all border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl hover:scale-[1.02]"
                      onClick={() => startQuiz('random', practiceBankId)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <RefreshCw className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">随机练习</h3>
                            <p className="text-xs text-gray-400">打乱顺序挑战自我</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* 错题重练 */}
                    <Card 
                      className="cursor-pointer transition-all border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl hover:scale-[1.02]"
                      onClick={() => startQuiz('wrong', practiceBankId)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Star className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">错题重练</h3>
                            <p className="text-xs text-gray-400">专攻易错题目</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
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
              {banks.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleClearAll}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">清空</span>
                </Button>
              )}
            </div>

            {/* 题库列表 */}
            <div className="space-y-4">
              {banks.length === 0 ? (
                <Card className="bg-gradient-to-br from-gray-50 to-white border-dashed border-2 rounded-2xl">
                  <CardContent className="py-10 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center">
                      <Library className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500">暂无题库，请先导入题库</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {banks.map((bank) => (
                    <Card key={bank.id} className="overflow-hidden border-0 shadow-lg rounded-2xl hover:shadow-xl transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 leading-tight line-clamp-2">
                              {bank.name}
                            </h4>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteBank(bank.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            {bank.questionIds.length} 道题
                          </span>
                          <span>{new Date(bank.createdAt).toLocaleDateString()}</span>
                        </div>
                        
                        <Button
                          size="sm"
                          className="w-full h-9 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-xl"
                          onClick={() => {
                            setPracticeBankId(bank.id);
                            setActiveTab('practice');
                            setTimeout(() => startQuiz('sequential', bank.id), 100);
                          }}
                          disabled={bank.questionIds.length === 0}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          开始练习
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
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
        )}
      </main>
    </div>
  );
}

// 练习页面组件 - 无 Tabs，简洁设计
function PracticeView() {
  const {
    quizState,
    currentQuestion,
    currentAnswer,
    isAnswerCorrect,
    isLoading,
    hasStarted,
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
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [practiceBankId, setPracticeBankId] = useState<string | null>(null);
  
  const isCurrentCorrect = useMemo(() => {
    if (!currentQuestion || !currentAnswer) return false;
    if (Array.isArray(currentQuestion.answer)) {
      return Array.isArray(currentAnswer) && 
        currentQuestion.answer.every(a => currentAnswer.includes(a));
    }
    return currentAnswer === currentQuestion.answer;
  }, [currentQuestion, currentAnswer]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl flex items-center justify-center animate-pulse">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <p className="text-gray-600 font-medium">加载中...</p>
        </div>
      </div>
    );
  }

  if (quizState.isComplete) {
    return (
      <div className="min-h-screen -mx-4 sm:mx-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-orange-50 to-white pointer-events-none" />
          <div className="relative z-10">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl flex items-center justify-center shadow-xl shadow-amber-200 animate-bounce">
              <Trophy className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">练习完成!</h2>
            <p className="text-gray-500 mb-8">你已完成本次练习，继续加油！</p>
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
            <div className="flex gap-3">
              <Button 
                onClick={() => restartQuiz()} 
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                再练一次
              </Button>
              <Button 
                onClick={() => {
                  setHasStarted(false);
                  setPracticeBankId(null);
                }} 
                variant="outline"
                className="flex-1 border-2 border-gray-200 rounded-xl"
              >
                返回主页
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">正在加载题目...</p>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:mx-0">
      {/* 顶部导航栏 - 简洁设计 */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 text-white px-3 py-3 sticky top-0 z-20 rounded-b-2xl shadow-lg">
        <div className="flex items-center justify-between">
          {/* 返回按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('确定要退出练习吗？')) {
                setHasStarted(false);
                setPracticeBankId(null);
              }
            }}
            className="bg-white/20 hover:bg-white/30 text-white rounded-xl px-3 h-10 gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">返回</span>
          </Button>
          
          {/* 进度信息 - 橙色胶囊 */}
          <div className="bg-white/25 px-4 py-1.5 rounded-full">
            <span className="text-sm font-bold">
              {quizState.currentIndex + 1}/{quizState.questions.length}
            </span>
          </div>
          
          {/* 答题卡按钮 */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowAnswerSheet(true)}
            className="bg-white/20 hover:bg-white/30 text-white rounded-xl px-3 h-10"
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 题目内容区域 */}
      <div className="pb-24 sm:pb-32">
        {/* 题干 */}
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-b border-orange-100 sticky top-[56px] sm:top-[56px] z-10 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 sm:py-4">
            <div className="mb-2 flex items-center gap-2">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                currentQuestion.type === 'single' ? 'bg-blue-500 text-white' :
                currentQuestion.type === 'multiple' ? 'bg-purple-500 text-white' :
                currentQuestion.type === 'true-false' ? 'bg-orange-500 text-white' :
                currentQuestion.type === 'comprehensive' ? 'bg-red-500 text-white' :
                'bg-green-500 text-white'
              }`}>
                {currentQuestion.type === 'single' ? '单选' :
                 currentQuestion.type === 'multiple' ? '多选' :
                 currentQuestion.type === 'true-false' ? '判断' :
                 currentQuestion.type === 'comprehensive' ? '综合' : '填空'}
              </span>
              <span className="text-xs text-gray-500 font-medium">
                第 {quizState.currentIndex + 1} 题 / 共 {quizState.questions.length} 题
              </span>
            </div>
            <p className="text-base sm:text-lg font-semibold text-gray-800 leading-relaxed">
              {currentQuestion.content}
            </p>
          </div>
        </div>

        {/* 选项区域 */}
        <div className="max-w-2xl mx-auto px-4 py-4">
          {/* 选项列表 */}
          <div className="space-y-3">
            {currentQuestion.options?.map((option, index) => {
              const isSelected = Array.isArray(currentAnswer) 
                ? currentAnswer.includes(option.id)
                : currentAnswer === option.id;
              const isCorrectAnswer = Array.isArray(currentQuestion.answer)
                ? currentQuestion.answer.includes(option.id)
                : currentQuestion.answer === option.id;
              
              let optionStyle = 'bg-white border-gray-200 hover:border-orange-300';
              if (isSelected) {
                optionStyle = quizState.showResult
                  ? isCorrectAnswer
                    ? 'bg-emerald-50 border-emerald-500'
                    : 'bg-red-50 border-red-500'
                  : 'bg-orange-50 border-orange-500';
              }
              if (quizState.showResult && isCorrectAnswer) {
                optionStyle = 'bg-emerald-50 border-emerald-500';
              }
              
              return (
                <div
                  key={option.id}
                  className={`flex items-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${optionStyle}`}
                  onClick={() => !quizState.showResult && selectAnswer(currentQuestion.id, option.id)}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 font-bold text-sm ${
                    isSelected
                      ? quizState.showResult
                        ? isCorrectAnswer
                          ? 'bg-emerald-500 text-white'
                          : 'bg-red-500 text-white'
                        : 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {isSelected ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      String.fromCharCode(65 + index)
                    )}
                  </div>
                  <span className="flex-1 text-sm font-medium">{option.text}</span>
                  {quizState.showResult && isCorrectAnswer && (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center ml-2">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  {quizState.showResult && isSelected && !isCorrectAnswer && (
                    <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center ml-2">
                      <X className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 答案反馈 */}
          {quizState.showResult && (
            <div className="mt-4 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  isCurrentCorrect ? 'bg-emerald-500' : 'bg-red-500'
                }`}>
                  {isCurrentCorrect ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <X className="w-4 h-4 text-white" />
                  )}
                </div>
                <span className={`font-bold ${
                  isCurrentCorrect ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  {isCurrentCorrect ? '回答正确!' : '回答错误'}
                </span>
              </div>
              {currentQuestion.explanation && (
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-semibold">解析：</span>
                  {currentQuestion.explanation}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 底部固定操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 z-30">
        <div className="flex items-center justify-between gap-1 max-w-2xl mx-auto">
          {/* 上一题 */}
          <Button
            variant="outline"
            onClick={() => {
              if (quizState.currentIndex > 0) {
                prevQuestion();
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
              }
            }}
            disabled={quizState.currentIndex === 0}
            className="h-10 px-2 rounded-lg border border-gray-200 flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline ml-1 text-sm">上一题</span>
          </Button>
          
          {/* 查看解析 */}
          {currentAnswer && !quizState.showResult && (
            <Button
              onClick={() => submitAnswer()}
              className="h-10 px-2 sm:px-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-medium text-xs sm:text-sm flex-1 sm:flex-none"
            >
              <BookOpen className="w-4 h-4" />
              <span className="ml-1 text-xs sm:text-sm">查看解析</span>
            </Button>
          )}
          
          {/* 结果提示 */}
          {quizState.showResult && (
            <div className={`h-10 flex items-center justify-center px-2 sm:px-3 rounded-xl font-medium text-xs sm:text-sm ${
              isCurrentCorrect 
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                : 'bg-red-100 text-red-700 border border-red-300'
            }`}>
              {isCurrentCorrect ? (
                <Check className="w-4 h-4 mr-1" />
              ) : (
                <X className="w-4 h-4 mr-1" />
              )}
              <span>{isCurrentCorrect ? '正确' : '错误'}</span>
            </div>
          )}

          {/* 答题卡按钮 */}
          <Button
            variant="outline"
            onClick={() => setShowAnswerSheet(true)}
            className="h-10 px-2 sm:px-3 rounded-lg border border-gray-200 flex-shrink-0"
          >
            <Grid3X3 className="w-4 h-4" />
            <span className="hidden sm:inline ml-1 text-sm">答题卡</span>
          </Button>

          {/* 下一题 / 交卷 */}
          {quizState.currentIndex === quizState.questions.length - 1 ? (
            <Button
              onClick={() => finishQuiz()}
              className="h-10 px-2 sm:px-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl flex-1 sm:flex-none"
            >
              <FileCheck className="w-4 h-4" />
              <span className="ml-1 text-xs sm:text-sm">交卷</span>
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (currentAnswer && !quizState.showResult) {
                  submitAnswer();
                }
                nextQuestion();
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
              }}
              className="h-10 px-2 sm:px-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl flex-1 sm:flex-none"
            >
              <span className="text-xs sm:text-sm">下一题</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* 答题卡弹窗 */}
      <Dialog open={showAnswerSheet} onOpenChange={setShowAnswerSheet}>
        <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[80vh] overflow-y-auto rounded-2xl p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <Grid3X3 className="w-4 h-4 text-white" />
                </div>
                答题卡
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAnswerSheet(false)}
                className="h-8 w-8 p-0 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {['single', 'multiple', 'true-false', 'fill-blank', 'comprehensive'].map(type => {
              const typeQuestions = quizState.questions
                .map((q, idx) => ({ q, idx }))
                .filter(item => item.q.type === type);
              if (typeQuestions.length === 0) return null;
              const typeLabel = type === 'single' ? '单选题' : 
                               type === 'multiple' ? '多选题' : 
                               type === 'true-false' ? '判断题' : 
                               type === 'fill-blank' ? '填空题' : '综合题';
              const typeColor = type === 'single' ? 'bg-blue-500' : 
                               type === 'multiple' ? 'bg-purple-500' : 
                               type === 'true-false' ? 'bg-orange-500' : 
                               type === 'fill-blank' ? 'bg-green-500' : 'bg-red-500';
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${typeColor}`}></span>
                    <span className="text-sm font-medium text-gray-700">{typeLabel}</span>
                    <span className="text-xs text-gray-400">({typeQuestions.length}题)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {typeQuestions.map(({ q, idx }) => {
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
                          className={`w-9 h-9 rounded-xl text-sm font-bold transition-all flex items-center justify-center ${
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
                </div>
              );
            })}
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
  );
}
