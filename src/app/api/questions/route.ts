import { NextResponse } from 'next/server';
import { bankService, Question } from '@/lib/services/bank-service';
import { convertQuestionImageKeys } from '@/lib/image-utils';

// 获取题库的所有题目（只需要认证，不需要检查分类权限）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bankId = searchParams.get('bankId');
    const categoryId = searchParams.get('categoryId');

    if (!bankId && !categoryId) {
      return NextResponse.json({ 
        error: '请提供题库ID或分类ID',
        questions: [],
        total: 0 
      }, { status: 400 });
    }

    let questions: Question[];
    
    if (categoryId) {
      // 按分类获取所有题目
      questions = await bankService.getQuestionsByCategoryId(categoryId);
    } else if (bankId) {
      // 按题库获取题目
      const bank = await bankService.getBankById(bankId);
      if (!bank) {
        return NextResponse.json({ 
          error: '题库不存在',
          questions: [],
          total: 0 
        }, { status: 404 });
      }
      questions = await bankService.getQuestionsByBankId(bankId);
    } else {
      return NextResponse.json({ 
        error: '参数错误',
        questions: [],
        total: 0 
      }, { status: 400 });
    }

    // 转换题目中的图片 key 为签名 URL
    const processedQuestions = await Promise.all(
      questions.map(async (q: Question) => {
        const converted = await convertQuestionImageKeys({
          content: q.content,
          options: q.options,
          explanation: q.explanation,
          caseBackground: q.caseBackground,
        });
        return { ...q, ...converted };
      })
    );

    return NextResponse.json({ 
      questions: processedQuestions,
      total: processedQuestions.length,
      bankName: bankId ? (await bankService.getBankById(bankId))?.name : undefined
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
