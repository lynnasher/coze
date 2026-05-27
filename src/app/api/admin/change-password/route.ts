import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireAdminAuth } from '@/lib/api-auth';
import { verifyPassword, hashPassword } from '@/lib/services/user-service';
import crypto from 'crypto';

// 生成设备ID
function generateDeviceId(): string {
  return `device_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

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
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { oldPassword, newPassword } = body;

    // 验证请求参数
    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { error: '请提供完整的参数' },
        { status: 400 }
      );
    }

    // 使用认证信息中的用户名
    const username = auth.username;
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

    // 验证旧密码（支持旧格式 base64 和新格式 scrypt）
    if (!verifyPassword(oldPassword, admin.password)) {
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

    // 生成新的设备ID（修改密码后踢掉其他设备）
    const newDeviceId = generateDeviceId();

    // 更新密码到数据库（使用 scrypt 哈希）
    const hashedNewPassword = hashPassword(newPassword);
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({
        password: hashedNewPassword,
        is_default_password: false,
        last_changed: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        device_id: newDeviceId, // 更新设备ID，使其他设备被踢下线
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
      deviceId: newDeviceId, // 返回新的设备ID
    });
  } catch (error) {
    console.error('修改密码错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
