import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireAdminAuth } from '@/lib/api-auth';

interface CategoryUpdate {
  name?: string;
  color?: string;
  order?: number;
  parentId?: string | null;
}

// 更新分类（需要管理员认证）
export async function PUT(request: NextRequest) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').filter(Boolean).pop()!;
    const body: CategoryUpdate = await request.json();
    
    const supabase = getSupabaseClient();
    
    // 构建更新数据
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.color !== undefined) updateData.color = body.color;
    if (body.order_num !== undefined) updateData.order_num = body.order_num;
    // parentId 为 null 表示设为顶级分类，string 表示设为某分类的子分类，undefined 表示不更新
    if (body.parentId !== undefined) {
      updateData.parent_id = body.parentId;
    }
    
    // 如果没有要更新的字段
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true, message: '没有需要更新的字段' });
    }
    
    const { error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', id);
    
    if (error) {
      console.error('更新分类失败:', error);
      return NextResponse.json({ success: false, error: '更新分类失败' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新分类失败:', error);
    return NextResponse.json({ success: false, error: '更新分类失败' }, { status: 500 });
  }
}

// 删除分类（需要管理员认证）
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
    
    // 检查是否有子分类
    const { data: children } = await supabase
      .from('categories')
      .select('id')
      .eq('parent_id', id);
    
    if (children && children.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: '该分类下有子分类，请先删除子分类' 
      }, { status: 400 });
    }
    
    // 检查是否有题库关联
    const { data: banks } = await supabase
      .from('question_banks')
      .select('id')
      .eq('category_id', id);
    
    if (banks && banks.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: '该分类下有题库，请先移除题库' 
      }, { status: 400 });
    }
    
    // 删除分类
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('删除分类失败:', error);
      return NextResponse.json({ success: false, error: '删除分类失败' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除分类失败:', error);
    return NextResponse.json({ success: false, error: '删除分类失败' }, { status: 500 });
  }
}
