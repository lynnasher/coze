import { NextResponse } from 'next/server';
import { bankService, DbQuestionBank } from '@/lib/services/bank-service';
import { verifyApiToken } from '@/lib/api-auth';

// 转换题库数据格式（从数据库格式转为前端格式）
function formatBank(bank: DbQuestionBank) {
  return {
    id: bank.id,
    name: bank.name,
    description: bank.description,
    questionCount: bank.question_count,
    categoryId: bank.category_id,
    createdAt: new Date(bank.created_at).getTime()
  };
}

// 获取题库列表（公开接口，返回所有题库）
export async function GET(request: Request) {
  try {
    // 获取用户 token（可选，用于标注已激活的分类）
    const { userId } = verifyApiToken(request);

    // 获取所有题库
    const banks = await bankService.getAllBanks();

    // 转换数据格式
    const formattedBanks = banks.map(formatBank);

    return NextResponse.json({ 
      banks: formattedBanks,
      total: formattedBanks.length,
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
