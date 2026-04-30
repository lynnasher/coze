import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';
import { verifyApiToken } from '@/lib/api-auth';

// 获取题库列表（公开接口，只返回可见题库）
export async function GET(request: Request) {
  try {
    // 获取用户 token（可选，用于标注已激活的分类）
    const { userId } = verifyApiToken(request);

    // 只获取可见题库（排除隐藏的）
    const banks = await bankService.getVisibleBanks();

    return NextResponse.json({ 
      banks,
      total: banks.length,
      userId,
    });
  } catch (error) {
    console.error('Failed to get banks:', error);
    return NextResponse.json({ 
      error: '获取失败',
      banks: [],
      total: 0 
    }, { status: 500 });
  }
}
