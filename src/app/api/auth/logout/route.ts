import { NextResponse } from 'next/server';
import { userService, verifyToken } from '@/lib/services/user-service';

/**
 * 用户退出登录接口
 * 清除数据库中的 device_id，实现服务端退出
 * POST /api/auth/logout
 * Headers: Authorization: Bearer <token>
 */
export async function POST(request: Request) {
  try {
    // 从请求头获取 token
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    console.log(`[Logout API] 收到退出请求: token=${token ? 'present' : 'missing'}`);

    if (!token) {
      return NextResponse.json({
        success: false,
        error: '未提供登录凭证'
      }, { status: 401 });
    }

    // 验证 token 并获取用户ID
    const { userId, expired } = verifyToken(token);
    
    console.log(`[Logout API] Token验证: userId=${userId}, expired=${expired}`);

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: expired ? '登录已过期' : '无效的登录凭证'
      }, { status: 401 });
    }

    // 调用服务层清除数据库中的 device_id
    await userService.logout(userId);

    return NextResponse.json({
      success: true,
      message: '退出成功'
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    console.error('[Logout API] 退出出错:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
