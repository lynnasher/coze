'use client';

import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface WrongBookCardProps {
  wrongCount: number;
}

export function WrongBookCard({ wrongCount }: WrongBookCardProps) {
  return (
    <Link href="/wrongbook">
      <Card className="border-0 shadow-sm rounded-xl overflow-hidden bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <BookOpen className="w-4 h-4 text-slate-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-700">错题本</p>
              <p className="text-xs text-slate-500">{wrongCount} 道待复习</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
