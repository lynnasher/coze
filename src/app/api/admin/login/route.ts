import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 验证密码强度（至少8位，包含大小写字母和数字）
function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: '密码长度至少8位' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: '密码需包含小写字母' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: '密码需包含大写字母' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码需包含数字' };
  }
  return { valid: true };
}

// 生成 token
function generateToken(user: { id: string; username: string }): string {
  const payload = {
    userId: user.id,
    username: user.username,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24小时后过期
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: '请提供用户名和密码' },
        { status: 400 }
      );
    }

    // 从数据库验证
    const supabase = getSupabaseClient();
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .single();

    console.log('[AdminLogin] Query result:', { admin, error });

    if (error || !admin) {
      console.log('[AdminLogin] User not found or error:', error);
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    console.log('[AdminLogin] Found admin:', admin.username, 'password:', admin.password);

    // 验证密码
    if (admin.password !== password) {
      console.log('[AdminLogin] Password mismatch:', { input: password, stored: admin.password });
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    const token = generateToken({ id: admin.id, username: admin.username });

    // 检查是否需要强制修改密码
    const needChangePassword = admin.is_default_password;

    return NextResponse.json({
      success: true,
      token,
      user: { 
        id: admin.id,
        username: admin.username, 
        role: 'admin',
        isDefaultPassword: admin.is_default_password
      },
      needChangePassword,
    });
  } catch (error) {
    console.error('登录错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 导出方法供其他路由使用
export { validatePasswordStrength };
