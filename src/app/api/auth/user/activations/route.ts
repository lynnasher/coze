import { NextResponse } from 'next/server';
import { userService } from '@/lib/services/user-service';

export async function GET(request: Request) {
  try {
    // 获取请求头中的 Authorization
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // 解析 token 获取用户 ID
    let userId: string;
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString());
      userId = payload.userId;
    } catch {
      return NextResponse.json({ success: false, error: '无效的token' }, { status: 401 });
    }

    // 获取用户激活的分类（检查过期时间）
    const activatedCategories = await userService.getActivatedCategories(userId);

    return NextResponse.json({
      success: true,
      activatedCategories,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
