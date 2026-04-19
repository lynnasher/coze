import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyToken } from '@/lib/services/user-service';

/**
 * 统一的 API Token 验证工具
 * 支持 Authorization header 和 URL 查询参数（sendBeacon 场景）
 * 使用 HMAC 签名验证，防止 token 伪造
 */
export function verifyApiToken(request: Request): { userId: string | null; isAdmin: boolean; expired: boolean } {
  // 优先从 Authorization header 读取
  let token: string | null = null;
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // header 中没有 token 时，从 URL 查询参数读取（sendBeacon 场景）
  if (!token) {
    try {
      const { searchParams } = new URL(request.url);
      token = searchParams.get('token');
    } catch {
      // URL 解析失败
    }
  }

  if (!token) {
    return { userId: null, isAdmin: false, expired: false };
  }

  const result = verifyToken(token);
  return {
    userId: result.userId,
    isAdmin: result.role === 'admin',
    expired: result.expired,
  };
}

/**
 * 验证管理员 Token 并返回用户信息
 * 用于后台管理接口的认证守卫
 */
export async function requireAdminAuth(request: Request): Promise<{
  success: true;
  userId: string;
  username: string;
} | {
  success: false;
  response: NextResponse;
}> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return {
      success: false,
      response: NextResponse.json(
        { error: '未提供认证令牌，请先登录' },
        { status: 401 }
      ),
    };
  }

  try {
    // 使用 HMAC 签名验证
    const result = verifyToken(token);

    if (result.expired) {
      return {
        success: false,
        response: NextResponse.json(
          { error: '登录已过期，请重新登录' },
          { status: 401 }
        ),
      };
    }

    if (!result.userId) {
      return {
        success: false,
        response: NextResponse.json(
          { error: '无效的认证令牌' },
          { status: 401 }
        ),
      };
    }

    // 验证用户是否存在且是管理员
    const supabase = getSupabaseClient();
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('id, username')
      .eq('id', result.userId)
      .single();

    if (error || !admin) {
      return {
        success: false,
        response: NextResponse.json(
          { error: '用户不存在' },
          { status: 401 }
        ),
      };
    }

    return {
      success: true,
      userId: admin.id,
      username: admin.username,
    };
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: '无效的认证令牌' },
        { status: 401 }
      ),
    };
  }
}
