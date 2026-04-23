'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Library, Folder, FolderOpen, User, BookOpen, ChevronRight } from 'lucide-react';
import { bankStore, questionStore, recordStore } from '@/lib/quiz-store';
import { Question, Category } from '@/lib/types';
import { BankCard } from '@/components/BankCard';
import { AuthModal } from '@/components/AuthModal';
import { useApp } from '@/components/providers/AppProviders';
import { useQuiz } from '@/hooks/use-quiz';
import { QuizCard } from '@/components/quiz/QuizCard';
import { AnswerSheet } from '@/components/quiz/AnswerSheet';
import { ResultModal } from '@/components/quiz/ResultModal';
import { PracticeHeader } from '@/components/quiz/PracticeHeader';
import { QuizControls } from '@/components/quiz/QuizControls';

interface Bank {
  id: string;
  name: string;
  description?: string;
  questionCount: number;
  categoryId?: string;
  createdAt: number;
}

export default function LibraryPage() {
  const { currentUser, authModalOpen, setAuthModalOpen, refreshUser, mounted, setIsPracticing } = useApp();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 练习模式状态
  const [practiceBankId, setPracticeBankId] = useState<string | null>(null);
  
  const {
    quizState,
    currentQuestion,
    currentAnswer,
    isAnswerCorrect,
    isLoading: isQuizLoading,
    hasStarted,
    startQuiz,
    selectAnswer,
    nextQuestion,
    prevQuestion,
    submitAnswer,
    finishQuiz,
    goToQuestion,
    restartQuiz,
    resetQuiz,
  } = useQuiz();

  // 加载题库和分类数据
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/banks');
      if (response.ok) {
        const data = await response.json();
        if (data.banks) {
          const mappedBanks: Bank[] = data.banks.map((b: typeof data.banks[0]) => ({
            id: b.id,
            name: b.name,
            description: b.description,
            questionCount: b.question_count || 0,
            categoryId: b.category_id,
            createdAt: Date.now(),
          }));
          setBanks(mappedBanks);
        }
      }

      const catResponse = await fetch('/api/categories');
      if (catResponse.ok) {
        const catData = await catResponse.json();
        if (catData.categories) {
          setCategories(catData.categories);
        }
      }

      const questionsResponse = await fetch('/api/questions');
      if (questionsResponse.ok) {
        const questionsData = await questionsResponse.json();
        if (questionsData.questions) {
          questionStore.save(questionsData.questions);
        }
      }
    } catch (error) {
      console.error('Failed to load library data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    refreshUser();
  }, [loadData, refreshUser]);

  // 同步做题状态到全局
  useEffect(() => {
    setIsPracticing(hasStarted);
  }, [hasStarted, setIsPracticing]);

  // 处理开始练习
  const handleStartPractice = (bankId: string) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    setPracticeBankId(bankId);
    startQuiz('sequential', bankId);
  };

  // 练习页面
  if (hasStarted && currentQuestion) {
    return (
      <PracticeView
        onExit={() => {
          resetQuiz();
          setPracticeBankId(null);
        }}
        quizState={quizState}
        currentQuestion={currentQuestion}
        currentAnswer={currentAnswer}
        isAnswerCorrect={isAnswerCorrect}
        selectAnswer={selectAnswer}
        nextQuestion={nextQuestion}
        prevQuestion={prevQuestion}
        submitAnswer={submitAnswer}
        finishQuiz={finishQuiz}
        goToQuestion={goToQuestion}
        restartQuiz={restartQuiz}
        resetQuiz={resetQuiz}
      />
    );
  }

  // 题库浏览页面
  return (
    <main className="max-w-[970px] mx-auto px-4 py-6">
      {/* 页面标题 */}
      <div className="mb-6 relative overflow-hidden">
        <div className="bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 rounded-2xl p-4 shadow-sm">
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/30 rounded-full"></div>
          <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/30 rounded-full"></div>
          
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 bg-white/60 backdrop-blur rounded-xl flex items-center justify-center shadow-sm">
              <Library className="w-5 h-5 text-slate-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-slate-700 tracking-tight">题库浏览</h1>
              <p className="text-slate-500 text-xs mt-0.5">选择分类开始练习</p>
            </div>
            {currentUser && (
              <div className="px-2.5 py-1 bg-white/50 backdrop-blur rounded-full">
                <span className="text-slate-600 text-xs font-medium">
                  {currentUser.activatedCategories?.length || 0} 个分类
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 未登录提示 */}
      {!currentUser && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-200 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900">登录后查看已激活的题库</h4>
              <p className="text-xs text-gray-600 mt-0.5">请先登录以查看和练习题库</p>
            </div>
            <Button 
              size="sm" 
              className="rounded-xl bg-blue-600 hover:bg-blue-700"
              onClick={() => setAuthModalOpen(true)}
            >
              登录
            </Button>
          </div>
        </div>
      )}

      {/* 已登录但无激活分类提示 */}
      {currentUser && (currentUser.activatedCategories?.length === 0) && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-200 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900">暂无激活的题库分类</h4>
              <p className="text-xs text-gray-600 mt-0.5">请联系管理员获取激活码来解锁题库</p>
            </div>
          </div>
        </div>
      )}

      {/* 题库列表 */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-slate-400 text-sm">加载中...</div>
          </div>
        ) : banks.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
            <div className="w-14 h-14 mx-auto mb-3 bg-gray-50 rounded-2xl flex items-center justify-center">
              <Library className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm text-gray-500 font-medium">暂无题库</p>
            <p className="text-xs text-gray-400 mt-1">请联系管理员导入</p>
          </div>
        ) : (
          <LibraryContent 
            banks={banks}
            categories={categories}
            currentUser={currentUser}
            selectedCategoryId={selectedCategoryId}
            onCategoryToggle={setSelectedCategoryId}
            onStartPractice={handleStartPractice}
          />
        )}
      </div>

      {/* 底部安全间距 */}
      <div className="h-8"></div>

      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onAuthChange={refreshUser}
      />
    </main>
  );
}

