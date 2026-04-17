import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/storage/database/supabase-client';

// 验证用户 token
function verifyUserToken(request: Request): { userId: string | null; isAdmin: boolean } {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { userId: null, isAdmin: false };
  }

  try {
    const token = authHeader.substring(7);
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    const userId = payload.userId || payload.id || null;
    const isAdmin = payload.role === 'admin' || payload.isAdmin === true;
    return { userId, isAdmin };
  } catch {
    return { userId: null, isAdmin: false };
  }
}

// 获取/提交统计数据
export async function GET(request: Request) {
  try {
    const { userId } = verifyUserToken(request);
    
    if (!userId) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    // 查询该用户的统计数据
    const client = getSupabaseAdminClient();
    let query = client
      .from('user_stats')
      .select('*')
      .eq('user_id', userId);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, stats: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// 提交统计数据
export async function POST(request: Request) {
  try {
    const { userId } = verifyUserToken(request);
    
    if (!userId) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { categoryId, totalQuestions, correctCount, timeSpent } = body;

    if (!categoryId) {
      return NextResponse.json({ success: false, error: '请提供分类ID' }, { status: 400 });
    }

    // 检查是否已存在该分类的统计数据
    const client = getSupabaseAdminClient();
    const { data: existing } = await client
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .single();

    if (existing) {
      // 更新现有统计数据
      const { error } = await client
        .from('user_stats')
        .update({
          total_questions: (existing.total_questions || 0) + (totalQuestions || 0),
          correct_count: (existing.correct_count || 0) + (correctCount || 0),
          total_time_spent: (existing.total_time_spent || 0) + (timeSpent || 0),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    } else {
      // 创建新统计数据
      const { error } = await client
        .from('user_stats')
        .insert({
          user_id: userId,
          category_id: categoryId,
          total_questions: totalQuestions || 0,
          correct_count: correctCount || 0,
          total_time_spent: timeSpent || 0,
        });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// 删除统计数据（管理员）
export async function DELETE(request: Request) {
  try {
    const { isAdmin } = verifyUserToken(request);
    
    // 只有管理员可以删除统计数据
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: '需要管理员权限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    const client = getSupabaseAdminClient();
    if (id) {
      // 删除指定记录
      const { error } = await client
        .from('user_stats')
        .delete()
        .eq('id', id);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    } else if (userId) {
      // 删除用户的所有统计
      const { error } = await client
        .from('user_stats')
        .delete()
        .eq('user_id', userId);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ success: false, error: '请指定要删除的记录' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
