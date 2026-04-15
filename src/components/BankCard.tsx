import { Card, CardContent } from '@/components/ui/card';
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
    <Card className="overflow-hidden border-0 shadow-lg rounded-2xl hover:shadow-xl transition-shadow bg-white">
      <CardContent className="p-4">
        <div className="mb-3">
          <h4 className="font-semibold text-gray-900 leading-tight line-clamp-2">
            {bank.name}
          </h4>
        </div>
        
        <div className="flex items-center text-xs text-gray-400 mb-3">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {questionCount > 0 ? `${questionCount} 道题` : '暂无题目'}
          </span>
        </div>
        
        <Button
          size="sm"
          className="w-full h-9 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-xl"
          onClick={() => onStartPractice(bank.id)}
          disabled={questionCount === 0}
        >
          <Play className="w-4 h-4 mr-2" />
          开始练习
        </Button>
      </CardContent>
    </Card>
  );
}
