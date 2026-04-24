'use client';

import { X } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import type { Question } from '@/lib/types';

// 题型颜色配置
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

interface AnswerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: Question[];
  answers: Record<string, string | string[]>;
  currentIndex: number;
  onGoToQuestion: (index: number) => void;
  getRecordByQuestionId: (id: string) => { isCorrect: boolean }[];
  onSubmit: () => void;
}

export function AnswerSheet({
  open,
  onOpenChange,
  questions,
  answers,
  currentIndex,
  onGoToQuestion,
  getRecordByQuestionId,
  onSubmit,
}: AnswerSheetProps) {
  // 按题型分组
  const groupedQuestions = [
    'single', 'multiple', 'true-false', 'fill-blank', 'comprehensive'
  ].map(type => {
    const typeQuestions = questions
      .map((q, idx) => ({ q, idx }))
      .filter(item => item.q.type === type);
    return {
      type,
      questions: typeQuestions,
      label: TYPE_NAMES[type],
      color: TYPE_COLORS[type],
    };
  }).filter(group => group.questions.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-5 [&>button]:hidden">
        {/* 自定义关闭按钮 */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        
        <DialogHeader className="pb-3">
          <DialogTitle className="text-lg font-bold text-slate-800 text-center">答题卡</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {groupedQuestions.map(group => (
            <div key={group.type}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${group.color}`}></span>
                <span className="text-sm font-medium text-slate-700">{group.label}</span>
                <span className="text-xs text-slate-400">({group.questions.length}题)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.questions.map(({ q, idx }) => {
                  const answered = !!answers[q.id];
                  const records = getRecordByQuestionId(q.id);
                  const isWrong = answered && records.length > 0 && !records[records.length - 1].isCorrect;
                  const isCurrent = idx === currentIndex;

                  // 综合题显示父题和子题
                  if (q.type === 'comprehensive' && q.children && q.children.length > 0) {
                    return (
                      <div key={q.id} className="flex flex-wrap gap-2">
                        {/* 父题序号 */}
                        <button
                          onClick={() => {
                            onGoToQuestion(idx);
                            onOpenChange(false);
                          }}
                          className={`w-9 h-9 rounded-xl text-sm font-bold transition-all flex items-center justify-center ${
                            isCurrent
                              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                              : answered
                                ? isWrong
                                  ? 'bg-red-100 text-red-700 border-2 border-red-300'
                                  : 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                                : 'bg-slate-100 text-slate-600 border-2 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {idx + 1}
                        </button>
                        {/* 子题序号 */}
                        {q.children.map((child, childIdx) => {
                          const childAnswered = !!answers[child.id];
                          const childRecords = getRecordByQuestionId(child.id);
                          const childIsWrong = childAnswered && childRecords.length > 0 && !childRecords[childRecords.length - 1].isCorrect;
                          return (
                            <button
                              key={child.id}
                              onClick={() => {
                                onGoToQuestion(idx);
                                // 设置当前子题索引
                                onOpenChange(false);
                              }}
                              className={`w-9 h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center ${
                                childAnswered
                                  ? childIsWrong
                                    ? 'bg-red-50 text-red-600 border border-red-200'
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                  : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {idx + 1}({childIdx + 1})
                            </button>
                          );
                        })}
                      </div>
                    );
                  }

                  // 普通题目
                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        onGoToQuestion(idx);
                        onOpenChange(false);
                      }}
                      className={`w-9 h-9 rounded-xl text-sm font-bold transition-all flex items-center justify-center ${
                        isCurrent
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                          : answered
                            ? isWrong
                              ? 'bg-red-100 text-red-700 border-2 border-red-300'
                              : 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                            : 'bg-slate-100 text-slate-600 border-2 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* 图例 */}
          <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-gradient-to-r from-indigo-500 to-purple-500"></div>
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
              <div className="w-4 h-4 rounded bg-slate-100 border border-slate-200"></div>
              <span>未答</span>
            </div>
          </div>

          {/* 交卷按钮 */}
          <button
            onClick={() => {
              onOpenChange(false);
              onSubmit();
            }}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-600 transition-all"
          >
            交卷
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
