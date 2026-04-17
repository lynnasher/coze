import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';
import { userService } from '@/lib/services/user-service';

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
      
      if (payload.exp < Date.now()) {
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

      // 获取用户已激活的分类
      const activatedCategories = user.activated_categories || [];
      
      // 检查激活码是否过期
      const now = new Date();
      const validCategories: string[] = [];
      
      for (const catId of activatedCategories) {
        // 获取该分类的激活码信息
        const codes = await userService.getUserActivationCodes(userId);
        const activation = codes.find((c: { category_id: string }) => c.category_id === catId);
        
        if (activation) {
          if (!activation.expires_at || new Date(activation.expires_at) > now) {
            validCategories.push(catId);
          }
        } else {
          // 如果没有找到激活码记录，检查是否有过期的激活记录
          validCategories.push(catId);
        }
      }

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
    } catch {
      return NextResponse.json({ 
        error: '登录已过期，请重新登录',
        banks: [],
        total: 0 
      }, { status: 401 });
    }
  } catch (error) {
    console.error('Failed to get banks:', error);
    return NextResponse.json({ 
      error: '获取失败',
      banks: [],
      total: 0 
    }, { status: 500 });
  }
}
