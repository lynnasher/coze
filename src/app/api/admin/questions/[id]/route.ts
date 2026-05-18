import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireAdminAuth } from '@/lib/api-auth';

interface QuestionUpdate {
  type?: string;
  content?: string;
  options?: { id: string; text: string }[];
  answer?: string | string[];
  explanation?: string;
  difficulty?: string;
  tags?: string[];
  case_background?: string;
  case_context?: string;
  parent_id?: string;
  bank_id?: string;
}

// 更新题目（需要管理员认证）
export async function PUT(request: NextRequest) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').filter(Boolean).pop()!;
    const body: QuestionUpdate = await request.json();
    
    const supabase = getSupabaseClient();
    
    // 构建更新数据
    const updateData: Record<string, unknown> = {};
    if (body.type !== undefined) updateData.type = body.type;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.options !== undefined) updateData.options = JSON.stringify(body.options);
    if (body.answer !== undefined) updateData.answer = Array.isArray(body.answer) ? JSON.stringify(body.answer) : body.answer;
    if (body.explanation !== undefined) updateData.explanation = body.explanation;
    if (body.difficulty !== undefined) updateData.difficulty = body.difficulty;
    if (body.tags !== undefined) updateData.tags = JSON.stringify(body.tags);
    if (body.case_background !== undefined) updateData.case_background = body.case_background;
    if (body.case_context !== undefined) updateData.case_context = body.case_context;
    if (body.parent_id !== undefined) updateData.parent_id = body.parent_id;
    if (body.bank_id !== undefined) updateData.bank_id = body.bank_id;
    
    const { error } = await supabase
      .from('questions')
      .update(updateData)
      .eq('id', id);
    
    if (error) {
      console.error('更新题目失败:', error);
      return NextResponse.json({ success: false, error: '更新题目失败' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新题目失败:', error);
    return NextResponse.json({ success: false, error: '更新题目失败' }, { status: 500 });
  }
}

// 删除题目（软删除，需要管理员认证）
export async function DELETE(request: NextRequest) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').filter(Boolean).pop()!;
    
    const supabase = getSupabaseClient();
    
    // 软删除题目
    const { error } = await supabase
      .from('questions')
      .update({ status: 'disabled' })
      .eq('id', id);
    
    if (error) {
      console.error('删除题目失败:', error);
      return NextResponse.json({ success: false, error: '删除题目失败' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除题目失败:', error);
    return NextResponse.json({ success: false, error: '删除题目失败' }, { status: 500 });
  }
}
