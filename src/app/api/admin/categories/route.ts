import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/server-supabase-client';

interface CategoryRequest {
  id?: string;
  name: string;
  color?: string;
  order?: number;
  parentId?: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    
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

// 创建分类
export async function POST(request: NextRequest) {
  try {
    const body: CategoryRequest = await request.json();
    const { name, color = 'blue', order = 0, parentId } = body;
    
    if (!name || name.trim() === '') {
      return NextResponse.json({ success: false, error: '分类名称不能为空' }, { status: 400 });
    }
    
    const supabase = getSupabaseClient();
    
    // 生成 ID
    const id = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 插入数据库
    const { error } = await supabase
      .from('categories')
      .insert({
        id,
        name: name.trim(),
        color,
        order,
        parent_id: parentId || null
      });
    
    if (error) {
      console.error('创建分类失败:', error);
      return NextResponse.json({ success: false, error: '创建分类失败' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      category: {
        id,
        name: name.trim(),
        color,
        order,
        parentId
      }
    });
  } catch (error) {
    console.error('创建分类失败:', error);
    return NextResponse.json({ success: false, error: '创建分类失败' }, { status: 500 });
  }
}

// 批量创建分类（用于初始化）
export async function PUT(request: NextRequest) {
  try {
    const body: { categories: CategoryRequest[] } = await request.json();
    const { categories: newCategories } = body;
    
    if (!Array.isArray(newCategories) || newCategories.length === 0) {
      return NextResponse.json({ success: false, error: '分类数据无效' }, { status: 400 });
    }
    
    const supabase = getSupabaseClient();
    
    // 准备插入数据
    const insertData = newCategories.map((cat, index) => ({
      id: cat.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: cat.name.trim(),
      color: cat.color || 'blue',
      order: cat.order ?? index,
      parent_id: cat.parentId || null
    }));
    
    // 先检查是否已有分类
    const { data: existing } = await supabase
      .from('categories')
      .select('id');
    
    if (existing && existing.length > 0) {
      // 已有分类，不重复插入
      return NextResponse.json({ 
        success: true, 
        message: '分类已存在，跳过初始化',
        categories: []
      });
    }
    
    // 批量插入
    const { error } = await supabase
      .from('categories')
      .insert(insertData);
    
    if (error) {
      console.error('批量创建分类失败:', error);
      return NextResponse.json({ success: false, error: '批量创建分类失败' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `成功创建 ${insertData.length} 个分类`,
      categories: insertData
    });
  } catch (error) {
    console.error('批量创建分类失败:', error);
    return NextResponse.json({ success: false, error: '批量创建分类失败' }, { status: 500 });
  }
}
