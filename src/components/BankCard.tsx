import { Button } from '@/components/ui/button';
import { Play, BookOpen, Clock, Target } from 'lucide-react';

interface BankCardProps {
  bank: {
    id: string;
    name: string;
    questionCount?: number;
    createdAt: number;
  };
  onStartPractice: (bankId: string) => void;
}

export function BankCard({ bank, onStartPractice }: BankCardProps) {
  const questionCount = bank.questionCount ?? 0;
  
  // 根据题目数量决定难度提示
  const getDifficultyBadge = () => {
    if (questionCount === 0) return null;
    if (questionCount < 50) return { label: '入门', color: 'emerald' };
    if (questionCount < 150) return { label: '基础', color: 'blue' };
    if (questionCount < 300) return { label: '进阶', color: 'amber' };
    return { label: '挑战', color: 'rose' };
  };
  
  const difficulty = getDifficultyBadge();
  
  return (
    <div 
      className={`group relative bg-white rounded-2xl p-4 border border-slate-100 hover:border-indigo-200 hover:shadow-lg transition-all duration-300 cursor-pointer ${
        questionCount === 0 ? 'opacity-50' : ''
      }`}
      onClick={() => questionCount > 0 && onStartPractice(bank.id)}
    >
      {/* 顶部装饰线 */}
      <div className="absolute top-0 left-4 right-4 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-b-full opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-start justify-between gap-3">
        {/* 左侧：题库信息 */}
        <div className="flex-1 min-w-0">
          {/* 题库名称 */}
          <h4 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2 mb-2 group-hover:text-indigo-700 transition-colors">
            {bank.name}
          </h4>
          
          {/* 题目数量和难度 */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{questionCount > 0 ? `${questionCount} 道题` : '暂无题目'}</span>
            </div>
            
            {difficulty && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                difficulty.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                difficulty.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                difficulty.color === 'amber' ? 'bg-amber-50 text-amber-600' :
                'bg-rose-50 text-rose-600'
              }`}>
                {difficulty.label}
              </span>
            )}
          </div>
        </div>
        
        {/* 右侧：开始按钮 */}
        {questionCount > 0 && (
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-300">
              <Play className="w-4 h-4 text-white fill-white" />
            </div>
          </div>
        )}
      </div>
      
      {/* 底部：底部装饰 */}
      {questionCount > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-50">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>随时可练</span>
            </div>
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              <span>点击开始</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
