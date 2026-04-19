import { NextResponse } from 'next/server';
import { activationCodeService } from '@/lib/services/activation-service';
import { userService } from '@/lib/services/user-service';
import { verifyApiToken } from '@/lib/api-auth';

// 使用激活码（用户接口）
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, userId } = body;

    if (!code) {
      return NextResponse.json({ success: false, error: '请提供激活码' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 400 });
    }

    // 使用激活码
    const activation = await activationCodeService.useCode(code, userId);

    // 更新用户的激活分类列表
    const user = await userService.findById(userId);
    if (user) {
      let activatedCategories: string[] = [];
      try {
        activatedCategories = JSON.parse(user.activated_categories || '[]');
      } catch {}
      
      if (!activatedCategories.includes(activation.category_id)) {
        activatedCategories.push(activation.category_id);
        await userService.updateActivatedCategories(userId, activatedCategories);
      }
    }

    return NextResponse.json({
      success: true,
      message: '激活成功',
      activation: {
        category_id: activation.category_id,
        category_name: activation.category_name,
        activated_at: activation.activated_at,
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// 获取用户的激活记录（需要用户认证，普通用户只能查看自己的，管理员可以查看所有）
export async function GET(request: Request) {
  try {
    const { userId, isAdmin } = verifyApiToken(request);
    
    if (!userId) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paramUserId = searchParams.get('userId');

    // 如果是管理员请求，可以指定 userId；否则只能查看自己的
    const targetUserId = isAdmin ? (paramUserId || userId) : userId;

    // 验证权限：非管理员只能查看自己的记录
    if (!isAdmin && paramUserId && paramUserId !== userId) {
      return NextResponse.json({ success: false, error: '无权限查看其他用户的记录' }, { status: 403 });
    }

    const activations = await activationCodeService.getUserActivations(targetUserId);
    const activatedCategoryIds = await activationCodeService.getUserActivatedCategoryIds(targetUserId);

    return NextResponse.json({
      success: true,
      activations,
      activatedCategoryIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
