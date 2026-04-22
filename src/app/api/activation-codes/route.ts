import { NextResponse } from 'next/server';
import { activationCodeService } from '@/lib/services/activation-service';
import { requireAdminAuth } from '@/lib/api-auth';

// 获取所有激活码（需要管理员认证）
export async function GET(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const codes = await activationCodeService.getAll();
    return NextResponse.json({ success: true, codes });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// 创建激活码（需要管理员认证）
export async function POST(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { categoryId, categoryName, count, quantity, type, maxUses, expiresAt, description } = body;

    if (!categoryId || !categoryName) {
      return NextResponse.json({ success: false, error: '请提供分类ID和名称' }, { status: 400 });
    }

    // 支持 quantity 或 count 参数（quantity 优先）
    const codeCount = quantity || count || 1;
    const codes = await activationCodeService.createBatch(
      categoryId,
      categoryName,
      codeCount,
      type || 'once',
      maxUses || 1,
      expiresAt,
      description
    );

    return NextResponse.json({ success: true, codes });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// 批量删除激活码（需要管理员认证）
export async function DELETE(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    // 尝试从 JSON body 获取 IDs
    const contentType = request.headers.get('content-type');
    let ids: string[] = [];
    
    if (contentType && contentType.includes('application/json')) {
      try {
        const body = await request.json();
        ids = body.ids || [];
      } catch {
        // JSON 解析失败，忽略
      }
    }
    
    // 如果 body 中没有 IDs，尝试从 URL 查询参数获取
    if (ids.length === 0) {
      const url = new URL(request.url);
      const idsParam = url.searchParams.get('ids');
      if (idsParam) {
        try {
          ids = JSON.parse(idsParam);
        } catch {
          ids = [idsParam];
        }
      }
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: '请提供要删除的ID列表' }, { status: 400 });
    }

    for (const id of ids) {
      await activationCodeService.delete(id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除激活码失败:', error);
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
