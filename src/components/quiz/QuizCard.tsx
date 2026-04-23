'use client';

import { FileText, Check, BookOpen, Sparkles, RefreshCcw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { RichTextWithBreaks } from '@/lib/rich-text';
import type { Question } from '@/lib/types';

// 题型标签颜色配置
const TYPE_COLORS: Record<string, string> = {
  single: 'bg-indigo-500',
  multiple: 'bg-purple-500',
  'true-false': 'bg-cyan-500',
  comprehensive: 'bg-rose-500',
  'fill-blank': 'bg-teal-500',
};

// 题型名称
const TYPE_NAMES: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  'true-false': '判断题',
  comprehensive: '综合题',
  'fill-blank': '填空题',
};

interface QuizCardProps {
  question: Question;
  displayQuestion: Question | null;
  currentIndex: number;
  currentChildIndex: number;
  showExplanation: boolean;
  answer: string | string[] | undefined;
  onAnswerSelect: (questionId: string, answer: string | string[]) => void;
  onViewAnswer: () => void;
  questionContentRef?: React.RefObject<HTMLDivElement | null>;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
}

export function QuizCard({
  question,
  displayQuestion,
  currentIndex,
  currentChildIndex,
  showExplanation,
  answer,
  onAnswerSelect,
  onViewAnswer,
  questionContentRef,
  onTouchStart,
  onTouchEnd,
}: QuizCardProps) {
  const questionType = displayQuestion?.type || 'single';
  const typeColor = TYPE_COLORS[questionType] || TYPE_COLORS.single;
  const typeName = TYPE_NAMES[questionType] || '单选题';

  // 检查是否为综合题
  const isComprehensive = question.type === 'comprehensive';
  const hasChildren = isComprehensive && question.children && question.children.length > 0;

  // 判断当前作答是否正确
  const isCorrect = (() => {
    if (!displayQuestion || answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
      return false;
    }
    const correctAnswer = displayQuestion.answer;
    if (Array.isArray(correctAnswer)) {
      if (!Array.isArray(answer)) return false;
      return correctAnswer.length === answer.length && correctAnswer.every(a => answer.includes(a));
    }
    if (Array.isArray(answer)) {
      return answer.length === 1 && answer[0] === correctAnswer;
    }
    return answer === correctAnswer;
  })();

  // 处理选项点击
  const handleOptionClick = (optionId: string) => {
    if (showExplanation || !displayQuestion) return;

    if (questionType === 'multiple') {
      const current = Array.isArray(answer) ? answer : [];
      if (current.includes(optionId)) {
        onAnswerSelect(displayQuestion.id, current.filter(id => id !== optionId));
      } else {
        onAnswerSelect(displayQuestion.id, [...current, optionId]);
      }
    } else {
      onAnswerSelect(displayQuestion.id, optionId);
    }
  };

  // 处理填空题输入
  const handleFillBlankChange = (value: string) => {
    if (displayQuestion) {
      onAnswerSelect(displayQuestion.id, value);
    }
  };

  // 检查选项是否选中
  const isOptionSelected = (optionId: string): boolean => {
    if (questionType === 'multiple') {
      return Array.isArray(answer) && answer.includes(optionId);
    }
    return answer === optionId;
  };

  // 检查选项是否为正确答案
  const isCorrectAnswer = (optionId: string): boolean => {
    if (!displayQuestion) return false;
    const correctAnswer = displayQuestion.answer;
    if (Array.isArray(correctAnswer)) {
      return correctAnswer.includes(optionId);
    }
    return correctAnswer === optionId;
  };

  // 获取选项样式
  const getOptionStyle = (optionId: string): string => {
    const selected = isOptionSelected(optionId);
    const correct = isCorrectAnswer(optionId);

    if (selected && showExplanation) {
      return correct ? 'bg-emerald-50' : 'bg-red-50';
    }
    if (selected) return 'bg-indigo-50';
    if (showExplanation && correct) return 'bg-emerald-50';
    return 'bg-slate-50/50';
  };

  // 获取选项标识样式
  const getOptionBadgeStyle = (optionId: string): string => {
    const selected = isOptionSelected(optionId);
    const correct = isCorrectAnswer(optionId);

    if (selected && showExplanation) {
      return correct ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white';
    }
    if (selected) return 'bg-indigo-500 text-white';
    return 'bg-slate-200 text-slate-600';
  };

  return (
    <div 
      className="pb-28" 
      ref={questionContentRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="max-w-[970px] mx-auto sm:px-4 py-3">
        {/* 题目卡片 */}
        <div className="bg-white rounded-xl shadow-sm border-x border-b border-slate-100 overflow-hidden">
          {/* 题干头部 */}
          <div className="sm:px-4 px-3 py-2.5 border-b border-slate-50 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center justify-between gap-2">
              {/* 左侧：题型标签 */}
              <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold text-white ${typeColor}`}>
                {typeName}
              </span>
              
              {/* 右侧：题号 */}
              <span className="text-xs text-slate-500 font-medium">
                {hasChildren ? (
                  <>子题 {currentChildIndex + 1}/{question.children?.length}</>
                ) : (
                  <>第 {currentIndex + 1} 题</>
                )}
              </span>
            </div>
          </div>
          
          {/* 案例背景（综合题显示） */}
          {question.caseBackground && (
            <div className="sm:mx-4 mx-3 mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-indigo-700 leading-relaxed flex-1 font-medium">
                  <RichTextWithBreaks content={question.caseBackground} textClassName="whitespace-pre-wrap" />
                </div>
              </div>
            </div>
          )}
          
          {/* 题目内容 */}
          <div className="sm:px-4 px-3 py-3">
            <div className="text-base font-medium text-slate-800 leading-relaxed">
              <RichTextWithBreaks content={displayQuestion?.content || ''} textClassName="whitespace-pre-wrap" />
            </div>
          </div>
          
          {/* 分隔线 */}
          <div className="sm:mx-4 mx-3 h-px bg-slate-100" />
          
          {/* 选项区域 */}
          <div className="sm:px-4 px-3 pb-4">
            {/* 填空题输入框 */}
            {questionType === 'fill-blank' && (
              <div className="space-y-2">
                <Textarea
                  placeholder="输入你的答案..."
                  value={(answer as string) || ''}
                  onChange={(e) => handleFillBlankChange(e.target.value)}
                  disabled={showExplanation}
                  className="min-h-[80px] rounded-xl border-2 border-slate-200 focus:border-blue-300 bg-white text-sm"
                />
              </div>
            )}

            {/* 其他题型选项 */}
            {questionType !== 'fill-blank' && (
              <div className="space-y-2">
                {displayQuestion?.options?.map((option, index) => (
                  <div
                    key={option.id}
                    className={`flex items-center p-3 rounded-lg transition-all duration-200 cursor-pointer ${getOptionStyle(option.id)}`}
                    onClick={() => handleOptionClick(option.id)}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 font-bold text-xs transition-colors flex-shrink-0 ${getOptionBadgeStyle(option.id)}`}>
                      {isOptionSelected(option.id) ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        String.fromCharCode(65 + index)
                      )}
                    </div>
                    <div className="flex-1 text-sm font-medium text-slate-700">
                      <RichTextWithBreaks content={option.text} textClassName="whitespace-pre-wrap" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 答案和解析 */}
            {showExplanation && displayQuestion && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                {/* 激励提示 */}
                <div className={`mb-3 p-3 rounded-xl ${isCorrect ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200' : 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200'}`}>
                  <div className="flex items-center gap-2">
                    {isCorrect ? (
                      <>
                        <Sparkles className="w-5 h-5 text-emerald-500" />
                        <span className="font-bold text-emerald-700">回答正确！</span>
                        <span className="text-emerald-600 text-sm">继续保持，你很棒！</span>
                      </>
                    ) : (
                      <>
                        <RefreshCcw className="w-5 h-5 text-amber-500" />
                        <span className="font-bold text-amber-700">回答错误</span>
                        <span className="text-amber-600 text-sm">别灰心，继续加油！</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 正确答案 */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Check className={`w-4 h-4 ${isCorrect ? 'text-emerald-500' : 'text-red-500'}`} />
                    <span className={`text-sm font-bold ${isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                      正确答案：
                      {Array.isArray(displayQuestion.answer)
                        ? displayQuestion.answer.join(', ')
                        : displayQuestion.answer}
                    </span>
                  </div>
                </div>

                {/* 解析 */}
                {displayQuestion.explanation && (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="flex items-start gap-2">
                      <BookOpen className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-slate-700 leading-relaxed">
                        <span className="font-semibold">解析：</span>
                        {displayQuestion.explanation}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
