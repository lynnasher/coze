import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';
import { requireAdminAuth } from '@/lib/api-auth';

// 迁移已有的题库数据到数据库（需要管理员认证）
export async function POST(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { banks, questions } = body;

    if (!Array.isArray(banks) || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: '请提供有效的题库和题目数据' },
        { status: 400 }
      );
    }

    let totalQuestions = 0;
    const results: Array<{ bankId: string; bankName: string; questionCount: number }> = [];

    // 逐个题库导入
    for (const bank of banks) {
      // 筛选属于该题库的题目
      const bankQuestions = questions.filter(q => q.bankId === bank.id || bank.questionIds?.includes(q.id));

      if (bankQuestions.length === 0) continue;

      // 创建题库
      const newBank = await bankService.createBank(
        bank.name,
        bank.description,
        bank.sourceFile
      );

      // 导入题目
      const count = await bankService.createQuestions(bankQuestions, newBank.id);
      totalQuestions += count;

      results.push({
        bankId: newBank.id,
        bankName: newBank.name,
        questionCount: count
      });
    }

    return NextResponse.json({
      success: true,
      message: `成功迁移 ${results.length} 个题库，共 ${totalQuestions} 道题目`,
      results
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '迁移失败' },
      { status: 500 }
    );
  }
}
