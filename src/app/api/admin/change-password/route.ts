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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, oldPassword, newPassword } = body;

    // 验证请求参数
    if (!username || !oldPassword || !newPassword) {
      return NextResponse.json(
        { error: '请提供完整的参数' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseClient();

    // 查询管理员
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !admin) {
      return NextResponse.json(
        { error: '管理员不存在' },
        { status: 404 }
      );
    }

    // 验证旧密码
    if (admin.password !== oldPassword) {
      return NextResponse.json(
        { error: '当前密码错误' },
        { status: 401 }
      );
    }

    // 验证新密码强度
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.message },
        { status: 400 }
      );
    }

    // 更新密码到数据库
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({
        password: newPassword,
        is_default_password: false,
        last_changed: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('username', username);

    if (updateError) {
      console.error('更新密码失败:', updateError);
      return NextResponse.json(
        { error: '密码保存失败，请重试' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '密码修改成功',
    });
  } catch (error) {
    console.error('修改密码错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
