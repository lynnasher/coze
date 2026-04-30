import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, userService } from '@/lib/services/user-service';

export async function POST(request: NextRequest) {
  try {
    // 获取 token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ success: false, error: 'Token无效' }, { status: 401 });
    }

    const { oldPassword, newPassword } = await request.json();

    // 验证输入
    if (!oldPassword || !newPassword) {
      return NextResponse.json({ success: false, error: '请输入原密码和新密码' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ success: false, error: '新密码至少6位' }, { status: 400 });
    }

    // 获取用户信息
    const user = await userService.findById(payload.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    // 验证原密码
    const { verifyPassword } = await import('@/lib/services/user-service');
    const isPasswordValid = verifyPassword(oldPassword, user.password);

    if (!isPasswordValid) {
      return NextResponse.json({ success: false, error: '原密码错误' }, { status: 400 });
    }

    // 更新密码
    await userService.changePassword(user.id, newPassword);

    return NextResponse.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '修改密码失败' },
      { status: 500 }
    );
  }
}
