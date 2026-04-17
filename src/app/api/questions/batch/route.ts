import { NextResponse } from 'next/server';
import { bankService, Question } from '@/lib/services/bank-service';
import { convertQuestionImageKeys } from '@/lib/image-utils';

// 验证用户 token
function verifyUserToken(request: Request): { userId: string | null } {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { userId: null };
  }

  try {
    const token = authHeader.substring(7);
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    const userId = payload.userId || payload.id || null;
    return { userId };
  } catch {
    return { userId: null };
  }
}

// 批量获取题目（用于预加载，需要用户认证）
export async function POST(request: Request) {
  try {
    // 验证用户认证
    const { userId } = verifyUserToken(request);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: '请先登录' 
      }, { status: 401 });
    }

    const { ids } = await request.json();
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ questions: [] });
    }
    
    // 限制每次最多获取 10 道题目
    const limitedIds = ids.slice(0, 10);
    const questions = await bankService.getQuestionsByIds(limitedIds);
    
    // 将图片 key 转换为签名 URL
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
    
    return NextResponse.json({ questions: processedQuestions });
  } catch (error) {
    console.error('Failed to batch get questions:', error);
    return NextResponse.json({ 
      success: false,
      error: '批量获取失败',
      questions: [] 
    }, { status: 500 });
  }
}
