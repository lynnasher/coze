import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';
import { userService } from '@/lib/services/user-service';
import { activationCodeService } from '@/lib/services/activation-service';

// 获取题库列表（需要用户认证，且只能获取已激活分类的题库）
export async function GET(request: Request) {
  try {
    // 获取用户 token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: '请先登录',
        banks: [],
        total: 0 
      }, { status: 401 });
    }

    try {
      const token = authHeader.substring(7);
      const payload = JSON.parse(Buffer.from(token, 'base64').toString());
      
      if (payload.exp && payload.exp < Date.now()) {
        return NextResponse.json({ 
          error: '登录已过期，请重新登录',
          banks: [],
          total: 0 
        }, { status: 401 });
      }

      const userId = payload.userId;
      const user = await userService.findById(userId);

      if (!user) {
        return NextResponse.json({ 
          error: '用户不存在',
          banks: [],
          total: 0 
        }, { status: 401 });
      }

      if (user.status === 'banned') {
        return NextResponse.json({ 
          error: '账号已被禁用',
          banks: [],
          total: 0 
        }, { status: 403 });
      }

      // 获取用户已激活的分类ID列表（从 user_activations 表中查询，会自动过滤过期记录）
      const validCategories = await activationCodeService.getUserActivatedCategoryIds(userId);

      // 获取所有题库
      const allBanks = await bankService.getAllBanks();
      
      // 过滤只显示已激活分类的题库
      const banks = allBanks.filter(bank => 
        bank.category_id && validCategories.includes(bank.category_id)
      );

      return NextResponse.json({ 
        banks,
        total: banks.length 
      });
    } catch (error) {
      console.error('获取题库失败:', error);
      return NextResponse.json({ 
        error: '获取失败',
        banks: [],
        total: 0 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('获取题库失败:', error);
    return NextResponse.json({ 
      error: '获取失败',
      banks: [],
      total: 0 
    }, { status: 500 });
  }
}
