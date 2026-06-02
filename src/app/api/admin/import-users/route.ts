import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/storage/database/supabase-client';
import { requireAdminAuth } from '@/lib/api-auth';

export async function POST(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const { users } = await request.json();
    
    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: '用户数据无效' }, { status: 400 });
    }

    const client = getSupabaseAdminClient();
    
    // 批量插入用户
    const { data, error } = await client
      .from('users')
      .insert(users)
      .select();

    if (error) {
      console.error('导入用户失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      count: data?.length || 0,
      message: `成功导入 ${data?.length || 0} 条用户数据`
    });
  } catch (err) {
    console.error('导入用户异常:', err);
    return NextResponse.json({ error: '导入失败' }, { status: 500 });
  }
}
