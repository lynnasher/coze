import { NextResponse } from 'next/server';

// 生成 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// POST - 导入 JSON 题目
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { questions, bankName } = body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: '请提供有效的题目数据' },
        { status: 400 }
      );
    }

    // 验证并规范化题目数据
    const validQuestions = questions.map(q => {
      // 确保必要字段存在
      if (!q.content) {
        throw new Error('题目内容不能为空');
      }

      return {
        id: q.id || generateId(),
        type: q.type || 'single',
        content: q.content,
        options: q.options || [],
        answer: q.answer || '',
        explanation: q.explanation || '',
        tags: Array.isArray(q.tags) ? q.tags : [],
        difficulty: q.difficulty || 'medium',
        createdAt: q.createdAt || Date.now(),
        // 综合题字段
        caseBackground: q.caseBackground,
        caseContext: q.caseContext,
        parentId: q.parentId,
        // 题库关联（稍后添加）
        bankId: ''
      };
    });

    // 获取现有数据
    const existingQuestions = JSON.parse(localStorage.getItem('questions') || '[]');
    const existingBanks = JSON.parse(localStorage.getItem('questionBanks') || '[]');

    // 创建新题库
    const newBank = {
      id: generateId(),
      name: bankName || `题库_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}`,
      description: '从 JSON 文件导入',
      questionIds: validQuestions.map(q => q.id),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // 为题目关联题库 ID
    validQuestions.forEach(q => {
      q.bankId = newBank.id;
    });

    // 合并数据
    const updatedQuestions = [...existingQuestions, ...validQuestions];
    const updatedBanks = [...existingBanks, newBank];

    // 保存
    localStorage.setItem('questions', JSON.stringify(updatedQuestions));
    localStorage.setItem('questionBanks', JSON.stringify(updatedBanks));

    return NextResponse.json({
      success: true,
      count: validQuestions.length,
      bankId: newBank.id,
      bankName: newBank.name
    });
  } catch (error) {
    console.error('JSON import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '导入失败' },
      { status: 500 }
    );
  }
}
