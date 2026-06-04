import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/storage/database/supabase-client';
import { verifyApiToken } from '@/lib/api-auth';

// 获取用户数据
export async function GET(request: Request) {
  try {
    const { userId, isAdmin } = verifyApiToken(request);
    
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
    // 先尝试从 header/URL 验证 token
    let { userId } = verifyApiToken(request);
    const body = await request.json();
    
    // sendBeacon 场景：token 在 body 中而非 header
    if (!userId && body.token) {
      const { verifyToken } = await import('@/lib/services/user-service');
      const result = verifyToken(body.token);
      if (result.userId && !result.expired) {
        userId = result.userId;
      }
    }
    
    if (!userId) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const { practiceHistory, wrongQuestions, recentlyPracticed, streakData } = body;

    // 验证数据格式
    if (practiceHistory && !Array.isArray(practiceHistory)) {
      return NextResponse.json({ success: false, error: 'practiceHistory 必须是数组' }, { status: 400 });
    }
    if (wrongQuestions && !Array.isArray(wrongQuestions)) {
      return NextResponse.json({ success: false, error: 'wrongQuestions 必须是数组' }, { status: 400 });
    }

    const client = getSupabaseAdminClient();

    // 先获取云端现有数据（用于合并）
    const { data: existingUserData } = await client
      .from('user_data')
      .select('*')
      .eq('user_id', userId)
      .single();

    const existingPracticeHistory = existingUserData?.practice_history || [];
    const existingStreakData = existingUserData?.streak_data || {};

    // 合并 practiceHistory（按 ID 去重，避免竞态覆盖）
    let mergedPracticeHistory = existingPracticeHistory;
    if (practiceHistory !== undefined && Array.isArray(practiceHistory)) {
      const existingIds = new Set(existingPracticeHistory.map((r: any) => r.id).filter(Boolean));
      const newRecords = practiceHistory.filter((r: any) => r.id && !existingIds.has(r.id));
      if (newRecords.length > 0) {
        mergedPracticeHistory = [...existingPracticeHistory, ...newRecords];
      }
    }

    // 合并 streakData（本地覆盖云端）
    const mergedStreakData = streakData !== undefined
      ? { ...existingStreakData, ...streakData }
      : existingStreakData;

    // 合并 recentlyPracticed
    let mergedRecentlyPracticed = existingUserData?.recently_practiced || [];
    if (recentlyPracticed !== undefined && Array.isArray(recentlyPracticed)) {
      const existingIds = new Set(mergedRecentlyPracticed.map((r: any) => r.id).filter(Boolean));
      const newItems = recentlyPracticed.filter((r: any) => r.id && !existingIds.has(r.id));
      if (newItems.length > 0) {
        mergedRecentlyPracticed = [...newItems, ...mergedRecentlyPracticed].slice(0, 50);
      }
    }

    // 构建更新字段（全部基于合并后的数据）
    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      practice_history: mergedPracticeHistory,
      streak_data: mergedStreakData,
      recently_practiced: mergedRecentlyPracticed,
    };
    if (wrongQuestions !== undefined) updateFields.wrong_questions = wrongQuestions;

    if (existingUserData) {
      // 更新现有数据（使用合并后的字段）
      const { error } = await client
        .from('user_data')
        .update(updateFields)
        .eq('user_id', userId);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    } else {
      // 创建新数据
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
    const { userId, isAdmin } = verifyApiToken(request);
    
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
