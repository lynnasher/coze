import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/storage/database/supabase-client';
import { verifyApiToken } from '@/lib/api-auth';

// 练习记录类型
interface PracticeRecord {
  id?: string;
  questionId: string;
  isCorrect: boolean;
  selectedAnswer: string | string[];
  timestamp: number;
}

// 错题信息类型
interface WrongQuestion {
  questionId: string;
  wrongCount: number;
  correctCount: number;
  streak: number;
  lastWrongAt: number | null;
}

// 获取用户的错题记录
export async function GET(request: Request) {
  try {
    const { userId } = verifyApiToken(request);
    
    if (!userId) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const client = getSupabaseAdminClient();

    // 从 user_data 表获取用户的练习历史
    const { data: userData, error: dataError } = await client
      .from('user_data')
      .select('practice_history, streak_data')
      .eq('user_id', userId)
      .single();

    if (dataError && dataError.code !== 'PGRST116') {
      // PGRST116 是 "not found" 错误，这是正常的
      return NextResponse.json({ success: false, error: dataError.message }, { status: 500 });
    }

    // 获取练习历史
    const practiceHistory: PracticeRecord[] = userData?.practice_history || [];
    const streakData: Record<string, number> = userData?.streak_data || {};

    // 从练习历史中提取错题记录
    const wrongRecords = practiceHistory.filter((r) => !r.isCorrect);
    
    // 获取所有答过且答错的题目ID
    const wrongQuestionIds = [...new Set(
      wrongRecords
        .filter((r) => {
          const answer = Array.isArray(r.selectedAnswer) ? r.selectedAnswer : String(r.selectedAnswer || '');
          return answer.length > 0;
        })
        .map((r) => r.questionId)
    )];

    // 构建错题信息
    const wrongQuestions: WrongQuestion[] = wrongQuestionIds.map((questionId) => {
      const questionRecords = practiceHistory.filter((r) => r.questionId === questionId);
      const correctRecords = questionRecords.filter((r) => r.isCorrect);
      const wrongRecordsForQuestion = questionRecords.filter((r) => !r.isCorrect);
      
      const streak = streakData[questionId] || 0;
      
      // 如果连续正确3次或以上，则认为已掌握，不显示在错题本中
      if (streak >= 3) {
        return null;
      }
      
      // 获取最后错误时间
      const lastWrongRecord = wrongRecordsForQuestion.length > 0 
        ? wrongRecordsForQuestion[wrongRecordsForQuestion.length - 1] 
        : null;
      
      return {
        questionId,
        wrongCount: wrongRecordsForQuestion.length,
        correctCount: correctRecords.length,
        streak,
        lastWrongAt: lastWrongRecord?.timestamp || null,
      };
    }).filter((q): q is WrongQuestion => q !== null);

    // 按错题次数和最近错误时间排序
    wrongQuestions.sort((a, b) => {
      if (Math.abs(a.wrongCount - b.wrongCount) > 1) {
        return b.wrongCount - a.wrongCount;
      }
      return (b.lastWrongAt || 0) - (a.lastWrongAt || 0);
    });

    return NextResponse.json({ 
      success: true, 
      wrongQuestions,
      total: wrongQuestions.length 
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
