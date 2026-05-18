import { NextRequest, NextResponse } from 'next/server';
import { bankService, Question as BankQuestion } from '@/lib/services/bank-service';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { convertQuestionImageKeys } from '@/lib/image-utils';
import { requireAdminAuth } from '@/lib/api-auth';

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
export async function GET(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').filter(Boolean)[url.pathname.split('/').filter(Boolean).length - 2];
    const questions = await bankService.getQuestionsByBankId(id);
    
    // 将图片 key 转换为签名 URL
    const processedQuestions = await Promise.all(
      questions.map(async (q: BankQuestion) => {
        const converted = await convertQuestionImageKeys({
          content: q.content,
          options: q.options,
          explanation: q.explanation,
          caseBackground: q.caseBackground,
        });
        return { ...q, ...converted };
      })
    );
    
    return NextResponse.json({ questions: processedQuestions });
  } catch (error) {
    console.error('Failed to get questions:', error);
    return NextResponse.json({ error: '获取题目失败' }, { status: 500 });
  }
}

// POST - 添加题目到题库
export async function POST(request: NextRequest) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').filter(Boolean)[url.pathname.split('/').filter(Boolean).length - 2];
    const bankId = id;
    const body = await request.json();
    const question: Question = body.question;

    if (!question) {
      return NextResponse.json({ error: '题目数据不能为空' }, { status: 400 });
    }
    
    // 综合题的案例背景存储在 caseBackground 字段
    const hasContent = question.type === 'comprehensive' 
      ? !!question.caseBackground 
      : !!question.content;
    
    if (!hasContent) {
      return NextResponse.json({ error: '题目内容不能为空' }, { status: 400 });
    }

    // 生成题目ID
    const questionId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 准备题目数据
    // 答案处理：数组格式（多选题）需要 JSON.stringify 后存储
    const answerStr = question.answer 
      ? (typeof question.answer === 'string' 
          ? (question.answer.startsWith('[') ? question.answer : question.answer)
          : JSON.stringify(question.answer))
      : null;
    
    // 支持子题创建（综合题的子题）
    const parentId = (question as { parent_id?: string }).parent_id || (question as { parentId?: string }).parentId || null;
    
    const questionData = [{
      id: questionId,
      bank_id: bankId,
      parent_id: parentId,
      type: question.type || 'single',
      content: question.content,
      options: question.options ? JSON.stringify(question.options) : null,
      answer: answerStr,
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
