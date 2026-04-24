import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取题库的题目列表
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();

    // 获取题库下的所有题目（不包括子题目，子题目会在前端通过 parent_id 关联）
    const { data: questions, error } = await client
      .from('questions')
      .select('*')
      .eq('bank_id', id)
      .eq('status', 'active')
      .is('parent_id', null) // 只获取主题目，子题目通过 parent_id 关联
      .order('created_at', { ascending: true });

    if (error) {
      console.error('获取题目失败:', error);
      return NextResponse.json(
        { error: '获取题目失败', questions: [] },
        { status: 500 }
      );
    }

    // 获取子题目（综合题的子题）
    const { data: childQuestions, error: childError } = await client
      .from('questions')
      .select('*')
      .eq('bank_id', id)
      .eq('status', 'active')
      .not('parent_id', 'is', null)
      .order('created_at', { ascending: true });

    if (childError) {
      console.error('获取子题目失败:', childError);
    }

    // 将子题目关联到父题目
    const childQuestionsMap = new Map();
    (childQuestions || []).forEach((child: any) => {
      if (!childQuestionsMap.has(child.parent_id)) {
        childQuestionsMap.set(child.parent_id, []);
      }
      childQuestionsMap.get(child.parent_id).push(child);
    });

    // 转换数据格式（snake_case 到 camelCase）
    const formattedQuestions = (questions || []).map((q: any) => ({
      id: q.id,
      bankId: q.bank_id,
      parentId: q.parent_id,
      type: q.type,
      content: q.content,
      options: q.options ? JSON.parse(q.options) : undefined,
      answer: q.answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      tags: q.tags ? JSON.parse(q.tags) : [],
      caseBackground: q.case_background,
      caseContext: q.case_context,
      status: q.status,
      createdAt: new Date(q.created_at).getTime(),
      // 添加子题目
      children: childQuestionsMap.has(q.id) 
        ? childQuestionsMap.get(q.id).map((child: any) => ({
            id: child.id,
            bankId: child.bank_id,
            parentId: child.parent_id,
            type: child.type,
            content: child.content,
            options: child.options ? JSON.parse(child.options) : undefined,
            answer: child.answer,
            explanation: child.explanation,
            difficulty: child.difficulty,
            tags: child.tags ? JSON.parse(child.tags) : [],
            status: child.status,
            createdAt: new Date(child.created_at).getTime(),
          }))
        : undefined,
    }));

    return NextResponse.json({ questions: formattedQuestions });
  } catch (error) {
    console.error('获取题目失败:', error);
    return NextResponse.json(
      { error: '获取题目失败', questions: [] },
      { status: 500 }
    );
  }
}
