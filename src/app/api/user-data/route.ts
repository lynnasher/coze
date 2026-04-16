import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { practiceRecords, wrongQuestionStreaks, recentPractices } from '@/storage/database/shared/schema';

// 获取用户练习记录
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') || 'records'; // records, streaks, recent
    
    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    if (type === 'records') {
      // 获取用户的练习记录
      const { data, error } = await client
        .from('practice_records')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(1000);
      
      if (error) throw error;
      return NextResponse.json({ records: data || [] });
    }
    
    if (type === 'streaks') {
      // 获取用户的错题连续正确次数
      const { data, error } = await client
        .from('wrong_question_streaks')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      return NextResponse.json({ streaks: data || [] });
    }
    
    if (type === 'recent') {
      // 获取用户最近练习记录
      const { data, error } = await client
        .from('recent_practices')
        .select('*')
        .eq('user_id', userId)
        .order('last_practice_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return NextResponse.json({ recentPractices: data || [] });
    }
    
    return NextResponse.json({ error: '未知类型' }, { status: 400 });
  } catch (error) {
    console.error('获取用户数据失败:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// 保存用户练习记录
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, userId, data: requestData } = body;
    
    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    // 保存练习记录
    if (action === 'save_records') {
      const records = requestData.records || [];
      if (records.length === 0) {
        return NextResponse.json({ success: true, count: 0 });
      }
      
      const recordsToInsert = records.map((record: {
        id: string;
        questionId: string;
        isCorrect: boolean;
        selectedAnswer: string | string[];
        bankId?: string;
        bankName?: string;
        questionType?: string;
        timeSpent?: number;
        timestamp: number;
      }) => ({
        id: record.id,
        user_id: userId,
        question_id: record.questionId,
        is_correct: record.isCorrect,
        selected_answer: Array.isArray(record.selectedAnswer) ? record.selectedAnswer.join(',') : String(record.selectedAnswer || ''),
        bank_id: record.bankId || null,
        bank_name: record.bankName || null,
        question_type: record.questionType || null,
        time_spent: record.timeSpent || 0,
        timestamp: new Date(record.timestamp).toISOString(),
      }));
      
      const { error } = await client
        .from('practice_records')
        .upsert(recordsToInsert, { onConflict: 'id' });
      
      if (error) throw error;
      return NextResponse.json({ success: true, count: records.length });
    }
    
    // 保存错题连续正确次数
    if (action === 'save_streaks') {
      const streaks = requestData.streaks || {};
      const streakRecords = Object.entries(streaks).map(([questionId, streak]: [string, unknown]) => ({
        id: `${userId}_${questionId}`,
        user_id: userId,
        question_id: questionId,
        streak: streak as number,
        updated_at: new Date().toISOString(),
      }));
      
      if (streakRecords.length > 0) {
        const { error } = await client
          .from('wrong_question_streaks')
          .upsert(streakRecords, { onConflict: 'id' });
        
        if (error) throw error;
      }
      
      return NextResponse.json({ success: true, count: streakRecords.length });
    }
    
    // 保存最近练习记录
    if (action === 'save_recent') {
      const recent = requestData;
      if (!recent) {
        return NextResponse.json({ success: true });
      }
      
      const recordToUpsert = {
        id: recent.id || `${userId}_${recent.bankId}`,
        user_id: userId,
        bank_id: recent.bankId,
        bank_name: recent.bankName || null,
        mode: recent.mode || 'sequential',
        total_count: recent.totalCount || 0,
        answered_count: recent.answeredCount || 0,
        correct_count: recent.correctCount || 0,
        wrong_count: recent.wrongCount || 0,
        current_index: recent.currentIndex || 0,
        is_completed: recent.isCompleted || false,
        started_at: recent.startedAt ? new Date(recent.startedAt).toISOString() : new Date().toISOString(),
        last_practice_at: recent.lastPracticeAt ? new Date(recent.lastPracticeAt).toISOString() : new Date().toISOString(),
      };
      
      const { error } = await client
        .from('recent_practices')
        .upsert(recordToUpsert, { onConflict: 'id' });
      
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    
    // 批量同步所有数据
    if (action === 'sync_all') {
      const { records, streaks, recentPractice } = requestData;
      
      // 同步练习记录
      if (records && records.length > 0) {
        const recordsToInsert = records.map((record: {
          id: string;
          questionId: string;
          isCorrect: boolean;
          selectedAnswer: string | string[];
          bankId?: string;
          bankName?: string;
          questionType?: string;
          timeSpent?: number;
          timestamp: number;
        }) => ({
          id: record.id,
          user_id: userId,
          question_id: record.questionId,
          is_correct: record.isCorrect,
          selected_answer: Array.isArray(record.selectedAnswer) ? record.selectedAnswer.join(',') : String(record.selectedAnswer || ''),
          bank_id: record.bankId || null,
          bank_name: record.bankName || null,
          question_type: record.questionType || null,
          time_spent: record.timeSpent || 0,
          timestamp: new Date(record.timestamp).toISOString(),
        }));
        
        await client.from('practice_records').upsert(recordsToInsert, { onConflict: 'id' });
      }
      
      // 同步错题连续正确次数
      if (streaks && Object.keys(streaks).length > 0) {
        const streakRecords = Object.entries(streaks).map(([questionId, streak]: [string, unknown]) => ({
          id: `${userId}_${questionId}`,
          user_id: userId,
          question_id: questionId,
          streak: streak as number,
          updated_at: new Date().toISOString(),
        }));
        
        await client.from('wrong_question_streaks').upsert(streakRecords, { onConflict: 'id' });
      }
      
      // 同步最近练习记录
      if (recentPractice) {
        await client.from('recent_practices').upsert({
          id: `${userId}_${recentPractice.bankId}`,
          user_id: userId,
          bank_id: recentPractice.bankId,
          bank_name: recentPractice.bankName || null,
          mode: recentPractice.mode || 'sequential',
          total_count: recentPractice.totalCount || 0,
          answered_count: recentPractice.answeredCount || 0,
          correct_count: recentPractice.correctCount || 0,
          wrong_count: recentPractice.wrongCount || 0,
          current_index: recentPractice.currentIndex || 0,
          is_completed: recentPractice.isCompleted || false,
          started_at: recentPractice.startedAt ? new Date(recentPractice.startedAt).toISOString() : new Date().toISOString(),
          last_practice_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      }
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('保存用户数据失败:', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

// 从云端拉取并合并本地数据
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { userId, localRecords, localStreaks, localRecentPractices } = body;
    
    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    // 获取云端练习记录
    const { data: cloudRecords } = await client
      .from('practice_records')
      .select('*')
      .eq('user_id', userId);
    
    // 获取云端错题连续正确次数
    const { data: cloudStreaks } = await client
      .from('wrong_question_streaks')
      .select('*')
      .eq('user_id', userId);
    
    // 获取云端最近练习记录
    const { data: cloudRecentPractices } = await client
      .from('recent_practices')
      .select('*')
      .eq('user_id', userId);
    
    // 合并练习记录（以时间戳最新的为准）
    const allRecords = [...(localRecords || []), ...(cloudRecords || [])];
    const mergedRecords = allRecords.reduce((acc: Record<string, Record<string, unknown>>, record: Record<string, unknown>) => {
      const existing = acc[record.id as string];
      if (!existing || new Date(record.timestamp as string) > new Date(existing.timestamp as string)) {
        acc[record.id as string] = record;
      }
      return acc;
    }, {} as Record<string, Record<string, unknown>>);
    
    // 合并错题连续正确次数（取较大值）
    const allStreaks = { ...(localStreaks || {}), ...{} };
    (cloudStreaks || []).forEach((s: Record<string, unknown>) => {
      const existing = allStreaks[s.question_id as string] as number || 0;
      if ((s.streak as number) > existing) {
        allStreaks[s.question_id as string] = s.streak as number;
      }
    });
    
    // 合并最近练习记录（以最后练习时间最新的为准）
    const allRecentPractices = [...(localRecentPractices || []), ...(cloudRecentPractices || [])];
    const mergedRecentPractices = allRecentPractices.reduce((acc: Record<string, Record<string, unknown>>, practice: Record<string, unknown>) => {
      const existing = acc[practice.id as string];
      if (!existing || new Date(practice.last_practice_at as string) > new Date(existing.last_practice_at as string)) {
        acc[practice.id as string] = practice;
      }
      return acc;
    }, {} as Record<string, Record<string, unknown>>);
    
    // 上传合并后的数据到云端
    const mergedRecordsList = Object.values(mergedRecords) as Array<Record<string, unknown>>;
    if (mergedRecordsList.length > 0) {
      const recordsToUpsert = mergedRecordsList.map((record) => ({
        id: record.id,
        user_id: userId,
        question_id: record.question_id,
        is_correct: record.is_correct,
        selected_answer: record.selected_answer,
        bank_id: record.bank_id,
        bank_name: record.bank_name,
        question_type: record.question_type,
        time_spent: record.time_spent,
        timestamp: record.timestamp,
      }));
      await client.from('practice_records').upsert(recordsToUpsert, { onConflict: 'id' });
    }
    
    if (Object.keys(allStreaks).length > 0) {
      const streaksToUpsert = Object.entries(allStreaks).map(([questionId, streak]) => ({
        id: `${userId}_${questionId}`,
        user_id: userId,
        question_id: questionId,
        streak: streak as number,
        updated_at: new Date().toISOString(),
      }));
      await client.from('wrong_question_streaks').upsert(streaksToUpsert, { onConflict: 'id' });
    }
    
    if (Object.keys(mergedRecentPractices).length > 0) {
      const recentToUpsert = Object.values(mergedRecentPractices);
      await client.from('recent_practices').upsert(recentToUpsert as Array<Record<string, unknown>>, { onConflict: 'id' });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        records: mergedRecordsList,
        streaks: allStreaks,
        recentPractices: Object.values(mergedRecentPractices),
      }
    });
  } catch (error) {
    console.error('合并数据失败:', error);
    return NextResponse.json({ error: '合并失败' }, { status: 500 });
  }
}
