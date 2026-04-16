import { NextRequest, NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';
import { getSupabaseClient } from '@/storage/database/supabase-client';

type QuestionType = 'single' | 'multiple' | 'true-false' | 'fill-blank' | 'comprehensive';

interface Question {
  id?: string;
  type: QuestionType;
  content: string;
  options?: { id: string; text: string }[];
  answer: string | string[];
  explanation?: string;
  difficulty?: string;
  tags?: string[];
  caseBackground?: string;
  caseContext?: string;
}

// GET - 获取题库的所有题目
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const questions = await bankService.getQuestionsByBankId(id);
    
    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Failed to get questions:', error);
    return NextResponse.json({ error: '获取题目失败' }, { status: 500 });
  }
}

// POST - 添加题目到题库
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bankId } = await params;
    const body = await request.json();
    const question: Question = body.question;

    if (!question || !question.content) {
      return NextResponse.json({ error: '题目内容不能为空' }, { status: 400 });
    }

    // 生成题目ID
    const questionId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 准备题目数据
    const questionData = [{
      id: questionId,
      bank_id: bankId,
      parent_id: null,
      type: question.type || 'single',
      content: question.content,
      options: question.options ? JSON.stringify(question.options) : null,
      answer: question.answer ? (Array.isArray(question.answer) ? JSON.stringify(question.answer) : question.answer) : null,
      explanation: question.explanation || null,
      difficulty: question.difficulty || 'medium',
      tags: question.tags ? JSON.stringify(question.tags) : '[]',
      case_background: question.caseBackground || null,
      case_context: question.caseContext || null,
    }];

    let supabase;
    try {
      supabase = await getSupabaseClient();
    } catch (e) {
      supabase = null;
    }
    
    if (!supabase) {
      return NextResponse.json({ error: '数据库连接失败' }, { status: 500 });
    }

    const { error } = await supabase.from('questions').insert(questionData);

    if (error) {
      console.error('创建题目失败:', error);
      return NextResponse.json({ error: '创建题目失败' }, { status: 500 });
    }

    // 更新题库的题目数量
    const questions = await bankService.getQuestionsByBankId(bankId);
    await bankService.updateQuestionCount(bankId, questions.length + 1);

    return NextResponse.json({ 
      success: true, 
      questionId,
      message: '题目添加成功'
    });
  } catch (error) {
    console.error('创建题目失败:', error);
    return NextResponse.json({ error: '创建题目失败' }, { status: 500 });
  }
}
