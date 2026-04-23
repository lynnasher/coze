'use client';

import { 
  Dialog, 
  DialogContent
} from '@/components/ui/dialog';
import type { Question } from '@/lib/types';

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
  // 计算答题统计
  const totalAnswered = Object.values(answers).filter(a => 
    a !== undefined && a !== '' && !(Array.isArray(a) && a.length === 0)
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-5">
        {/* 标题栏 */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-sm text-slate-500">
            已答 {totalAnswered}/{questions.length} 题
          </span>
        </div>

        {/* 题号网格 */}
        <div className="grid grid-cols-6 gap-2">
          {questions.map((q, idx) => {
            const answered = !!answers[q.id];
            const records = getRecordByQuestionId(q.id);
            const isWrong = answered && records.length > 0 && !records[records.length - 1].isCorrect;
            const isCurrent = idx === currentIndex;

            return (
              <button
                key={q.id}
                onClick={() => {
                  onGoToQuestion(idx);
                  onOpenChange(false);
                }}
                className={`aspect-square rounded-lg text-sm font-bold transition-all flex items-center justify-center ${
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
          className="w-full h-12 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all shadow-sm"
        >
          交卷
        </button>
      </DialogContent>
    </Dialog>
  );
}
