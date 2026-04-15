import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';

// GET - 获取题库的所有题目
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const questions = await bankService.getQuestionsByBankId(id);
    
    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Failed to get questions:', error);
    return NextResponse.json({ error: '获取题目失败' }, { status: 500 });
  }
}
