import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';
import { verifyApiToken } from '@/lib/api-auth';

// 获取题库列表（公开接口，返回所有题库）
export async function GET(request: Request) {
  try {
    // 获取用户 token（可选，用于标注已激活的分类）
    const { userId } = verifyApiToken(request);

    // 获取所有题库
    const banks = await bankService.getAllBanks();

    // 转换字段名（snake_case 到 camelCase）
    const formattedBanks = banks.map(bank => ({
      id: bank.id,
      name: bank.name,
      description: bank.description,
      sourceFile: bank.source_file,
      questionCount: bank.question_count,
      categoryId: bank.category_id,
      status: bank.status,
      createdAt: bank.created_at,
      updatedAt: bank.updated_at,
    }));

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
