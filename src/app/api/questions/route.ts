import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';

// 公开 API - 获取题库的所有题目（不需要认证）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bankId = searchParams.get('bankId');
    const categoryId = searchParams.get('categoryId');
    
    let questions;
    if (categoryId) {
      // 按分类获取所有题目
      questions = await bankService.getQuestionsByCategoryId(categoryId);
    } else if (bankId) {
      questions = await bankService.getQuestionsByBankId(bankId);
    } else {
      questions = await bankService.getAllQuestions();
    }
    
    return NextResponse.json({ 
      questions,
      total: questions.length 
    });
  } catch (error) {
    console.error('Failed to get questions:', error);
    return NextResponse.json({ 
      error: '获取失败',
      questions: [],
      total: 0 
    }, { status: 500 });
  }
}
