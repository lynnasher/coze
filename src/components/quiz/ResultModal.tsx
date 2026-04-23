'use client';

import { FileCheck } from 'lucide-react';
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

interface ResultStats {
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  accuracy: number;
}

interface ResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: ResultStats;
  questions: Question[];
  answers: Record<string, string | string[]>;
  onClose: () => void;
}

export function ResultModal({
  open,
  onOpenChange,
  stats,
  questions,
  answers,
  onClose,
}: ResultModalProps) {
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

  // 获取题目状态
  const getQuestionStatus = (question: Question): { isCorrect: boolean; isWrong: boolean; isUnanswered: boolean } => {
    const answer = answers[question.id];
    const isUnanswered = answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0);

    if (isUnanswered) {
      return { isCorrect: false, isWrong: false, isUnanswered: true };
    }

    const correctAnswer = question.answer;
    let isCorrect = false;

    if (Array.isArray(correctAnswer)) {
      // 多选题或填空题
      if (Array.isArray(answer)) {
        isCorrect = answer.length === correctAnswer.length && 
          answer.every(a => correctAnswer.includes(a));
      } else {
        isCorrect = correctAnswer.includes(answer);
      }
    } else {
      // 单选题或判断题
      isCorrect = answer === correctAnswer;
    }

    return { isCorrect, isWrong: !isCorrect, isUnanswered: false };
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) onClose();
    }}>
      <DialogContent className="max-w-[90vw] sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-5">
        <DialogHeader className="pb-3 text-center">
          <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
            <FileCheck className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-xl font-bold text-slate-800">答题完成</DialogTitle>
        </DialogHeader>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl p-3 text-white text-center">
            <p className="text-2xl font-bold">{stats.accuracy}%</p>
            <p className="text-xs opacity-80">正确率</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl p-3 text-white text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs opacity-80">总题数</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl p-3 text-white text-center">
            <p className="text-2xl font-bold">{stats.correct}</p>
            <p className="text-xs opacity-80">做对</p>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-rose-500 rounded-xl p-3 text-white text-center">
            <p className="text-2xl font-bold">{stats.wrong + stats.unanswered}</p>
            <p className="text-xs opacity-80">错误</p>
          </div>
        </div>

        {/* 详细说明 */}
        <div className="text-center text-sm text-slate-500 mb-4">
          <p>做对 {stats.correct} 题，做错 {stats.wrong} 题，未答 {stats.unanswered} 题</p>
        </div>

        {/* 答题卡 */}
        <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
          {groupedQuestions.map(group => (
            <div key={group.type}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${group.color}`}></span>
                <span className="text-sm font-medium text-slate-700">{group.label}</span>
                <span className="text-xs text-slate-400">({group.questions.length}题)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.questions.map(({ q, idx }) => {
                  // 填空题特殊处理
                  if (q.type === 'fill-blank') {
                    const { isCorrect, isWrong, isUnanswered } = getQuestionStatus(q);
                    return (
                      <div
                        key={q.id}
                        className={`w-9 h-9 rounded-xl text-sm font-bold flex items-center justify-center ${
                          isUnanswered
                            ? 'bg-slate-100 text-slate-500 border border-slate-200'
                            : isCorrect
                              ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                              : 'bg-red-100 text-red-700 border-2 border-red-300'
                        }`}
                      >
                        {idx + 1}
                      </div>
                    );
                  }

                  // 综合题显示父题和子题
                  if (q.type === 'comprehensive' && q.children && q.children.length > 0) {
                    return (
                      <div key={q.id} className="flex flex-wrap gap-2">
                        {/* 父题序号 */}
                        <div className="w-9 h-9 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center">
                          {idx + 1}
                        </div>
                        {/* 子题序号 */}
                        {q.children.map((child, childIdx) => {
                          const { isCorrect, isWrong, isUnanswered } = getQuestionStatus(child);
                          return (
                            <div
                              key={child.id}
                              className={`w-9 h-9 rounded-xl text-xs font-bold flex items-center justify-center ${
                                isUnanswered
                                  ? 'bg-slate-50 text-slate-500 border border-slate-200'
                                  : isCorrect
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                    : 'bg-red-50 text-red-600 border border-red-200'
                              }`}
                            >
                              {idx + 1}({childIdx + 1})
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  // 普通题目
                  const { isCorrect, isWrong, isUnanswered } = getQuestionStatus(q);
                  return (
                    <div
                      key={q.id}
                      className={`w-9 h-9 rounded-xl text-sm font-bold flex items-center justify-center ${
                        isUnanswered
                          ? 'bg-slate-100 text-slate-500 border border-slate-200'
                          : isCorrect
                            ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                            : 'bg-red-100 text-red-700 border-2 border-red-300'
                      }`}
                    >
                      {idx + 1}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 确认按钮 */}
        <button
          onClick={() => {
            onOpenChange(false);
            onClose();
          }}
          className="w-full mt-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-600 transition-all"
        >
          返回首页
        </button>
      </DialogContent>
    </Dialog>
  );
}
