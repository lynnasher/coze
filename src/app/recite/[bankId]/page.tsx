'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckCircle2, Lightbulb, ChevronRight } from 'lucide-react';
import { Question } from '@/lib/types';
import { questionStore, bankStore } from '@/lib/quiz-store';

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
  const [loading, setLoading] = useState(true);

  // 加载题库和题目数据
  useEffect(() => {
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
  }, [bankId]);

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
          <div className="space-y-6">
            {questions.map((question, index) => (
              <ReciteItem
                key={question.id}
                question={question}
                index={index + 1}
                correctOptionIds={getCorrectOptionIds(question)}
                answerDisplay={getAnswerDisplay(question)}
              />
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

  return result.length > 0 ? result : text;
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
        {/* 题型标签 + 题号 + 题目内容 */}
        <div className="mb-4">
          <div className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex items-center justify-center">
              {index}
            </span>
            <div className="flex-1">
              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mb-1 ${TYPE_LABELS[question.type]?.color || 'bg-gray-100 text-gray-700'}`}>
                {TYPE_LABELS[question.type]?.text || question.type}
              </span>
              <p className="text-base text-gray-900 leading-relaxed">
                {renderTextWithImages(question.content)}
              </p>
            </div>
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
              <div>
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

// 子题卡片组件（更紧凑的样式）
function ReciteChildCard({
  question,
  index,
}: {
  question: Question;
  index: number;
}) {
  const answer = question.answer;

  // 获取正确答案显示文本
  const getAnswerDisplay = () => {
    if (question.type === 'true-false') {
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
    if (Array.isArray(answer)) {
      return answer.map(a => a.toUpperCase()).join('、');
    }
    return answer?.toString().toUpperCase() || '';
  };

  const correctOptionIds = new Set(
    Array.isArray(answer)
      ? answer.map(a => a.toString().toUpperCase())
      : [answer?.toString().toUpperCase() || '']
  );

  return (
    <div className="bg-gray-50/70 rounded-lg border border-gray-100 p-3 sm:p-4">
      {/* 题号 + 题型 + 题目 */}
      <div className="flex items-start gap-2 mb-2">
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-xs font-medium flex items-center justify-center">
          {index}
        </span>
        <span className={`flex-shrink-0 px-1.5 py-0 rounded text-[10px] ${TYPE_LABELS[question.type]?.color || 'bg-gray-100 text-gray-700'}`}>
          {TYPE_LABELS[question.type]?.text || question.type}
        </span>
        <p className="text-sm text-gray-900 leading-relaxed flex-1">
          {renderTextWithImages(question.content)}
        </p>
      </div>

      {/* 选项 - 紧凑布局 */}
      {question.options && question.options.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2 ml-7">
          {question.options.map((option) => {
            const isCorrect = correctOptionIds.has(option.id.toUpperCase());
            return (
              <div
                key={option.id}
                className={`
                  flex items-center gap-2 px-2 py-1.5 rounded text-sm
                  ${isCorrect ? 'bg-emerald-100/70 text-emerald-800' : 'text-gray-600'}
                `}
              >
                <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {option.id}
                </span>
                <span className="text-xs sm:text-sm">{renderTextWithImages(option.text)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 答案区域 - 紧凑 */}
      <div className="ml-7 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">答案：</span>
        <span className="text-sm font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
          {getAnswerDisplay()}
        </span>
      </div>

      {/* 解析 */}
      {question.explanation && (
        <div className="mt-2 ml-7 pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-amber-600 font-medium">解析：</span>
            {renderTextWithImages(question.explanation)}
          </p>
        </div>
      )}
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
        {/* 综合题案例背景 - 小屏减少padding */}
        <div className="p-3 sm:p-5 border-b border-gray-200 bg-rose-50/50">
          <div className="flex items-start gap-2 flex-wrap">
            <span className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-600">
              综合案例
            </span>
            <span className="text-xs text-gray-400">{question.children.length} 道子题</span>
          </div>
          <div className="mt-2 sm:mt-3 text-gray-700 leading-relaxed text-sm sm:text-base">
            {renderTextWithImages(question.caseBackground || question.content)}
          </div>
        </div>

        {/* 子题列表 - 小屏减少padding和空间 */}
        <div className="p-2 sm:p-4 space-y-2 sm:space-y-3">
          {question.children.map((child, childIndex) => (
            <ReciteChildCard
              key={child.id}
              question={child}
              index={childIndex + 1}
            />
          ))}
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
