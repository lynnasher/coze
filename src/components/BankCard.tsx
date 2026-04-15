import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Trash2, BookOpen } from 'lucide-react';
import { QuestionBank, Question } from '@/lib/types';

interface BankCardProps {
  bank: QuestionBank;
  questions: Question[];
  onDelete: (bankId: string) => void;
  onStartPractice: (bankId: string) => void;
}

export function BankCard({ bank, questions, onDelete, onStartPractice }: BankCardProps) {
  const bankQuestions = questions.filter(q => q.id && bank.questionIds.includes(q.id));
  
  return (
    <Card className="overflow-hidden border-0 shadow-lg rounded-2xl hover:shadow-xl transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 leading-tight line-clamp-2">
              {bank.name}
            </h4>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => onDelete(bank.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {bankQuestions.length} 道题
          </span>
          <span>{new Date(bank.createdAt).toLocaleDateString()}</span>
        </div>
        
        <Button
          size="sm"
          className="w-full h-9 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-xl"
          onClick={() => onStartPractice(bank.id)}
          disabled={bankQuestions.length === 0}
        >
          <Play className="w-4 h-4 mr-2" />
          开始练习
        </Button>
      </CardContent>
    </Card>
  );
}
