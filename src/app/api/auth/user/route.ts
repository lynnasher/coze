import { NextResponse } from 'next/server';
import { userService, initDefaultAdmin } from '@/lib/services/user-service';

// 初始化默认管理员
let adminInitialized = false;

export async function POST(request: Request) {
  try {
    // 首次调用时初始化管理员
    if (!adminInitialized) {
      await initDefaultAdmin();
      adminInitialized = true;
    }

    const body = await request.json();
    const { type, phone, password, nickname, username } = body;

    if (type === 'register') {
      // 用户注册
      if (!phone || !password) {
        return NextResponse.json({ success: false, error: '请提供手机号和密码' }, { status: 400 });
      }

      // 验证手机号格式
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        return NextResponse.json({ success: false, error: '请输入正确的手机号' }, { status: 400 });
      }

      // 验证密码长度
      if (password.length < 6) {
        return NextResponse.json({ success: false, error: '密码长度至少6位' }, { status: 400 });
      }

      // 检查是否已注册
      const existingUser = await userService.findByPhone(phone);
      if (existingUser) {
        return NextResponse.json({ success: false, error: '该手机号已注册' }, { status: 400 });
      }

      const { user, token } = await userService.register(phone, password, nickname);

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname,
          role: user.role,
          activated_categories: [],
        },
        token,
      });
    }

    if (type === 'login') {
      // 用户登录
      if (!phone || !password) {
        return NextResponse.json({ success: false, error: '请提供手机号和密码' }, { status: 400 });
      }

      const { user, token } = await userService.login(phone, password);
      
      // 解析激活的分类
      let activatedCategories: string[] = [];
      try {
        activatedCategories = JSON.parse(user.activated_categories || '[]');
      } catch {}

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname,
          role: user.role,
          activated_categories: activatedCategories,
        },
        token,
      });
    }

    if (type === 'admin_login') {
      // 管理员登录
      if (!username || !password) {
        return NextResponse.json({ success: false, error: '请提供用户名和密码' }, { status: 400 });
      }

      const { user, token } = await userService.adminLogin(username, password);
      
      // 解析激活的分类
      let activatedCategories: string[] = [];
      try {
        activatedCategories = JSON.parse(user.activated_categories || '[]');
      } catch {}

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname,
          role: user.role,
          activated_categories: activatedCategories,
        },
        token,
      });
    }

    return NextResponse.json({ success: false, error: '未知的操作类型' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
