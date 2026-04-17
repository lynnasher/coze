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

// 获取用户数据
export async function GET(request: Request) {
  try {
    const { userId, isAdmin } = verifyUserToken(request);
    
    if (!userId) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    // 如果指定了 targetUserId，只有管理员可以查看其他用户的数据
    if (targetUserId && targetUserId !== userId && !isAdmin) {
      return NextResponse.json({ success: false, error: '无权限查看其他用户的数据' }, { status: 403 });
    }

    const finalUserId = targetUserId || userId;
    const client = getSupabaseAdminClient();

    const { data, error } = await client
      .from('user_data')
      .select('*')
      .eq('user_id', finalUserId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// 保存用户数据
export async function POST(request: Request) {
  try {
    const { userId } = verifyUserToken(request);
    
    if (!userId) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { practiceHistory, wrongQuestions, recentlyPracticed, streakData } = body;

    // 验证数据格式
    if (practiceHistory && !Array.isArray(practiceHistory)) {
      return NextResponse.json({ success: false, error: 'practiceHistory 必须是数组' }, { status: 400 });
    }
    if (wrongQuestions && !Array.isArray(wrongQuestions)) {
      return NextResponse.json({ success: false, error: 'wrongQuestions 必须是数组' }, { status: 400 });
    }

    const client = getSupabaseAdminClient();

    // 只构建需要更新的字段（部分更新，避免覆盖未提供的字段）
    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (practiceHistory !== undefined) updateFields.practice_history = practiceHistory;
    if (wrongQuestions !== undefined) updateFields.wrong_questions = wrongQuestions;
    if (recentlyPracticed !== undefined) updateFields.recently_practiced = recentlyPracticed;
    if (streakData !== undefined) updateFields.streak_data = streakData;

    // 检查是否已存在数据
    const { data: existingData } = await client
      .from('user_data')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingData) {
      // 更新现有数据（只更新提供的字段）
      const { error } = await client
        .from('user_data')
        .update(updateFields)
        .eq('user_id', userId);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    } else {
      // 创建新数据（使用完整字段，未提供的用默认值）
      const { error } = await client
        .from('user_data')
        .insert({
          user_id: userId,
          practice_history: practiceHistory || [],
          wrong_questions: wrongQuestions || [],
          recently_practiced: recentlyPracticed || [],
          streak_data: streakData || {},
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

// 删除用户数据（管理员）
export async function DELETE(request: Request) {
  try {
    const { userId, isAdmin } = verifyUserToken(request);
    
    // 只有管理员可以删除用户数据
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: '需要管理员权限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json({ success: false, error: '请指定用户ID' }, { status: 400 });
    }

    const client = getSupabaseAdminClient();
    const { error } = await client
      .from('user_data')
      .delete()
      .eq('user_id', targetUserId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