// 题库内容组件
interface LibraryContentProps {
  banks: Bank[];
  categories: Category[];
  currentUser: { activatedCategories?: string[] } | null;
  selectedCategoryId: string | null;
  onCategoryToggle: (id: string | null) => void;
  onStartPractice: (bankId: string) => void;
}

function LibraryContent({ banks, categories, currentUser, selectedCategoryId, onCategoryToggle, onStartPractice }: LibraryContentProps) {
  // 未分类题库
  const uncategorizedBanks = banks.filter(b => !b.categoryId);
  
  // 获取用户激活的分类
  const activatedCategoryIds = currentUser?.activatedCategories || [];
  const activatedCategories = categories.filter(c => activatedCategoryIds.includes(c.id));
  
  return (
    <>
      {/* 未分类题库 */}
      {uncategorizedBanks.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <FolderOpen className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">未分类</h3>
            <span className="text-xs text-slate-400 ml-auto">
              ({uncategorizedBanks.length} 题库)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {uncategorizedBanks.map((bank) => (
              <BankCard 
                key={bank.id} 
                bank={bank} 
                onStartPractice={() => onStartPractice(bank.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 按分类显示题库 */}
      {activatedCategories.length > 0 && (
        <CategoryBanks 
          banks={banks}
          categories={activatedCategories}
          allCategories={categories}
          selectedCategoryId={selectedCategoryId}
          onCategoryToggle={onCategoryToggle}
          onStartPractice={onStartPractice}
        />
      )}
    </>
  );
}

// 分类题库组件
interface CategoryBanksProps {
  banks: Bank[];
  categories: Category[];
  allCategories: Category[];
  selectedCategoryId: string | null;
  onCategoryToggle: (id: string | null) => void;
  onStartPractice: (bankId: string) => void;
}

function CategoryBanks({ banks, categories, allCategories, selectedCategoryId, onCategoryToggle, onStartPractice }: CategoryBanksProps) {
  // 分离顶级分类和子分类
  const topCategories = categories.filter(c => !c.parentId);
  const childCategories = categories.filter(c => c.parentId);
  
  // 将子分类按父分类分组
  const childCategoriesByParent = new Map<string, typeof childCategories>();
  childCategories.forEach(cat => {
    const parentId = cat.parentId!;
    if (!childCategoriesByParent.has(parentId)) {
      childCategoriesByParent.set(parentId, []);
    }
    childCategoriesByParent.get(parentId)!.push(cat);
  });

  return (
    <>
      {/* 显示激活的子分类 */}
      {Array.from(childCategoriesByParent.entries()).map(([parentId, children]) => {
        const parentCategory = allCategories.find(c => c.id === parentId);
        return (
          <div key={`parent-${parentId}`} className="mb-4">
            {parentCategory && (
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <Folder className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">
                  {parentCategory.name}
                </span>
              </div>
            )}
            <div className="space-y-2">
              {children.map(category => {
                const categoryBanks = banks.filter(b => b.categoryId === category.id);
                if (categoryBanks.length === 0) return null;
                
                return (
                  <CategorySection
                    key={category.id}
                    category={category}
                    banks={categoryBanks}
                    isExpanded={selectedCategoryId === category.id}
                    onToggle={() => onCategoryToggle(selectedCategoryId === category.id ? null : category.id)}
                    onStartPractice={onStartPractice}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      
      {/* 显示激活的顶级分类 */}
      {topCategories.map(category => {
        const categoryBanks = banks.filter(b => b.categoryId === category.id);
        const activatedChildCategories = childCategoriesByParent.get(category.id) || [];
        const childCategoryIds = activatedChildCategories.map(c => c.id);
        const childCategoryBanks = banks.filter(b => childCategoryIds.includes(b.categoryId || ''));
        
        if (categoryBanks.length === 0 && childCategoryBanks.length === 0) return null;
        
        return (
          <TopCategorySection
            key={category.id}
            category={category}
            banks={categoryBanks}
            childCategories={activatedChildCategories}
            childBanks={childCategoryBanks}
            allBanks={banks}
            isExpanded={selectedCategoryId === category.id}
            onToggle={() => onCategoryToggle(selectedCategoryId === category.id ? null : category.id)}
            onStartPractice={onStartPractice}
          />
        );
      })}
    </>
  );
}

// 分类区块组件
interface CategorySectionProps {
  category: Category;
  banks: Bank[];
  isExpanded: boolean;
  onToggle: () => void;
  onStartPractice: (bankId: string) => void;
}

function CategorySection({ category, banks, isExpanded, onToggle, onStartPractice }: CategorySectionProps) {
  return (
    <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
      <div 
        className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-3 -m-2 rounded-xl transition-all duration-200"
        onClick={onToggle}
      >
        {isExpanded ? (
          <FolderOpen className="w-4 h-4 text-slate-500" />
        ) : (
          <Folder className="w-4 h-4 text-slate-400" />
        )}
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg tracking-wide ${
          category.color === 'blue' ? 'bg-blue-100 text-blue-700' :
          category.color === 'green' ? 'bg-green-100 text-green-700' :
          category.color === 'red' ? 'bg-red-100 text-red-700' :
          category.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
          category.color === 'purple' ? 'bg-purple-100 text-purple-700' :
          category.color === 'pink' ? 'bg-pink-100 text-pink-700' :
          category.color === 'indigo' ? 'bg-indigo-100 text-indigo-700' :
          'bg-cyan-100 text-cyan-700'
        }`}>
          {category.name}
        </span>
        <span className="text-xs text-slate-400 ml-auto">
          {banks.length} 个题库
        </span>
        <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
      </div>
    
      {isExpanded && (
        <div className="mt-3 space-y-3 pl-2">
          {banks.map(bank => (
            <BankCard
              key={bank.id}
              bank={bank}
              onStartPractice={() => onStartPractice(bank.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 顶级分类区块组件
interface TopCategorySectionProps {
  category: Category;
  banks: Bank[];
  childCategories: Category[];
  childBanks: Bank[];
  allBanks: Bank[];
  isExpanded: boolean;
  onToggle: () => void;
  onStartPractice: (bankId: string) => void;
}

function TopCategorySection({ category, banks, childCategories, childBanks, allBanks, isExpanded, onToggle, onStartPractice }: TopCategorySectionProps) {
  return (
    <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm mb-4">
      <div 
        className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50/80 p-2 -m-2 rounded-xl transition-all duration-200"
        onClick={onToggle}
      >
        {isExpanded ? (
          <FolderOpen className="w-4 h-4 text-slate-500" />
        ) : (
          <Folder className="w-4 h-4 text-slate-400" />
        )}
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
          category.color === 'blue' ? 'bg-blue-100 text-blue-700' :
          category.color === 'green' ? 'bg-green-100 text-green-700' :
          category.color === 'red' ? 'bg-red-100 text-red-700' :
          category.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
          category.color === 'purple' ? 'bg-purple-100 text-purple-700' :
          category.color === 'pink' ? 'bg-pink-100 text-pink-700' :
          category.color === 'indigo' ? 'bg-indigo-100 text-indigo-700' :
          'bg-cyan-100 text-cyan-700'
        }`}>
          {category.name}
        </span>
        <span className="text-xs text-gray-500 ml-auto pr-1 font-medium">
          {banks.length + childBanks.length} 个题库
        </span>
        <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
      </div>
    
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {banks.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-1 h-1 bg-slate-300 rounded-full" />
                <span className="text-xs text-gray-400 font-medium">直接题库</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {banks.map((bank) => (
                  <BankCard 
                    key={bank.id} 
                    bank={bank} 
                    onStartPractice={() => onStartPractice(bank.id)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {childCategories.map(child => {
            const childBanks = allBanks.filter(b => b.categoryId === child.id);
            if (childBanks.length === 0) return null;
            
            return (
              <div key={child.id}>
                <div className="flex items-center gap-2 mb-2">
                  <FolderOpen className="w-3 h-3 text-gray-500" />
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${
                    child.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                    child.color === 'green' ? 'bg-green-100 text-green-700' :
                    child.color === 'red' ? 'bg-red-100 text-red-700' :
                    child.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                    child.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                    child.color === 'pink' ? 'bg-pink-100 text-pink-700' :
                    child.color === 'indigo' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-cyan-100 text-cyan-700'
                  }`}>
                    {child.name}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">({childBanks.length} 题库)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {childBanks.map((bank) => (
                    <BankCard 
                      key={bank.id} 
                      bank={bank} 
                      onStartPractice={() => onStartPractice(bank.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 练习页面组件
interface PracticeViewProps {
  onExit: () => void;
  quizState: ReturnType<typeof useQuiz>['quizState'];
  currentQuestion: ReturnType<typeof useQuiz>['currentQuestion'];
  currentAnswer: ReturnType<typeof useQuiz>['currentAnswer'];
  isAnswerCorrect: ReturnType<typeof useQuiz>['isAnswerCorrect'];
  selectAnswer: ReturnType<typeof useQuiz>['selectAnswer'];
  nextQuestion: ReturnType<typeof useQuiz>['nextQuestion'];
  prevQuestion: ReturnType<typeof useQuiz>['prevQuestion'];
  submitAnswer: ReturnType<typeof useQuiz>['submitAnswer'];
  finishQuiz: ReturnType<typeof useQuiz>['finishQuiz'];
  goToQuestion: ReturnType<typeof useQuiz>['goToQuestion'];
  restartQuiz: ReturnType<typeof useQuiz>['restartQuiz'];
  resetQuiz: ReturnType<typeof useQuiz>['resetQuiz'];
}

function PracticeView({
  onExit,
  quizState,
  currentQuestion,
  currentAnswer,
  selectAnswer,
  nextQuestion,
  prevQuestion,
  submitAnswer,
  finishQuiz,
  goToQuestion,
  restartQuiz,
  resetQuiz,
}: PracticeViewProps) {
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [showResultSheet, setShowResultSheet] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [currentChildIndex, setCurrentChildIndex] = useState(0);
  const questionContentRef = useRef<HTMLDivElement>(null);

  // 计算答题结果统计
  const resultStats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    
    const allQuestions: Question[] = [];
    quizState.questions.forEach(q => {
      if (q.type === 'comprehensive' && q.children && q.children.length > 0) {
        allQuestions.push(q);
        allQuestions.push(...q.children);
      } else if (!q.parentId) {
        allQuestions.push(q);
      }
    });
    
    allQuestions.forEach(q => {
      const answer = quizState.answers[q.id];
      const isUnanswered = 
        answer === undefined || 
        answer === '' || 
        answer === null ||
        (Array.isArray(answer) && answer.length === 0);
      
      if (isUnanswered) {
        unanswered++;
      } else {
        const qAnswer = q.answer;
        
        if (q.type === 'fill-blank') {
          if (String(answer) === String(qAnswer)) {
            correct++;
          } else {
            wrong++;
          }
        } else if (Array.isArray(qAnswer)) {
          const userAnswer = Array.isArray(answer) ? answer.sort() : [String(answer).toLowerCase()];
          const correctAnswer = qAnswer.map(a => String(a).toLowerCase()).sort();
          if (JSON.stringify(userAnswer) === JSON.stringify(correctAnswer)) {
            correct++;
          } else {
            wrong++;
          }
        } else {
          if (String(answer).toLowerCase() === String(qAnswer).toLowerCase()) {
            correct++;
          } else {
            wrong++;
          }
        }
      }
    });
    
    return { correct, wrong, unanswered, total: allQuestions.length };
  }, [quizState.questions, quizState.answers]);

  // 切换题目时滚动到顶部
  useEffect(() => {
    if (questionContentRef.current) {
      questionContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setShowExplanation(false);
  }, [quizState.currentIndex]);

  // 综合题当前显示的子题目
  const displayQuestion = useMemo(() => {
    if (!currentQuestion) return null;
    if (currentQuestion.type === 'comprehensive' && currentQuestion.children && currentQuestion.children.length > 0) {
      return currentQuestion.children[currentChildIndex] || currentQuestion.children[0];
    }
    return currentQuestion;
  }, [currentQuestion, currentChildIndex]);

  if (!currentQuestion || !displayQuestion) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  const isComprehensive = currentQuestion.type === 'comprehensive' && currentQuestion.children && currentQuestion.children.length > 0;
  const totalChildren = isComprehensive ? currentQuestion.children!.length : 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* 顶部导航 */}
      <PracticeHeader
        currentIndex={quizState.currentIndex}
        totalQuestions={quizState.questions.length}
        onBack={() => {
          resetQuiz();
          onExit();
        }}
        onShowAnswerSheet={() => setShowAnswerSheet(true)}
        onSubmit={() => {
          setShowResultSheet(true);
        }}
      />

      {/* 综合题子题目切换 */}
      {isComprehensive && totalChildren > 1 && (
        <div className="bg-white border-b border-slate-100 px-4 py-2">
          <div className="max-w-[970px] mx-auto flex items-center gap-2 overflow-x-auto">
            {currentQuestion.children!.map((child, idx) => (
              <button
                key={child.id}
                onClick={() => setCurrentChildIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  currentChildIndex === idx
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                子题 {idx + 1}/{totalChildren}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 题目内容区域 */}
      <div ref={questionContentRef} className="max-w-[970px] mx-auto px-4 py-4">
        <QuizCard
          question={currentQuestion}
          displayQuestion={displayQuestion}
          currentIndex={quizState.currentIndex}
          currentChildIndex={currentChildIndex}
          showExplanation={showExplanation}
          answer={currentAnswer}
          onAnswerSelect={selectAnswer}
          onViewAnswer={() => setShowExplanation(true)}
        />
      </div>

      {/* 底部控制栏 */}
      <QuizControls
        currentQuestion={currentQuestion}
        currentIndex={quizState.currentIndex}
        totalQuestions={quizState.questions.length}
        currentChildIndex={currentChildIndex}
        onPrev={prevQuestion}
        onNext={nextQuestion}
        onViewAnswer={() => setShowExplanation(true)}
        onFinish={() => {
          setShowResultSheet(true);
          finishQuiz();
        }}
        isFirstQuestion={quizState.currentIndex === 0}
      />

      {/* 答题卡弹窗 */}
      <AnswerSheet
        open={showAnswerSheet}
        onOpenChange={setShowAnswerSheet}
        questions={quizState.questions}
        answers={quizState.answers}
        currentIndex={quizState.currentIndex}
        onGoToQuestion={goToQuestion}
        getRecordByQuestionId={(id) => recordStore.getByQuestionId(id)}
        onSubmit={() => {
          setShowAnswerSheet(false);
          setShowResultSheet(true);
          finishQuiz();
        }}
      />

      {/* 结果弹窗 */}
      <ResultModal
        open={showResultSheet}
        onOpenChange={setShowResultSheet}
        stats={{
          total: resultStats.total,
          correct: resultStats.correct,
          wrong: resultStats.wrong,
          unanswered: resultStats.unanswered,
          accuracy: resultStats.total > 0 ? Math.round((resultStats.correct / resultStats.total) * 100) : 0,
        }}
        questions={quizState.questions}
        answers={quizState.answers}
        onClose={() => {
          setShowResultSheet(false);
          resetQuiz();
          onExit();
        }}
      />
    </div>
  );
}
