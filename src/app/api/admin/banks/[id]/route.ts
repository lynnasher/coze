import { NextResponse } from 'next/server';

// DELETE - 删除题库
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 获取现有数据
    const questions = JSON.parse(localStorage.getItem('questions') || '[]');
    const banks = JSON.parse(localStorage.getItem('questionBanks') || '[]');
    
    // 找到要删除的题库
    const bankToDelete = banks.find((b: { id: string }) => b.id === id);
    if (!bankToDelete) {
      return NextResponse.json({ error: '题库不存在' }, { status: 404 });
    }

    // 从题库列表中移除
    const updatedBanks = banks.filter((b: { id: string }) => b.id !== id);
    
    // 从题目列表中移除该题库的所有题目
    const updatedQuestions = questions.filter(
      (q: { bankId?: string }) => q.bankId !== id
    );

    // 保存更新后的数据
    localStorage.setItem('questions', JSON.stringify(updatedQuestions));
    localStorage.setItem('questionBanks', JSON.stringify(updatedBanks));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
