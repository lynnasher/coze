import { NextRequest, NextResponse } from 'next/server';
import { parseWorkBank } from '@/lib/work-parser';
import { questionStore } from '@/lib/quiz-store';

interface WorkQuestionItem {
  id?: string | number;
  question?: string;
  content?: string;
  title?: string;
  options?: Record<string, string>;
  choice?: Record<string, string>;
  answer?: string | string[] | number;
  correct?: string | string[] | number;
  answers?: string | string[] | number;
  type?: string;
  typeName?: string;
  explain?: string;
  explanation?: string;
  tags?: string[];
  difficulty?: string;
}

interface ParsedWorkQuestion {
  id: string;
  type: string;
  content: string;
  options?: Array<{ id: string; text: string }>;
  answer: string | string[];
  explanation?: string;
  tags: string[];
  difficulty: string;
  createdAt: number;
}

export async function POST(request: NextRequest) {
  try {
    let questions: ParsedWorkQuestion[] = [];
    let isJson = false;
    let textContent = '';
    
    // 检查 Content-Type
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      // JSON 格式
      const body = await request.json();
      
      // 处理多种格式
      if (typeof body === 'string') {
        // 直接发送的是字符串
        textContent = body;
        isJson = true;
      } else if (Array.isArray(body)) {
        // 直接发送的是数组
        questions = body.map((item: WorkQuestionItem): ParsedWorkQuestion => {
          const q: ParsedWorkQuestion = {
            id: item.id ? String(item.id) : `q-${Date.now()}-${Math.random()}`,
            type: item.type || 'single',
            content: item.content || item.question || item.title || '',
            options: item.options ? Object.entries(item.options).map(([key, value]: [string, string]) => ({
              id: key.toLowerCase(),
              text: String(value)
            })) : undefined,
            answer: item.answer || item.correct || item.answers || 'a',
            explanation: item.explain || item.explanation,
            tags: item.tags || [],
            difficulty: item.difficulty || 'medium',
            createdAt: Date.now(),
          };
          return q;
        }).filter((q: ParsedWorkQuestion) => q.content) as ParsedWorkQuestion[];
      } else if (body.text) {
        // body 包含 text 字段
        textContent = typeof body.text === 'string' ? body.text : JSON.stringify(body.text);
        isJson = true;
      } else {
        // 尝试将整个 body 转为字符串
        textContent = JSON.stringify(body);
        isJson = true;
      }
    } else {
      // FormData 格式
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      textContent = (formData.get('text') as string) || '';
      
      if (file) {
        const fileContent = await file.text();
        const fileName = file.name.toLowerCase();
        
        // 判断文件类型
        isJson = fileName.endsWith('.json') || fileName.endsWith('.work');
        
        if (isJson || fileName.endsWith('.txt')) {
          questions = parseWorkBank(fileContent, isJson);
        } else {
          return NextResponse.json(
            { error: '仅支持 JSON、TXT 或 WORK 格式文件' },
            { status: 400 }
          );
        }
      }
    }
    
    // 如果没有从文件解析，从文本解析
    if (questions.length === 0 && textContent) {
      const trimmed = textContent.trim();
      isJson = (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
               (trimmed.startsWith('[') && trimmed.endsWith(']'));
      
      questions = parseWorkBank(textContent, isJson);
    }
    
    if (questions.length === 0) {
      return NextResponse.json(
        { error: '未能解析出题目，请检查格式是否正确' },
        { status: 400 }
      );
    }
    
    // 保存到数据库
    questionStore.addMultiple(questions);
    
    // 统计各类型题目数量
    const typeStats = {
      single: questions.filter((q: { type: string }) => q.type === 'single').length,
      multiple: questions.filter((q: { type: string }) => q.type === 'multiple').length,
      'true-false': questions.filter((q: { type: string }) => q.type === 'true-false').length,
      'fill-blank': questions.filter((q: { type: string }) => q.type === 'fill-blank').length,
    };
    
    return NextResponse.json({
      success: true,
      message: `成功导入 ${questions.length} 道题目`,
      questions,
      total: questions.length,
      typeStats,
    });
  } catch (error) {
    console.error('WORK 题库导入错误:', error);
    return NextResponse.json(
      { error: '导入失败，请检查文件格式是否正确' },
      { status: 500 }
    );
  }
}
