import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 验证 admin token 并返回用户信息
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
    // 解析 token
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // 检查过期
    if (payload.exp && Date.now() > payload.exp) {
      return {
        success: false,
        response: NextResponse.json(
          { error: '登录已过期，请重新登录' },
          { status: 401 }
        ),
      };
    }

    // 验证用户是否存在
    const supabase = getSupabaseClient();
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('id, username')
      .eq('id', payload.userId)
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
