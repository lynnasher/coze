import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { checkLoginRateLimit, getClientIP } from '@/lib/admin-auth';
import { generateToken, verifyPassword, hashPassword, generateDeviceId } from '@/lib/services/user-service';
import { verifyCaptchaToken } from '../captcha/route';

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
    // 检查登录频率限制
    const clientIP = getClientIP(request);
    const rateLimit = checkLoginRateLimit(clientIP);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '登录尝试次数过多，请15分钟后再试' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { username, password, captchaToken, captchaInput } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: '请提供用户名和密码' },
        { status: 400 }
      );
    }

    // 后端校验验证码
    if (!captchaToken || !captchaInput) {
      return NextResponse.json(
        { error: '请提供验证码' },
        { status: 400 }
      );
    }
    if (!verifyCaptchaToken(captchaToken, captchaInput)) {
      return NextResponse.json(
        { error: '验证码错误或已过期' },
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

    if (error || !admin) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 验证密码（支持旧格式 base64 和新格式 scrypt）
    if (!verifyPassword(password, admin.password)) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 如果密码是旧格式（base64 或明文），自动升级为 scrypt 哈希
    if (!admin.password.includes(':')) {
      const newHash = hashPassword(password);
      await supabase
        .from('admin_users')
        .update({ password: newHash })
        .eq('id', admin.id);
    }

    const token = generateToken(admin.id, 'admin');
    
    // 生成设备ID并更新到数据库（单设备登录控制）
    const deviceId = generateDeviceId();
    await supabase
      .from('admin_users')
      .update({ device_id: deviceId })
      .eq('id', admin.id);

    // 检查是否需要强制修改密码
    const needChangePassword = admin.is_default_password;

    return NextResponse.json({
      success: true,
      token,
      deviceId, // 返回 deviceId 给前端
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
