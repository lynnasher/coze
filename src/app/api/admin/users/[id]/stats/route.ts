import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/api-auth';
import { getSupabaseAdminClient } from '@/storage/database/supabase-client';

interface PracticeRecord {
  id: string;
  questionId: string;
  isCorrect: boolean;
  selectedAnswer?: string | string[];
  [key: string]: unknown;
}

interface RecentSession {
  id?: string;
  bankId?: string;
  bankName?: string;
  mode?: string;
  currentIndex?: number;
  totalCount?: number;
  answeredCount?: number;
  correctCount?: number;
  wrongCount?: number;
  isCompleted?: boolean;
  lastPracticeAt?: number;
  [key: string]: unknown;
}

// 解析 jsonb 字段（数组 / 对象 / 空）
function parseArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseRecord(raw: unknown): Record<string, number> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, number>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

// 将 13 位毫秒时间戳转成 YYYY-MM-DD
function toDateStr(ts: number): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 获取单用户做题统计数据 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth(request);
  if (!auth.success) return auth.response;

  const { id: userId } = await context.params;
  if (!userId) {
    return NextResponse.json({ success: false, error: '缺少用户ID' }, { status: 400 });
  }

  try {
    const client = getSupabaseAdminClient();

    // 1. 用户基础信息
    const { data: user } = await client
      .from('users')
      .select('id,phone,nickname,role,status,created_at,last_login_at,activated_categories')
      .eq('id', userId)
      .single();

    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    // 2. 用户做题数据
    const { data: userData } = await client
      .from('user_data')
      .select('practice_history,wrong_questions,recently_practiced,streak_data,quiz_progress')
      .eq('user_id', userId)
      .maybeSingle();

    const practiceHistory = parseArray<PracticeRecord>(userData?.practice_history);
    const wrongQuestions = parseRecord(userData?.wrong_questions);
    const streakData = parseRecord(userData?.streak_data);
    const recentSessions = parseArray<RecentSession>(userData?.recently_practiced);
    const quizProgress = parseRecord(userData?.quiz_progress as Record<string, unknown> | undefined);

    // 3. 汇总指标
    const total = practiceHistory.length;
    const correctCount = practiceHistory.filter((r) => r.isCorrect === true).length;
    const wrongCount = total - correctCount;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    // 参与天数（按做题时间戳去重）
    const daySet = new Set<string>();
    for (const r of practiceHistory) {
      if (typeof r.timestamp === 'number') {
        const ds = toDateStr(r.timestamp);
        if (ds) daySet.add(ds);
      }
    }

    // 最近活跃时间
    let lastActiveTs = 0;
    for (const r of practiceHistory) {
      if (typeof r.timestamp === 'number' && r.timestamp > lastActiveTs) lastActiveTs = r.timestamp;
    }
    const lastActive = lastActiveTs
      ? new Date(lastActiveTs).toLocaleString('zh-CN', { hour12: false })
      : null;

    // 错题总数（累加 wrong_questions 值；仅统计 count>=1）
    const wrongBookTotal = Object.values(wrongQuestions).reduce(
      (sum, v) => sum + (typeof v === 'number' ? v : 0),
      0,
    );

    // 连续正确（streak_data 最大累计值，作为掌握度参考）
    const maxStreak = Object.values(streakData).reduce(
      (max, v) => Math.max(max, typeof v === 'number' ? v : 0),
      0,
    );

    // 4. 近30天做题趋势
    const days: string[] = [];
    const now = Date.now();
    for (let i = 29; i >= 0; i--) days.push(toDateStr(now - i * 86400000));
    const dayMap: Record<string, number> = {};
    for (const r of practiceHistory) {
      if (typeof r.timestamp !== 'number') continue;
      const ds = toDateStr(r.timestamp);
      if (ds) dayMap[ds] = (dayMap[ds] || 0) + 1;
    }
    const trend30 = days.map((date) => ({ date, count: dayMap[date] || 0 }));

    // 5. 学习进度：仅保留最新一条已交卷(isCompleted)的练习会话
    const sessions = [...recentSessions]
      .filter((s) => s.isCompleted === true)
      .sort((a, b) => (Number(b.lastPracticeAt) || 0) - (Number(a.lastPracticeAt) || 0))
      .slice(0, 1)
      .map((s) => ({
        id: s.id,
        bankId: s.bankId,
        bankName: s.bankName || '未命名题库',
        mode: s.mode || 'sequential',
        currentIndex: s.currentIndex ?? 0,
        totalCount: s.totalCount ?? 0,
        correctCount: s.correctCount ?? 0,
        wrongCount: s.wrongCount ?? 0,
        isCompleted: s.isCompleted === true,
        lastPracticeAt: s.lastPracticeAt ?? null,
      }));

    // 7. 薄弱点分析：取错题频次最高的 20 题，关联题目内容
    const wrongEntries = Object.entries(wrongQuestions)
      .filter(([, count]) => count >= 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    let topWrongQuestions: { id: string; count: number; content: string; type: string }[] = [];
    if (wrongEntries.length > 0) {
      const ids = wrongEntries.map(([qid]) => qid);
      const { data: questionRows } = await client
        .from('questions')
        .select('id,content,type')
        .in('id', ids);
      const questionMap = new Map(
        (questionRows || []).map((q) => [q.id, { content: q.content, type: q.type }]),
      );
      topWrongQuestions = wrongEntries.map(([qid, count]) => {
        const meta = questionMap.get(qid);
        return {
          id: qid,
          count,
          content: meta?.content ? String(meta.content).slice(0, 120) : '题目已删除',
          type: meta?.type || 'unknown',
        };
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        role: user.role,
        status: user.status,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
        activatedCategories: Array.isArray(user.activated_categories) ? user.activated_categories : [],
      },
      stats: {
        total,
        correctCount,
        wrongCount,
        accuracy,
        practiceDays: daySet.size,
        wrongBookTotal,
        maxStreak,
        lastActive,
      },
      trend30,
      sessions,
      topWrongQuestions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}