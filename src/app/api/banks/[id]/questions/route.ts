import { NextResponse } from 'next/server';
import { bankService, Question as BankQuestion } from '@/lib/services/bank-service';
import { convertQuestionImageKeys } from '@/lib/image-utils';

// GET - 获取题库的所有题目（公开接口）
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const questions = await bankService.getQuestionsByBankId(id);
    
    // 将图片 key 转换为签名 URL
    const processedQuestions = await Promise.all(
      questions.map(async (q: BankQuestion) => {
        const converted = await convertQuestionImageKeys({
          content: q.content,
          options: q.options,
          explanation: q.explanation,
          caseBackground: q.caseBackground,
        });
        return { ...q, ...converted };
      })
    );
    
    return NextResponse.json({ questions: processedQuestions });
  } catch (error) {
    console.error('Failed to get questions:', error);
    return NextResponse.json({ error: '获取题目失败', questions: [] }, { status: 500 });
  }
}
