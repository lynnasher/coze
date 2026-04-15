import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';

// 批量获取题目（用于预加载）
export async function POST(request: Request) {
  try {
    const { ids } = await request.json();
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ questions: [] });
    }
    
    // 限制每次最多获取 10 道题目
    const limitedIds = ids.slice(0, 10);
    const questions = await bankService.getQuestionsByIds(limitedIds);
    
    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Failed to batch get questions:', error);
    return NextResponse.json({ 
      error: '批量获取失败',
      questions: [] 
    }, { status: 500 });
  }
}
