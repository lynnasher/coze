import { NextRequest, NextResponse } from 'next/server';
import { questionStore } from '@/lib/quiz-store';
import { Question } from '@/lib/types';

export async function GET() {
  try {
    console.log('Getting questions...');
    const questions = questionStore.getAll();
    console.log('Questions count:', questions.length);
    return NextResponse.json({ questions, total: questions.length });
  } catch (error) {
    console.error('GET questions error:', error);
    return NextResponse.json({ error: '获取失败', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questions } = body;
    
    if (Array.isArray(questions)) {
      questionStore.addMultiple(questions);
      return NextResponse.json({ success: true, count: questions.length });
    }
    
    return NextResponse.json({ error: '无效的数据格式' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (id) {
      questionStore.remove(id);
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: '缺少题目ID' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
