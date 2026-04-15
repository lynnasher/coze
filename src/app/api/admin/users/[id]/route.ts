import { NextResponse } from 'next/server';
import { userService } from '@/lib/services/user-service';

// 更新用户状态
export async function PUT(request: Request) {
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
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { userId } = body;

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
