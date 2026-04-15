import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';

// 验证管理员 token
function verifyToken(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  try {
    const token = authHeader.substring(7);
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

// GET - 获取题库详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bank = await bankService.getBankById(id);
    
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
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyToken(request)) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, categoryId, description } = body;

    const bank = await bankService.getBankById(id);
    if (!bank) {
      return NextResponse.json({ error: '题库不存在' }, { status: 404 });
    }

    const updatedBank = await bankService.updateBank(id, {
      name,
      categoryId,
      description,
    });

    return NextResponse.json({ success: true, bank: updatedBank });
  } catch (error) {
    console.error('Failed to update bank:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

// DELETE - 删除题库
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyToken(request)) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = await params;
    const bank = await bankService.getBankById(id);
    
    if (!bank) {
      return NextResponse.json({ error: '题库不存在' }, { status: 404 });
    }

    await bankService.deleteBank(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete bank:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
