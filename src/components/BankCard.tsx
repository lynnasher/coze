import { Button } from '@/components/ui/button';
import { Play, BookOpen } from 'lucide-react';

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
  // 如果有 questionCount 直接使用，否则显示 - 
  const questionCount = bank.questionCount ?? 0;
  
  return (
    <div 
      className={`bg-white rounded-xl p-3 border-2 border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer ${
        questionCount === 0 ? 'opacity-60' : ''
      }`}
      onClick={() => questionCount > 0 && onStartPractice(bank.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2 mb-1">
            {bank.name}
          </h4>
          <div className="flex items-center text-xs text-gray-400">
            <BookOpen className="w-3 h-3 mr-1" />
            {questionCount > 0 ? `${questionCount} 道题` : '暂无题目'}
          </div>
        </div>
        {questionCount > 0 && (
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Play className="w-4 h-4 text-blue-500" />
          </div>
        )}
      </div>
    </div>
  );
}
