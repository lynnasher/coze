import { NextResponse } from 'next/server';
import { verifyToken, userService, hashPassword } from '@/lib/services/user-service';

export async function POST(request: Request) {
  try {
    // 验证用户token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    const { newPassword, userId } = await request.json();
    
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: '新密码长度不能少于6位' }, { status: 400 });
    }

    // 验证权限：用户只能修改自己的密码，除非是管理员
    const targetUserId = userId || user.userId;
    if (targetUserId !== user.userId && user.role !== 'admin') {
      return NextResponse.json({ error: '无权修改他人密码' }, { status: 403 });
    }

    // 使用与登录验证一致的 hashPassword 函数加密新密码
    const hashedPassword = hashPassword(newPassword);

    // 更新密码并重置 force_password_change
    await userService.updateUserPassword(targetUserId, hashedPassword);
    await userService.updateForcePasswordChange(targetUserId, false);
    return NextResponse.json({ success: true, message: '密码修改成功' });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
