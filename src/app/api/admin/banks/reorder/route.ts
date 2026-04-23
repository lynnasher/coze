import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/api-auth';
import { getSupabaseAdminClient } from '@/storage/database/supabase-client';

interface ReorderItem {
  id: string;
  sortOrder: number;
}

/**
 * 批量更新题库排序
 * PUT /api/admin/banks/reorder
 */
export async function PUT(request: Request) {
  try {
    // 验证管理员权限
    const authResult = await requireAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { orders } = body as { orders: ReorderItem[] };

    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json(
        { success: false, error: '无效的请求数据' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();

    // 批量更新排序
    const updates = orders.map(({ id, sortOrder }: ReorderItem) =>
      supabase
        .from('banks')
        .update({ sort_order: sortOrder })
        .eq('id', id)
    );

    const results = await Promise.all(updates);
    const hasError = results.some((result: { error: unknown }) => result.error);

    if (hasError) {
      console.error('更新排序失败:', results);
      return NextResponse.json(
        { success: false, error: '部分更新失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新排序出错:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
