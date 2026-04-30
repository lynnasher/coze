import { NextResponse } from 'next/server';
import { userService } from '@/lib/services/user-service';
import { requireAdminAuth } from '@/lib/api-auth';

// 更新用户状态
export async function PUT(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { userId, action, value } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: '请提供用户ID' }, { status: 400 });
    }

    if (action === 'status') {
      if (value !== 'active' && value !== 'banned') {
        return NextResponse.json({ success: false, error: '无效的状态值' }, { status: 400 });
      }
      await userService.updateUserStatus(userId, value);
    } else if (action === 'role') {
      if (value !== 'user' && value !== 'admin') {
        return NextResponse.json({ success: false, error: '无效的角色值' }, { status: 400 });
      }
      await userService.updateUserRole(userId, value);
    } else if (action === 'categories') {
      if (!Array.isArray(value)) {
        return NextResponse.json({ success: false, error: '分类必须是数组' }, { status: 400 });
      }
      await userService.updateActivatedCategories(userId, value);
    } else if (action === 'password') {
      // 修改用户密码
      const { password } = body;
      if (!password || typeof password !== 'string' || password.length < 6) {
        return NextResponse.json({ success: false, error: '密码至少6位' }, { status: 400 });
      }
      await userService.updateUserPassword(userId, password);
    } else {
      return NextResponse.json({ success: false, error: '未知的操作' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// 删除用户
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const { id: userId } = await params;

    if (!userId) {
      return NextResponse.json({ success: false, error: '请提供用户ID' }, { status: 400 });
    }

    await userService.deleteUser(userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
