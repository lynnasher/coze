import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';

// 公开 API - 获取单个题库信息（不需要认证）
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
