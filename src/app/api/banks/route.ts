import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';

// 公开 API - 获取所有题库（不需要认证）
export async function GET() {
  try {
    const banks = await bankService.getAllBanks();
    return NextResponse.json({ 
      banks,
      total: banks.length 
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
