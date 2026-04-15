import { NextResponse } from 'next/server';
import { activationCodeService } from '@/lib/services/activation-service';

// 验证用户 token
function verifyUserToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const userData = JSON.parse(Buffer.from(token, 'base64').toString());
    return userData.id || null;
  } catch {
    return null;
  }
}

// GET - 获取用户已激活的分类
export async function GET(request: Request) {
  try {
    const userId = verifyUserToken(request);
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 获取用户已激活的分类ID列表（会自动过滤过期的激活记录）
    const activatedCategoryIds = await activationCodeService.getUserActivatedCategoryIds(userId);

    return NextResponse.json({ 
      success: true, 
      activatedCategories: activatedCategoryIds 
    });
  } catch (error) {
    console.error('获取用户激活分类失败:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}
