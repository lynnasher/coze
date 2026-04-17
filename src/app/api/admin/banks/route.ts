import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';
import { requireAdminAuth } from '@/lib/api-auth';

// GET - 获取所有题库（需要认证）
export async function GET(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const banks = await bankService.getAllBanks();
    return NextResponse.json({ banks });
  } catch (error) {
    console.error('Failed to get banks:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// POST - 获取题库统计
export async function POST(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const stats = await bankService.getStats();
    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Failed to get stats:', error);
    return NextResponse.json({ error: '获取统计失败' }, { status: 500 });
  }
}
