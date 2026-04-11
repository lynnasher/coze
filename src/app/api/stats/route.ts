import { NextRequest, NextResponse } from 'next/server';
import { recordStore, calculateStats, generateId } from '@/lib/quiz-store';
import { PracticeRecord } from '@/lib/types';

export async function GET() {
  try {
    const stats = calculateStats();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionId, isCorrect, selectedAnswer } = body;
    
    const record: PracticeRecord = {
      id: generateId(),
      questionId,
      isCorrect,
      selectedAnswer,
      timestamp: Date.now(),
    };
    
    recordStore.add(record);
    
    const stats = calculateStats();
    
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}
