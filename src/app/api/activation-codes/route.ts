import { NextResponse } from 'next/server';
import { activationCodeService } from '@/lib/services/activation-service';

// 获取所有激活码
export async function GET() {
  try {
    const codes = await activationCodeService.getAll();
    return NextResponse.json({ success: true, codes });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// 创建激活码
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { categoryId, categoryName, count, type, maxUses, expiresAt, description } = body;

    if (!categoryId || !categoryName) {
      return NextResponse.json({ success: false, error: '请提供分类ID和名称' }, { status: 400 });
    }

    const codeCount = count || 1;
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

// 批量删除激活码
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json({ success: false, error: '请提供要删除的ID列表' }, { status: 400 });
    }

    for (const id of ids) {
      await activationCodeService.delete(id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
