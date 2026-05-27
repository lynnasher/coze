'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckCircle2, Lightbulb, ChevronRight, Lock, AlertCircle } from 'lucide-react';
import { Question } from '@/lib/types';
import { questionStore, bankStore } from '@/lib/quiz-store';
import { getCurrentUser } from '@/components/AuthModal';
import { Button } from '@/components/ui/button';

// 题型标签映射
const TYPE_LABELS: Record<string, { text: string; color: string }> = {
  single: { text: '单选题', color: 'bg-indigo-100 text-indigo-700' },
  multiple: { text: '多选题', color: 'bg-purple-100 text-purple-700' },
  'true-false': { text: '判断题', color: 'bg-cyan-100 text-cyan-700' },
  'fill-blank': { text: '填空题', color: 'bg-teal-100 text-teal-700' },
  comprehensive: { text: '综合题', color: 'bg-rose-100 text-rose-700' },
};

export default function RecitePage() {
  const params = useParams();
  const router = useRouter();
  const bankId = params.bankId as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [bankName, setBankName] = useState('');
  const [bankCategoryId, setBankCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{
    id: string;
    phone: string;
    nickname?: string;
    role: string;
    activatedCategories?: string[];
  } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // 检查用户登录状态和激活权限
  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = getCurrentUser();
      setUser(currentUser);
      
      // 获取题库的分类信息
      const banks = bankStore.getAll();
      const bank = banks.find(b => b.id === bankId);
      if (bank?.categoryId) {
        setBankCategoryId(bank.categoryId);
      }
      
      setAuthChecked(true);
    };
    
    checkAuth();
  }, [bankId]);

  // 加载题库和题目数据
  useEffect(() => {
    // 只有完成权限检查后才加载数据
    if (!authChecked) return;
    
    // 未登录用户不能访问
    if (!user) return;
    
    // 检查是否激活了该分类
    const activatedCategories = user.activatedCategories || [];
    if (bankCategoryId && !activatedCategories.includes(bankCategoryId)) {
      // 未激活该分类，不加载数据
      setLoading(false);
      return;
    }
    
    const loadData = async () => {
      try {
        let bankQuestions: Question[] = [];
        
        // 使用正确的 store 方法获取数据
        const banks = bankStore.getAll();
        const bank = banks.find(b => b.id === bankId);
        if (bank) {
          setBankName(bank.name || '');
        }
        
        const allQuestions = questionStore.getAll();
        
        if (allQuestions.length > 0) {
          // 从所有题目中筛选属于该题库的题目
          bankQuestions = allQuestions.filter((q: Question) => {
            // 直接匹配 bankId
            if (q.bankId === bankId) return true;
            // 通过题库的 questionIds 匹配
            if (bank?.questionIds && bank.questionIds.includes(q.id)) return true;
            return false;
          });
        }

        // 如果 localStorage 没有数据，尝试从后端获取
        if (bankQuestions.length === 0) {
          const response = await fetch(`/api/admin/banks/${bankId}/questions`);
          if (response.ok) {
            const data = await response.json();
            bankQuestions = data.questions || [];
            if (data.bankName) setBankName(data.bankName);
          }
        }

        // 保留原始顺序，综合题保持完整结构
        setQuestions(bankQuestions);
      } catch (error) {
        console.error('加载背题数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [bankId, authChecked, user, bankCategoryId]);

  // 防复制功能
  useEffect(() => {
    // 禁用右键菜单
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 禁用复制快捷键
    const handleKeyDown = (e: KeyboardEvent) => {
      // 禁用 Ctrl+C, Ctrl+A, Ctrl+X, Ctrl+S, Ctrl+P
      if ((e.ctrlKey || e.metaKey) && ['c', 'a', 'x', 's', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      // 禁用 F12 (开发者工具)
      if (e.key === 'F12') {
        e.preventDefault();
      }
    };

    // 禁用选择开始
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('selectstart', handleSelectStart);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, []);

  // 获取答案显示文本
  const getAnswerDisplay = useCallback((question: Question) => {
    const answer = question.answer;
    
    if (question.type === 'true-false') {
      // 判断题：找到对应选项的文字
      const answerKey = (Array.isArray(answer) ? answer[0] : answer)?.toString().toUpperCase();
      const option = question.options?.find(o => o.id.toUpperCase() === answerKey);
      if (option) {
        const text = option.text.replace(/[。，、；：！？（）\.\,\;\:\!\?\(\)]/g, '').trim();
        return text === '正确' || text === '对' || text === '√' || text === '是' ? '正确' : '错误';
      }
      return answerKey;
    }
    
    if (question.type === 'fill-blank') {
      return Array.isArray(answer) ? answer.join('；') : answer;
    }
    
    // 选择题
    if (Array.isArray(answer)) {
      return answer.map(a => a.toUpperCase()).join('、');
    }
    return answer?.toString().toUpperCase() || '';
  }, []);

  // 获取正确答案的选项
  const getCorrectOptionIds = useCallback((question: Question): Set<string> => {
    const answer = question.answer;
    if (Array.isArray(answer)) {
      return new Set(answer.map(a => a.toString().toUpperCase()));
    }
    return new Set([answer?.toString().toUpperCase() || '']);
  }, []);

  // 计算题目总数（综合题只算父题）
  const totalQuestionCount = useMemo(() => {
    return questions.length;
  }, [questions]);

  // 按题型分组题目
  const groupedQuestions = useMemo(() => {
    const groups: Record<string, Question[]> = {};
    
    questions.forEach(q => {
      const typeKey = q.type;
      if (!groups[typeKey]) {
        groups[typeKey] = [];
      }
      groups[typeKey].push(q);
    });
    
    // 按题型顺序排序
    const typeOrder = ['single', 'multiple', 'true-false', 'fill-blank', 'comprehensive'];
    const sortedGroups: { type: string; typeName: string; questions: Question[] }[] = [];
    
    typeOrder.forEach(type => {
      if (groups[type] && groups[type].length > 0) {
        const typeNames: Record<string, string> = {
          'single': '单选题',
          'multiple': '多选题', 
          'true-false': '判断题',
          'fill-blank': '填空题',
          'comprehensive': '综合题'
        };
        sortedGroups.push({
          type,
          typeName: typeNames[type] || type,
          questions: groups[type]
        });
      }
    });
    
    return sortedGroups;
  }, [questions]);

  // 未登录提示
  if (authChecked && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">请先登录</h2>
          <p className="text-sm text-gray-500 mb-6">
            背题模式需要登录后才能访问
          </p>
          <Button 
            onClick={() => router.push('/')}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  // 未激活该科目提示
  if (authChecked && user && bankCategoryId !== null && !user.activatedCategories?.includes(bankCategoryId)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">未激活该科目</h2>
          <p className="text-sm text-gray-500 mb-6">
            您需要先激活该科目才能使用背题模式
          </p>
          <Button 
            onClick={() => router.push('/profile')}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            前往激活
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-3 text-gray-500 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[900px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-gray-900">{bankName || '背题模式'}</h1>
              <p className="text-xs text-gray-500">
                {totalQuestionCount} 道题 · 含答案与解析
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <BookOpen className="w-4 h-4" />
            <span>背题模式</span>
          </div>
        </div>
      </header>

      {/* 内容区 */}
      <main className="max-w-[900px] mx-auto px-4 py-6">
        {questions.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="mt-4 text-gray-500">该题库暂无题目</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedQuestions.map((group, groupIndex) => (
              <div key={group.type} className="space-y-4">
                {/* 题型分组标题 */}
                <div className="sticky top-14 z-10 bg-gray-50/95 backdrop-blur py-2 border-b border-gray-200">
                  <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      group.type === 'single' ? 'bg-indigo-100 text-indigo-700' :
                      group.type === 'multiple' ? 'bg-purple-100 text-purple-700' :
                      group.type === 'true-false' ? 'bg-cyan-100 text-cyan-700' :
                      group.type === 'fill-blank' ? 'bg-teal-100 text-teal-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {group.typeName}
                    </span>
                    <span className="text-sm text-gray-500">
                      {group.questions.length} 题
                    </span>
                  </h2>
                </div>
                
                {/* 该题型下的题目 */}
                <div className="space-y-6">
                  {(() => {
                    // 计算全局序号
                    let globalIndex = 1;
                    for (let i = 0; i < groupIndex; i++) {
                      globalIndex += groupedQuestions[i].questions.reduce((acc, q) => {
                        if (q.type === 'comprehensive' && q.children) {
                          return acc + 1 + q.children.length;
                        }
                        return acc + 1;
                      }, 0);
                    }
                    
                    return group.questions.map((question, index) => {
                      const currentIndex = globalIndex;
                      // 更新全局序号
                      if (question.type === 'comprehensive' && question.children) {
                        globalIndex += 1 + question.children.length;
                      } else {
                        globalIndex += 1;
                      }
                      
                      return (
                        <ReciteItem
                          key={question.id}
                          question={question}
                          index={currentIndex}
                          correctOptionIds={getCorrectOptionIds(question)}
                          answerDisplay={getAnswerDisplay(question)}
                        />
                      );
                    });
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 底部 */}
        <div className="mt-12 pb-8 text-center">
          <p className="text-xs text-gray-400">— 背题模式 · 全部题目已展示 —</p>
        </div>
      </main>
    </div>
  );
}

// 将文本中的图片 URL 转为 <img> 标签
function renderTextWithImages(text: string) {
  if (!text) return text;

  // 清理 <strong> 和 <b> 标签，保留纯文本
  text = text.replace(/<(strong|b)>(.*?)<\/(strong|b)>/gi, '$2');

  // 将 <br/> 或 <br> 标签转换为换行符
  text = text.replace(/<br\s*\/?>/gi, '\n');
  // 清理连续换行符（3个以上转为2个）
  text = text.replace(/\n{3,}/g, '\n\n');

  // 匹配 markdown 图片语法 ![alt](url)
  const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  // 匹配 HTML <img> 标签
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*\/?>/gi;
  // 匹配直接嵌入的图片 URL
  const urlRegex = /(https?:\/\/[^\s"'<>]+?\.(?:png|jpg|jpeg|gif|webp|svg|bmp)(?:\?[^\s"'<>]*)?)/gi;

  const parts: (string | React.ReactNode)[] = [];
  let lastIndex = 0;

  // 先处理 markdown 图片
  let match: RegExpExecArray | null;
  const mdMatches: { index: number; alt: string; url: string }[] = [];

  const mdRegex = new RegExp(mdImageRegex.source, 'g');
  while ((match = mdRegex.exec(text)) !== null) {
    mdMatches.push({ index: match.index, alt: match[1], url: match[2] });
  }

  // 合并所有匹配点（md图片 + html img + 直接url）
  interface MatchItem {
    index: number;
    length: number;
    alt: string;
    url: string;
  }
  const allMatches: MatchItem[] = [];

  for (const m of mdMatches) {
    allMatches.push({ index: m.index, length: `![${m.alt}](${m.url})`.length, alt: m.alt, url: m.url });
  }

  // 处理 HTML <img> 标签
  const htmlImgRegex2 = new RegExp(htmlImgRegex.source, 'gi');
  while ((match = htmlImgRegex2.exec(text)) !== null) {
    const isOverlapped = allMatches.some(
      (m) => match!.index >= m.index && match!.index < m.index + m.length
    );
    if (!isOverlapped) {
      allMatches.push({ index: match.index, length: match[0].length, alt: '', url: match[1] });
    }
  }

  const urlRegex2 = new RegExp(urlRegex.source, 'gi');
  while ((match = urlRegex2.exec(text)) !== null) {
    // 检查是否已被 md 图片匹配覆盖
    const isOverlapped = allMatches.some(
      (m) => match!.index >= m.index && match!.index < m.index + m.length
    );
    if (!isOverlapped) {
      allMatches.push({ index: match.index, length: match[0].length, alt: '', url: match[0] });
    }
  }

  // 排序
  allMatches.sort((a, b) => a.index - b.index);

  // 构建输出
  let result: (string | React.ReactNode)[] = [];
  let ptr = 0;
  for (const m of allMatches) {
    if (m.index > ptr) {
      result.push(text.slice(ptr, m.index));
    }
    result.push(
      <img
        key={m.index}
        src={m.url}
        alt={m.alt || ''}
        className="max-w-full h-auto rounded-lg my-2 inline-block"
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
    ptr = m.index + m.length;
  }
  if (ptr < text.length) {
    result.push(text.slice(ptr));
  }

  // 处理 <br/> 标签转换为换行
  const processBrTags = (content: string | React.ReactNode): React.ReactNode => {
    if (typeof content !== 'string') return content;
    
    const parts = content.split(/<br\s*\/?>/gi);
    if (parts.length <= 1) return content;
    
    return parts.map((part, index) => (
      <React.Fragment key={index}>
        {part}
        {index < parts.length - 1 && <br />}
      </React.Fragment>
    ));
  };

  // 处理 <sub> 和 <sup> 标签
  const processSubSupTags = (content: string | React.ReactNode): React.ReactNode => {
    if (typeof content !== 'string') return content;
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // 匹配 <sub>text</sub> 或 <sup>text</sup>
    const regex = /<(sub|sup)>(.*?)<\/(sub|sup)>/gi;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const [fullMatch, tag, innerText] = match;
      const beforeText = content.slice(lastIndex, match.index);
      
      if (beforeText) {
        parts.push(beforeText);
      }
      
      if (tag.toLowerCase() === 'sub') {
        parts.push(<sub key={match.index}>{innerText}</sub>);
      } else {
        parts.push(<sup key={match.index}>{innerText}</sup>);
      }
      
      lastIndex = match.index + fullMatch.length;
    }
    
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : content;
  };

  // 处理结果中的每个部分
  const finalResult = result.map((item, index) => {
    if (typeof item === 'string') {
      // 先处理 <br/>，再处理 <sub>/<sup>
      const withBr = processBrTags(item);
      if (typeof withBr === 'string') {
        return processSubSupTags(withBr);
      }
      // 如果是 ReactNode 数组，对每个字符串元素处理 <sub>/<sup>
      if (Array.isArray(withBr)) {
        return withBr.map((child, childIndex) => {
          if (typeof child === 'string') {
            return processSubSupTags(child);
          }
          return child;
        });
      }
      return withBr;
    }
    return item;
  });

  return finalResult.length > 0 ? finalResult : text;
}

// 单个题目卡片组件
function ReciteCard({
  question,
  index,
  correctOptionIds,
  answerDisplay,
  isChild = false,
}: {
  question: Question;
  index: number;
  correctOptionIds: Set<string>;
  answerDisplay: string;
  isChild?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${isChild ? 'ml-4' : ''}`}>
      <div className="p-5">
        {/* 题号 + 题干（同一行显示） */}
        <div className="flex items-start gap-2 mb-4">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex items-center justify-center mt-0.5">
            {index}
          </span>
          <div className="flex-1">
            <p className="text-base text-gray-900 leading-relaxed">
              {renderTextWithImages(question.content)}
            </p>
          </div>
        </div>

        {/* 选项列表 */}
        {question.options && question.options.length > 0 && (
          <div className="space-y-2 mb-4">
            {question.options.map((option) => {
              const isCorrect = correctOptionIds.has(option.id.toUpperCase());
              return (
                <div
                  key={option.id}
                  className={`
                    flex items-start gap-3 px-4 py-3 rounded-lg border
                    transition-colors
                    ${isCorrect
                      ? 'bg-emerald-50 border-emerald-300'
                      : 'bg-gray-50 border-gray-100'
                    }
                  `}
                >
                  {/* 选项标识 */}
                  <span
                    className={`
                      flex-shrink-0 w-6 h-6 rounded-full
                      text-xs font-bold flex items-center justify-center
                      ${isCorrect
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                      }
                    `}
                  >
                    {option.id.toUpperCase()}
                  </span>
                  {/* 选项文字 */}
                  <span
                    className={`
                      text-sm leading-relaxed pt-0.5
                      ${isCorrect ? 'text-emerald-800 font-medium' : 'text-gray-600'}
                    `}
                  >
                    {renderTextWithImages(option.text)}
                  </span>
                  {/* 正确标记 */}
                  {isCorrect && (
                    <CheckCircle2 className="flex-shrink-0 w-4 h-4 text-emerald-500 mt-0.5 ml-auto" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 填空题答案 */}
        {question.type === 'fill-blank' && (
          <div className="mb-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-sm font-medium text-emerald-700">参考答案：</span>
                <span className="text-sm text-emerald-700">{answerDisplay}</span>
              </div>
            </div>
          </div>
        )}

        {/* 判断题答案 */}
        {question.type === 'true-false' && (
          <div className="mb-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-sm font-medium text-emerald-700">正确答案：</span>
                <span className="text-sm text-emerald-700">{answerDisplay}</span>
              </div>
            </div>
          </div>
        )}

        {/* 选择题答案 */}
        {(question.type === 'single' || question.type === 'multiple') && (
          <div className="mb-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="text-sm font-medium text-emerald-700">
                正确答案：{answerDisplay}
              </span>
            </div>
          </div>
        )}

        {/* 解析 */}
        {question.explanation && (
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-amber-700">名师解析：</span>
                <p className="text-sm text-amber-700 leading-relaxed mt-0.5">
                  {renderTextWithImages(question.explanation)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 题目项组件（处理综合题和普通题）
function ReciteItem({
  question,
  index,
  correctOptionIds,
  answerDisplay,
}: {
  question: Question;
  index: number;
  correctOptionIds: Set<string>;
  answerDisplay: string;
}) {
  // 综合题：显示案例背景 + 子题列表
  if (question.type === 'comprehensive' && question.children && question.children.length > 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* 综合题案例背景 */}
        <div className="p-5 border-b border-gray-200 bg-rose-50/50">
          <div className="flex items-start gap-2">
            <span className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-600">
              综合案例
            </span>
            <span className="text-xs text-gray-400">{question.children.length} 道子题</span>
          </div>
          <div className="mt-3 text-gray-700 leading-relaxed">
            {renderTextWithImages(question.caseBackground || question.content)}
          </div>
        </div>

        {/* 子题列表 - 简洁显示，与案例背景同层 */}
        <div className="divide-y divide-gray-100">
          {question.children.map((child, childIndex) => {
            const childAnswerDisplay = (() => {
              const answer = child.answer;
              if (child.type === 'true-false') {
                const answerKey = (Array.isArray(answer) ? answer[0] : answer)?.toString().toUpperCase();
                const option = child.options?.find(o => o.id.toUpperCase() === answerKey);
                if (option) {
                  const text = option.text.replace(/[。，、；：！？（）\.\,\;\:\!\?\(\)]/g, '').trim();
                  return text === '正确' || text === '对' || text === '√' || text === '是' ? '正确' : '错误';
                }
                return answerKey;
              }
              if (child.type === 'fill-blank') {
                return Array.isArray(answer) ? answer.join('；') : answer;
              }
              if (Array.isArray(answer)) {
                return answer.map(a => a.toUpperCase()).join('、');
              }
              return answer?.toString().toUpperCase() || '';
            })();
            const childCorrectIds = new Set(
              Array.isArray(child.answer)
                ? child.answer.map(a => a.toString().toUpperCase())
                : [child.answer?.toString().toUpperCase() || '']
            );

            return (
              <div key={child.id} className="p-5">
                {/* 子题：题号 + 题型标签 + 题干（同一行） */}
                <div className="flex items-start gap-2 mb-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-medium flex items-center justify-center mt-0.5">
                    {childIndex + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-gray-800 leading-relaxed">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 mr-2 align-middle">
                        {child.type === 'single' ? '单选' : child.type === 'multiple' ? '多选' : child.type === 'true-false' ? '判断' : child.type === 'fill-blank' ? '填空' : '综合'}
                      </span>
                      {renderTextWithImages(child.content)}
                    </p>
                  </div>
                </div>

                {/* 选项 */}
                {child.options && child.options.length > 0 && (
                  <div className="space-y-2 mb-4 ml-8">
                    {child.options.map((option) => {
                      const isCorrect = childCorrectIds.has(option.id.toUpperCase());
                      return (
                        <div
                          key={option.id}
                          className={`flex items-start gap-3 p-2.5 rounded-lg ${
                            isCorrect
                              ? 'bg-green-50 border border-green-200'
                              : 'bg-gray-50 border border-gray-100'
                          }`}
                        >
                          <span
                            className={`flex-shrink-0 w-5 h-5 rounded text-xs font-medium flex items-center justify-center ${
                              isCorrect
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {option.id}
                          </span>
                          <span className={`text-sm ${isCorrect ? 'text-green-800 font-medium' : 'text-gray-600'}`}>
                            {renderTextWithImages(option.text)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 答案和解析 */}
                <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 ml-8">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-amber-700">正确答案：</span>
                    <span className="text-sm font-semibold text-amber-800">{childAnswerDisplay}</span>
                  </div>
                  {child.explanation && (
                    <div className="mt-2 pt-2 border-t border-amber-100">
                      <div className="text-xs text-gray-500 mb-1">解析：</div>
                      <div className="text-sm text-gray-700 leading-relaxed">
                        {renderTextWithImages(child.explanation)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 普通题：直接显示
  return (
    <ReciteCard
      question={question}
      index={index}
      correctOptionIds={correctOptionIds}
      answerDisplay={answerDisplay}
    />
  );
}
