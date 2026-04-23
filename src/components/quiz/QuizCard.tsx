'use client';

import { FileText, Check, BookOpen } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { RichTextWithBreaks } from '@/lib/rich-text';
import type { Question } from '@/lib/types';

const TYPE_CONFIG: Record<string, { name: string; color: string }> = {
  single: { name: '单选题', color: 'bg-orange-500' },
  multiple: { name: '多选题', color: 'bg-purple-500' },
  'true-false': { name: '判断题', color: 'bg-cyan-500' },
  'fill-blank': { name: '填空题', color: 'bg-teal-500' },
  comprehensive: { name: '综合题', color: 'bg-rose-500' },
};

interface QuizCardProps {
  question: Question;
  currentIndex: number;
  answer?: string | string[];
  showExplanation: boolean;
  questionContentRef?: React.RefObject<HTMLDivElement | null>;
  onOptionClick?: (optionId: string) => void;
  onAnswerSelect?: (questionId: string, answer: string | string[]) => void;
  onFillBlankChange?: (value: string) => void;
  onViewAnswer?: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
}

export function QuizCard({
  question,
  currentIndex,
  answer,
  showExplanation,
  questionContentRef,
  onOptionClick,
  onAnswerSelect,
  onFillBlankChange,
  onViewAnswer,
  onTouchStart,
  onTouchEnd,
}: QuizCardProps) {
  // 获取当前显示的题目（综合题显示子题或主题）
  const isComprehensive = question.type === 'comprehensive';
  const hasChildren = isComprehensive && question.children && question.children.length > 0;
  const currentChildIndex = hasChildren ? (question as any)._currentChildIndex || 0 : 0;
  
  const displayQuestion = hasChildren 
    ? (question.children?.[currentChildIndex] || question)
    : question;

  const questionType = displayQuestion.type;
  const typeConfig = TYPE_CONFIG[questionType] || { name: '题目', color: 'bg-gray-500' };

  // 处理选项点击
  const handleOptionClick = (optionId: string) => {
    if (showExplanation) return;
    if (onOptionClick) {
      onOptionClick(optionId);
    } else if (onAnswerSelect) {
      onAnswerSelect(question.id, optionId);
    }
  };

  // 处理填空输入
  const handleFillBlankChange = (value: string) => {
    if (showExplanation) return;
    onFillBlankChange?.(value);
  };

  // 检查选项是否被选中
  const isOptionSelected = (optionId: string): boolean => {
    if (Array.isArray(answer)) {
      return answer.includes(optionId);
    }
    return answer === optionId;
  };

  // 检查选项是否为正确答案
  const isCorrectAnswer = (optionId: string): boolean => {
    const correctAnswer = displayQuestion.answer;
    if (Array.isArray(correctAnswer)) {
      return correctAnswer.includes(optionId);
    }
    return correctAnswer === optionId;
  };

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

  // 获取选项样式
  const getOptionStyle = (optionId: string): string => {
    const selected = isOptionSelected(optionId);
    const correct = isCorrectAnswer(optionId);

    if (selected && showExplanation) {
      return correct ? 'bg-emerald-100 border-2 border-emerald-400' : 'bg-red-100 border-2 border-red-400';
    }
    if (selected) return 'bg-blue-50 border-2 border-blue-400';
    if (showExplanation && correct) return 'bg-emerald-100 border-2 border-emerald-400';
    return 'bg-white border-2 border-gray-200 hover:border-blue-300';
  };

  // 获取选项标识样式
  const getOptionBadgeStyle = (optionId: string): string => {
    const selected = isOptionSelected(optionId);
    const correct = isCorrectAnswer(optionId);

    if (selected && showExplanation) {
      return correct ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white';
    }
    if (selected) return 'bg-blue-500 text-white';
    if (showExplanation && correct) return 'bg-emerald-500 text-white';
    return 'bg-gray-200 text-gray-600';
  };

  return (
    <div 
      className="pb-28" 
      ref={questionContentRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="max-w-[970px] mx-auto px-4 py-4">
        {/* 题目卡片 */}
        <div className="bg-white rounded-2xl overflow-hidden">
          {/* 题干头部 */}
          <div className="px-4 py-3 bg-gray-50">
            <div className="flex items-center justify-between">
              {/* 左侧：题型标签 */}
              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold text-white ${typeConfig.color}`}>
                {typeConfig.name}
              </span>
              
              {/* 右侧：题号 */}
              <span className="text-xs text-gray-500 font-medium">
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
            <div className="mx-4 mt-4 p-4 bg-blue-50 rounded-xl">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700 leading-relaxed flex-1 font-medium">
                  <RichTextWithBreaks content={question.caseBackground} textClassName="whitespace-pre-wrap" />
                </div>
              </div>
            </div>
          )}
          
          {/* 题目内容 */}
          <div className="px-4 py-5">
            <div className="text-base font-medium text-gray-800 leading-relaxed">
              <RichTextWithBreaks content={displayQuestion?.content || ''} textClassName="whitespace-pre-wrap" />
            </div>
          </div>

          {/* 选项区域 */}
          <div className="px-4 pb-4">
            {/* 填空题输入框 */}
            {questionType === 'fill-blank' && (
              <div className="space-y-2">
                <Textarea
                  placeholder="输入你的答案..."
                  value={(answer as string) || ''}
                  onChange={(e) => handleFillBlankChange(e.target.value)}
                  disabled={showExplanation}
                  className="min-h-[100px] rounded-xl border-2 border-gray-200 focus:border-blue-400 bg-white text-sm p-4"
                />
              </div>
            )}

            {/* 其他题型选项 */}
            {questionType !== 'fill-blank' && (
              <div className="space-y-3">
                {displayQuestion?.options?.map((option, index) => (
                  <div
                    key={option.id}
                    className={`flex items-center p-4 rounded-xl transition-all duration-200 cursor-pointer ${getOptionStyle(option.id)}`}
                    onClick={() => handleOptionClick(option.id)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 font-bold text-sm transition-colors flex-shrink-0 ${getOptionBadgeStyle(option.id)}`}>
                      {isOptionSelected(option.id) ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        String.fromCharCode(65 + index)
                      )}
                    </div>
                    <div className="flex-1 text-sm font-medium text-gray-700">
                      <RichTextWithBreaks content={option.text} textClassName="whitespace-pre-wrap" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 答案和解析 */}
            {showExplanation && displayQuestion && (
              <div className="mt-5 pt-4 space-y-3">
                {/* 激励提示 */}
                <div className={`p-4 rounded-xl ${isCorrect ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-red-50 border-2 border-red-200'}`}>
                  <div className="flex items-center gap-2">
                    {isCorrect ? (
                      <>
                        <Check className="w-5 h-5 text-emerald-600" />
                        <span className="font-bold text-emerald-700">太棒了！答对了</span>
                      </>
                    ) : (
                      <>
                        <span className="text-red-500 text-lg">✗</span>
                        <span className="font-bold text-red-700">哎呀，答错了</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 正确答案 */}
                <div className={`p-4 rounded-xl border-2 ${isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">正确答案：</span>
                    <span className={`font-bold ${isCorrect ? 'text-emerald-600' : 'text-gray-800'}`}>
                      {Array.isArray(displayQuestion.answer)
                        ? displayQuestion.answer.join(', ')
                        : displayQuestion.answer}
                    </span>
                  </div>
                </div>

                {/* 解析 */}
                {displayQuestion.explanation && (
                  <div className="p-4 rounded-xl bg-gray-50 border-2 border-gray-200">
                    <div className="flex items-start gap-3">
                      <BookOpen className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-gray-700 leading-relaxed flex-1">
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
