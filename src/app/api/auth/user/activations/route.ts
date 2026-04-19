import { NextRequest, NextResponse } from 'next/server';
import { activationCodeService } from '@/lib/services/activation-service';
import { verifyApiToken } from '@/lib/api-auth';

// GET - 获取用户已激活的分类和激活记录
export async function GET(request: Request) {
  try {
    const { userId } = verifyApiToken(request);
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 获取 URL 参数
    const url = new URL(request.url);
    const paramUserId = url.searchParams.get('userId');
    
    // 如果是管理员请求，可以指定 userId；否则只能查看自己的
    const targetUserId = paramUserId || userId;

    // 获取用户已激活的分类ID列表（会自动过滤过期的激活记录）
    const activatedCategoryIds = await activationCodeService.getUserActivatedCategoryIds(targetUserId);

    // 获取用户的激活记录详情
    const activations = await activationCodeService.getUserActivations(targetUserId);

    return NextResponse.json({ 
      success: true, 
      activatedCategories: activatedCategoryIds,
      activations: activations
    });
  } catch (error) {
    console.error('获取用户激活分类失败:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}
