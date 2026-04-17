import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 验证 admin token
export async function verifyAdminToken(request: Request): Promise<{
  valid: boolean;
  userId?: string;
  username?: string;
  error?: string;
}> {
  // 从 header 获取 token
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return { valid: false, error: '未提供认证令牌' };
  }

  try {
    // 解析 token
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // 检查过期
    if (payload.exp && Date.now() > payload.exp) {
      return { valid: false, error: '令牌已过期' };
    }

    // 验证用户是否存在
    const supabase = getSupabaseClient();
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('id, username')
      .eq('id', payload.userId)
      .single();

    if (error || !admin) {
      return { valid: false, error: '用户不存在' };
    }

    return {
      valid: true,
      userId: admin.id,
      username: admin.username,
    };
  } catch {
    return { valid: false, error: '无效的令牌' };
  }
}

// 登录限流配置
const LOGIN_RATE_LIMIT = {
  maxAttempts: 5,        // 最多尝试次数
  windowMs: 15 * 60 * 1000,  // 15分钟内
};

// 登录尝试记录（内存存储，生产环境建议用 Redis）
const loginAttempts = new Map<string, { count: number; resetTime: number }>();

export function checkLoginRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  // 如果记录不存在或已过期，创建新记录
  if (!record || now > record.resetTime) {
    loginAttempts.set(ip, { count: 1, resetTime: now + LOGIN_RATE_LIMIT.windowMs });
    return { allowed: true, remaining: LOGIN_RATE_LIMIT.maxAttempts - 1 };
  }

  // 如果已达上限
  if (record.count >= LOGIN_RATE_LIMIT.maxAttempts) {
    return { allowed: false, remaining: 0 };
  }

  // 增加计数
  record.count++;
  return { allowed: true, remaining: LOGIN_RATE_LIMIT.maxAttempts - record.count };
}

// 获取客户端 IP
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}
