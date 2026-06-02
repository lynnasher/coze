import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireAdminAuth } from '@/lib/api-auth';

// 默认分类数据
const defaultCategories = [
  { name: '银行从业', color: 'blue', order: 0 },
  { name: '基金从业', color: 'green', order: 1 },
  { name: '证券从业', color: 'red', order: 2 },
  { name: '期货从业', color: 'yellow', order: 3 },
  { name: '保险从业', color: 'purple', order: 4 },
];

// 初始化分类（管理员接口，需要认证）
export async function POST(request: NextRequest) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const supabase = getSupabaseClient();
    
    // 检查是否已有分类
    const { data: existing } = await supabase
      .from('categories')
      .select('id');
    
    if (existing && existing.length > 0) {
      return NextResponse.json({ 
        success: true, 
        message: '分类已存在',
        count: existing.length
      });
    }
    
    // 创建默认分类
    const categoriesToInsert = defaultCategories.map((cat, index) => ({
      id: `cat_default_${index + 1}`,
      name: cat.name,
      color: cat.color,
      order_num: cat.order_num,
      parent_id: null
    }));
    
    const { error } = await supabase
      .from('categories')
      .insert(categoriesToInsert);
    
    if (error) {
      console.error('初始化分类失败:', error);
      return NextResponse.json({ success: false, error: '初始化分类失败' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `成功创建 ${categoriesToInsert.length} 个默认分类`,
      count: categoriesToInsert.length,
      categories: categoriesToInsert
    });
  } catch (error) {
    console.error('初始化分类失败:', error);
    return NextResponse.json({ success: false, error: '初始化分类失败' }, { status: 500 });
  }
}
