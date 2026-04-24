import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';

/**
 * 批量获取题库详情
 * POST /api/banks/details
 * Body: { ids: string[] }
 */
export async function POST(request: Request) {
  try {
    const { ids } = await request.json();
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ 
        error: '请提供题库ID列表',
        banks: [] 
      }, { status: 400 });
    }

    console.log(`[BanksDetails] 批量查询题库: ids=${ids.join(', ')}`);

    // 批量查询题库
    const banks = await bankService.getBanksByIds(ids);

    // 简化返回数据
    const formattedBanks = banks.map(bank => ({
      id: bank.id,
      name: bank.name,
    }));

    console.log(`[BanksDetails] 查询结果: 找到 ${formattedBanks.length}/${ids.length} 个题库`);

    return NextResponse.json({ 
      banks: formattedBanks,
      total: formattedBanks.length,
    });
  } catch (error) {
    console.error('[BanksDetails] 查询失败:', error);
    return NextResponse.json({ 
      error: '查询失败',
      banks: [] 
    }, { status: 500 });
  }
}
