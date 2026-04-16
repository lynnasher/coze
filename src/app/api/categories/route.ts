import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/storage/database/supabase-client';
import { categories } from '@/storage/database/shared/schema';
import { eq, asc } from 'drizzle-orm';

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    
    // 获取所有分类，按 order 排序
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('order', { ascending: true });
    
    if (error) {
      console.error('获取分类失败:', error);
      return NextResponse.json({ success: false, error: '获取分类失败' }, { status: 500 });
    }
    
    // 转换数据格式
    const formattedCategories = (data || []).map((cat: {
      id: string;
      name: string;
      color: string | null;
      order: number | null;
      parent_id: string | null;
      created_at: string;
    }) => ({
      id: cat.id,
      name: cat.name,
      color: cat.color || 'blue',
      order: cat.order || 0,
      parentId: cat.parent_id || undefined,
      createdAt: new Date(cat.created_at).getTime()
    }));
    
    return NextResponse.json({ 
      success: true, 
      categories: formattedCategories 
    });
  } catch (error) {
    console.error('获取分类失败:', error);
    return NextResponse.json({ success: false, error: '获取分类失败' }, { status: 500 });
  }
}
