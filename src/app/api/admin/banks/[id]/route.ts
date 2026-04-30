import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';
import { requireAdminAuth } from '@/lib/api-auth';

// GET - 获取题库详情（需要认证）
export async function GET(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    const bank = await bankService.getBankById(id!);
    
    if (!bank) {
      return NextResponse.json({ error: '题库不存在' }, { status: 404 });
    }

    return NextResponse.json({ bank });
  } catch (error) {
    console.error('Failed to get bank:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// PUT - 更新题库
export async function PUT(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    const body = await request.json();
    const { name, categoryId, description, status } = body;

    const bank = await bankService.getBankById(id!);
    if (!bank) {
      return NextResponse.json({ error: '题库不存在' }, { status: 404 });
    }

    const updatedBank = await bankService.updateBank(id!, {
      name,
      categoryId,
      description,
      status,
    });

    return NextResponse.json({ success: true, bank: updatedBank });
  } catch (error) {
    console.error('Failed to update bank:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

// DELETE - 删除题库
export async function DELETE(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    const bank = await bankService.getBankById(id!);
    
    if (!bank) {
      return NextResponse.json({ error: '题库不存在' }, { status: 404 });
    }

    await bankService.deleteBank(id!);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete bank:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
