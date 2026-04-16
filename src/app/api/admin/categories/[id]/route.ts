import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/server-supabase-client';

interface CategoryUpdate {
  name?: string;
  color?: string;
  order?: number;
  parentId?: string | null;
}

// 更新分类
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: CategoryUpdate = await request.json();
    
    const supabase = getSupabaseClient();
    
    // 构建更新数据
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.color !== undefined) updateData.color = body.color;
    if (body.order !== undefined) updateData.order = body.order;
    if (body.parentId !== undefined) updateData.parent_id = body.parentId;
    
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

// 删除分类
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
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
