import { NextResponse } from 'next/server';
import { bankService, Question } from '@/lib/services/bank-service';
import { convertQuestionImageKeys } from '@/lib/image-utils';
import { userService } from '@/lib/services/user-service';

// 获取题库的所有题目（需要用户认证，且只能获取已激活分类的题目）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bankId = searchParams.get('bankId');
    const categoryId = searchParams.get('categoryId');

    // 获取用户 token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: '请先登录',
        questions: [],
        total: 0 
      }, { status: 401 });
    }

    let userId: string;
    try {
      const token = authHeader.substring(7);
      const payload = JSON.parse(Buffer.from(token, 'base64').toString());
      
      if (payload.exp < Date.now()) {
        return NextResponse.json({ 
          error: '登录已过期，请重新登录',
          questions: [],
          total: 0 
        }, { status: 401 });
      }
      userId = payload.userId;
    } catch {
      return NextResponse.json({ 
        error: '登录已过期，请重新登录',
        questions: [],
        total: 0 
      }, { status: 401 });
    }

    const user = await userService.findById(userId);
    if (!user) {
      return NextResponse.json({ 
        error: '用户不存在',
        questions: [],
        total: 0 
      }, { status: 401 });
    }

    if (user.status === 'banned') {
      return NextResponse.json({ 
        error: '账号已被禁用',
        questions: [],
        total: 0 
      }, { status: 403 });
    }

    // 获取用户已激活且未过期的分类
    const activatedCategories = user.activated_categories || [];
    const now = new Date();
    const validCategories: string[] = [];
    
    for (const catId of activatedCategories) {
      const codes = await userService.getUserActivationCodes(userId);
      const activation = codes.find((c: { category_id: string }) => c.category_id === catId);
      
      if (activation) {
        if (!activation.expires_at || new Date(activation.expires_at) > now) {
          validCategories.push(catId);
        }
      } else {
        validCategories.push(catId);
      }
    }

    let questions: Question[];
    if (categoryId) {
      // 按分类获取所有题目
      // 验证用户是否有该分类的权限
      if (!validCategories.includes(categoryId)) {
        return NextResponse.json({ 
          error: '您没有该分类的访问权限，请先激活',
          questions: [],
          total: 0 
        }, { status: 403 });
      }
      questions = await bankService.getQuestionsByCategoryId(categoryId);
    } else if (bankId) {
      // 按题库获取题目
      // 验证用户是否有该题库的权限
      const bank = await bankService.getBankById(bankId);
      if (!bank) {
        return NextResponse.json({ 
          error: '题库不存在',
          questions: [],
          total: 0 
        }, { status: 404 });
      }
      if (bank.category_id && !validCategories.includes(bank.category_id)) {
        return NextResponse.json({ 
          error: '您没有该题库的访问权限，请先激活',
          questions: [],
          total: 0 
        }, { status: 403 });
      }
      questions = await bankService.getQuestionsByBankId(bankId);
    } else {
      // 获取所有题目 - 只返回有权限的分类的题目
      questions = await bankService.getAllQuestions();
      // 过滤题目所属的题库是否有权限
      const banks = await bankService.getAllBanks();
      const allowedBankIds = new Set(
        banks
          .filter(b => b.category_id && validCategories.includes(b.category_id))
          .map(b => b.id)
      );
      questions = questions.filter(q => q.bankId && allowedBankIds.has(q.bankId));
    }
    
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
    
    return NextResponse.json({ 
      questions: processedQuestions,
      total: processedQuestions.length 
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
