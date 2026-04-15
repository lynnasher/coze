import { NextResponse } from 'next/server';
import { userService } from '@/lib/services/user-service';

// 获取所有用户
export async function GET() {
  try {
    const users = await userService.getAllUsers();
    
    // 返回脱敏的用户信息，并解析 activated_categories
    const safeUsers = users.map(u => {
      let activatedCategories: string[] = [];
      if (u.activated_categories) {
        try {
          activatedCategories = JSON.parse(u.activated_categories);
        } catch {
          activatedCategories = [];
        }
      }
      return {
        id: u.id,
        phone: u.phone,
        nickname: u.nickname,
        role: u.role,
        status: u.status,
        activated_categories: activatedCategories,
        created_at: u.created_at,
        last_login_at: u.last_login_at,
      };
    });

    return NextResponse.json({ success: true, users: safeUsers });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
